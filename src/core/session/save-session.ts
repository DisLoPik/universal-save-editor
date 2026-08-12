import { BinaryReader } from '../binary/binary-reader';
import { BinaryWriter } from '../binary/binary-writer';
import { parseOffset } from '../binary/offsets';
import { checksumByteWidth, computeChecksum } from '../checksum/checksum-engine';
import { decryptForSchema, encryptForSchema } from '../encryption/encryption-engine';
import { buildFieldLayout, readLeafValue, writeLeafValue } from '../field/field-codec';
import type { FieldValue, LeafFieldInstance } from '../field/field-codec';
import type { SaveSchema } from '../schema/schema-types';
import { validateFieldValues } from '../validation/validation-engine';
import type { FieldValidationError } from '../validation/validation-engine';

export interface SaveSessionInit {
  originalBuffer: ArrayBuffer;
  fileName: string;
  sha256: string;
  sha1: string;
  schema: SaveSchema;
}

export interface ExportResult {
  bytes: Uint8Array;
  errors: FieldValidationError[];
}

function recalculateChecksums(schema: SaveSchema, bytes: Uint8Array): void {
  if (!schema.checksums || schema.checksums.length === 0) return;
  const reader = new BinaryReader(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const writer = new BinaryWriter(bytes);
  for (const def of schema.checksums) {
    const start = parseOffset(def.dataRange.start);
    const end = parseOffset(def.dataRange.end);
    const data = reader.bytes(start, end - start);
    const value = computeChecksum(def.algorithm, data, def.params);
    const width = checksumByteWidth(def.algorithm);
    const little = (def.endianness ?? 'little') === 'little';
    const writeOffset = parseOffset(def.writeOffset);
    if (width === 1) writer.uint8(writeOffset, value & 0xff);
    else if (width === 2) writer.uint16(writeOffset, value & 0xffff, little);
    else writer.uint32(writeOffset, value >>> 0, little);
  }
}

/**
 * Ties the whole per-file pipeline together:
 *
 *   originalBuffer (never mutated)
 *     -> decrypt (per schema.encryption, if any) -> decryptedBuffer
 *     -> fields/checksums are read from and validated against decryptedBuffer
 *     -> on export: edits + checksum recalculation applied to a COPY of
 *        decryptedBuffer, then re-encrypted (reverse order) back onto a
 *        copy of originalBuffer.
 *
 * For schemas with no `encryption`, decryptedBuffer is just a copy of
 * originalBuffer and this is a no-op pass-through — zero behavior change
 * from before encryption support existed.
 *
 * Construction and export are async because decryption/re-encryption may
 * involve Web Crypto (AES), which is promise-based.
 */
export class SaveSession {
  readonly originalBuffer: ArrayBuffer;
  readonly decryptedBuffer: ArrayBuffer;
  readonly fileName: string;
  readonly fileSize: number;
  readonly sha256: string;
  readonly sha1: string;
  readonly schema: SaveSchema;
  readonly layout: LeafFieldInstance[];

  private constructor(init: SaveSessionInit, decryptedBuffer: ArrayBuffer) {
    this.originalBuffer = init.originalBuffer;
    this.decryptedBuffer = decryptedBuffer;
    this.fileName = init.fileName;
    this.fileSize = init.originalBuffer.byteLength;
    this.sha256 = init.sha256;
    this.sha1 = init.sha1;
    this.schema = init.schema;
    this.layout = buildFieldLayout(init.schema, new Uint8Array(decryptedBuffer));
  }

  static async create(init: SaveSessionInit): Promise<SaveSession> {
    const decryptedBuffer = await decryptForSchema(init.schema, init.originalBuffer);
    return new SaveSession(init, decryptedBuffer);
  }

  /** Reads every field's current value out of the decrypted buffer. */
  readInitialValues(): { values: Map<string, FieldValue>; readErrors: FieldValidationError[] } {
    const reader = new BinaryReader(this.decryptedBuffer);
    const values = new Map<string, FieldValue>();
    const readErrors: FieldValidationError[] = [];
    for (const instance of this.layout) {
      try {
        values.set(instance.instanceId, readLeafValue(instance.field, instance.offset, reader));
      } catch (e) {
        readErrors.push({ instanceId: instance.instanceId, message: (e as Error).message });
      }
    }
    return { values, readErrors };
  }

  /**
   * Builds a modified copy of the original file from a full value map.
   * Validates first; if validation fails, no write/checksum/encryption
   * happens and the returned bytes should not be offered for download.
   */
  async buildExport(values: ReadonlyMap<string, FieldValue>): Promise<ExportResult> {
    const validationErrors = validateFieldValues(this.layout, values);
    if (validationErrors.length > 0) {
      return { bytes: new Uint8Array(this.originalBuffer.slice(0)), errors: validationErrors };
    }

    const decryptedBytes = new Uint8Array(this.decryptedBuffer.slice(0));
    const writer = new BinaryWriter(decryptedBytes);
    const writeErrors: FieldValidationError[] = [];
    for (const instance of this.layout) {
      const value = values.get(instance.instanceId);
      if (value === undefined) continue;
      try {
        writeLeafValue(instance.field, instance.offset, writer, value);
      } catch (e) {
        writeErrors.push({ instanceId: instance.instanceId, message: (e as Error).message });
      }
    }
    if (writeErrors.length > 0) {
      return { bytes: decryptedBytes, errors: writeErrors };
    }

    try {
      recalculateChecksums(this.schema, decryptedBytes);
    } catch (e) {
      return { bytes: decryptedBytes, errors: [{ instanceId: '__checksum__', message: `Checksum recalculation failed: ${(e as Error).message}` }] };
    }

    try {
      const finalBuffer = await encryptForSchema(this.schema, decryptedBytes.buffer, this.originalBuffer);
      return { bytes: new Uint8Array(finalBuffer), errors: [] };
    } catch (e) {
      return { bytes: decryptedBytes, errors: [{ instanceId: '__encryption__', message: `Re-encryption failed: ${(e as Error).message}` }] };
    }
  }
}
