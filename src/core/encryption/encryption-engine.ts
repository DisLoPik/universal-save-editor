import { BinaryReader } from '../binary/binary-reader';
import { parseOffset } from '../binary/offsets';
import { hexToBytes } from '../../utils/bytes';
import { rc4Apply } from './rc4';
import { xorApply } from './xor-cipher';
import { aesCbcDecrypt, aesCbcEncrypt, aesCtrDecrypt, aesCtrEncrypt } from './aes';
import type { EncryptionKeySource, EncryptionRegion, SaveSchema } from '../schema/schema-types';

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

function resolveKeySource(source: EncryptionKeySource, buffer: ArrayBuffer): Uint8Array {
  if (source.type === 'literal') {
    if (!source.value) throw new EncryptionError('Encryption key source of type "literal" requires "value"');
    return hexToBytes(source.value);
  }
  if (source.offset === undefined || source.length === undefined) {
    throw new EncryptionError('Encryption key source of type "fileRegion" requires "offset" and "length"');
  }
  const reader = new BinaryReader(buffer);
  return reader.bytes(parseOffset(source.offset), source.length);
}

function resolveRangeEnd(end: string | number, bufferLength: number): number {
  if (end === 'eof') return bufferLength;
  return parseOffset(end);
}

/**
 * Applies one encryption region to `buffer`, replacing the bytes in
 * `region.range` with the transformed result. Keys/IVs are always resolved
 * against `keySourceBuffer` (the pristine original file) — the typical
 * case is an unencrypted header holding an embedded IV, which should never
 * be read from a partially-transformed working buffer.
 */
async function transformRegion(
  region: EncryptionRegion,
  buffer: ArrayBuffer,
  keySourceBuffer: ArrayBuffer,
  direction: 'decrypt' | 'encrypt',
): Promise<ArrayBuffer> {
  const full = new Uint8Array(buffer);
  const start = parseOffset(region.range.start);
  const end = resolveRangeEnd(region.range.end, full.length);
  if (start < 0 || end > full.length || end < start) {
    throw new EncryptionError(`Encryption region "${region.id}" out of bounds (start=${start}, end=${end}, bufferLength=${full.length})`);
  }

  const segment = full.slice(start, end);
  const key = resolveKeySource(region.key, keySourceBuffer);
  const iv = region.iv ? resolveKeySource(region.iv, keySourceBuffer) : undefined;

  let result: Uint8Array;
  switch (region.algorithm) {
    case 'rc4':
      result = rc4Apply(segment, key); // symmetric
      break;
    case 'xor':
      result = xorApply(segment, key); // symmetric
      break;
    case 'aes-cbc':
      if (!iv) throw new EncryptionError(`Encryption region "${region.id}": aes-cbc requires "iv"`);
      result = direction === 'decrypt' ? await aesCbcDecrypt(segment, key, iv) : await aesCbcEncrypt(segment, key, iv);
      break;
    case 'aes-ctr':
      if (!iv) throw new EncryptionError(`Encryption region "${region.id}": aes-ctr requires "iv"`);
      result =
        direction === 'decrypt'
          ? await aesCtrDecrypt(segment, key, iv, region.counterLength)
          : await aesCtrEncrypt(segment, key, iv, region.counterLength);
      break;
    default:
      throw new EncryptionError(`Unsupported encryption algorithm: ${region.algorithm as string}`);
  }

  if (result.length === end - start) {
    const out = full.slice();
    out.set(result, start);
    return out.buffer;
  }
  // Length changed (e.g. AES-CBC PKCS7 padding added or removed) — rebuild
  // the buffer around the new segment length rather than assuming it fits.
  const out = new Uint8Array(full.length - (end - start) + result.length);
  out.set(full.subarray(0, start), 0);
  out.set(result, start);
  out.set(full.subarray(end), start + result.length);
  return out.buffer;
}

/** Raw file bytes -> plaintext buffer that fingerprints/fields/checksums operate against. */
export async function decryptForSchema(schema: SaveSchema, originalBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (!schema.encryption || schema.encryption.length === 0) return originalBuffer.slice(0);
  let working = originalBuffer.slice(0);
  for (const region of schema.encryption) {
    working = await transformRegion(region, working, originalBuffer, 'decrypt');
  }
  return working;
}

/** Edited plaintext buffer -> final file bytes, applying regions in reverse order. */
export async function encryptForSchema(
  schema: SaveSchema,
  editedDecryptedBuffer: ArrayBuffer,
  originalBuffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  if (!schema.encryption || schema.encryption.length === 0) return editedDecryptedBuffer.slice(0);
  let working = editedDecryptedBuffer.slice(0);
  for (const region of [...schema.encryption].reverse()) {
    working = await transformRegion(region, working, originalBuffer, 'encrypt');
  }
  return working;
}

/**
 * Trial-decrypts `region` of `buffer` without needing a schema — used by
 * the `decryptedBytes` fingerprint rule, where the whole point is to check
 * *before* a schema is confirmed matched.
 */
export async function trialDecryptRegion(region: EncryptionRegion, buffer: ArrayBuffer): Promise<Uint8Array> {
  const result = await transformRegion(region, buffer, buffer, 'decrypt');
  return new Uint8Array(result);
}
