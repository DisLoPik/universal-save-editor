import { BinaryReader } from '../binary/binary-reader';
import { BinaryWriter } from '../binary/binary-writer';
import { parseOffset } from '../binary/offsets';
import { resolveFieldBase, resolveFieldOffset } from '../schema/offset-resolver';
import { applyTransformsForward, applyTransformsReverse } from '../transform/transformation-engine';
import { asciiToBytes, indexOfBytes } from '../../utils/bytes';
import type { FieldSchema, FieldType, SaveSchema, VisibleWhen } from '../schema/schema-types';

export class FieldCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldCodecError';
  }
}

export type FieldValue = number | string | boolean | bigint | Uint8Array;

/**
 * A single concrete, addressable field "instance". Struct/array containers
 * in the schema are pure organization — only leaves end up here, each with
 * a fully-resolved absolute byte offset.
 *
 * Offset-based fields are statically resolvable from the schema alone
 * (every array's `count` is a static schema value, not data-dependent).
 * Search-based fields (see `FieldSchemaBase.searchPattern`) are the one
 * exception — their position depends on the specific file's bytes, so
 * `buildFieldLayout` needs the buffer to resolve them, and they're simply
 * omitted from a file where the pattern isn't found.
 */
export interface LeafFieldInstance {
  /** Flat, globally-unique id, e.g. "money" or "inventory[2].itemId". */
  instanceId: string;
  /** The leaf field's own schema definition (from `items` for array elements). */
  field: FieldSchema;
  offset: number;
  name: string;
  group?: string;
  order?: number;
  arrayIndex?: number;
  visibleWhen?: VisibleWhen;
}

const CONTAINER_TYPES = new Set<FieldType>(['struct', 'array']);

/** Returns null if the field is search-based and its pattern isn't found (or no buffer was given). */
function resolveLeafOffset(field: FieldSchema, schema: SaveSchema, parentOffset: number, buffer?: Uint8Array): number | null {
  if (field.searchPattern === undefined) {
    return resolveFieldOffset(field, schema, parentOffset);
  }
  if (!buffer) return null;

  const nameBytes = asciiToBytes(field.searchPattern);
  const nameIdx = indexOfBytes(buffer, nameBytes);
  if (nameIdx < 0) return null;

  if (field.searchValueType !== undefined) {
    const typeBytes = asciiToBytes(field.searchValueType);
    const searchStart = nameIdx + nameBytes.length;
    const maxDistance = field.searchValueTypeMaxDistance ?? 64;
    const typeIdx = indexOfBytes(buffer, typeBytes, searchStart, searchStart + maxDistance);
    if (typeIdx < 0) return null;
    return typeIdx + (field.searchValueDelta ?? 0);
  }

  return nameIdx + nameBytes.length + (field.searchValueDelta ?? 0);
}

export function buildFieldLayout(schema: SaveSchema, buffer?: Uint8Array): LeafFieldInstance[] {
  const out: LeafFieldInstance[] = [];
  walkFields(schema.fields, schema, 0, '', undefined, out, buffer);
  return out;
}

function walkFields(
  fields: FieldSchema[],
  schema: SaveSchema,
  parentOffset: number,
  idPrefix: string,
  arrayIndex: number | undefined,
  out: LeafFieldInstance[],
  buffer: Uint8Array | undefined,
): void {
  for (const field of fields) {
    if (field.type === 'struct') {
      const offset = resolveFieldOffset(field, schema, parentOffset);
      walkFields(field.fields ?? [], schema, offset, `${idPrefix}${field.id}.`, arrayIndex, out, buffer);
      continue;
    }

    if (field.type === 'array') {
      const arrayBaseOffset = resolveFieldOffset(field, schema, parentOffset);
      const count = field.count ?? 0;
      const stride = field.stride !== undefined ? parseOffset(field.stride) : 0;
      const item = field.items;
      if (!item) continue;

      for (let i = 0; i < count; i++) {
        const elementOffset = arrayBaseOffset + i * stride;
        if (item.type === 'struct') {
          walkFields(item.fields ?? [], schema, elementOffset, `${idPrefix}${field.id}[${i}].`, i, out, buffer);
        } else if (item.type === 'array') {
          // Nested arrays-of-arrays aren't supported; validator should catch malformed schemas before this runs.
          continue;
        } else {
          const itemOffset =
            item.offset !== undefined || item.searchPattern !== undefined
              ? resolveLeafOffset(item, schema, elementOffset, buffer)
              : resolveFieldBase(item, schema, elementOffset);
          if (itemOffset === null) continue;
          out.push({
            instanceId: `${idPrefix}${field.id}[${i}]`,
            field: item,
            offset: itemOffset,
            name: `${field.name} #${i + 1}`,
            group: field.group ?? item.group,
            order: field.order,
            arrayIndex: i,
            visibleWhen: field.visibleWhen ?? item.visibleWhen,
          });
        }
      }
      continue;
    }

    const offset = resolveLeafOffset(field, schema, parentOffset, buffer);
    if (offset === null) continue;
    out.push({
      instanceId: `${idPrefix}${field.id}`,
      field,
      offset,
      name: field.name,
      group: field.group,
      order: field.order,
      arrayIndex,
      visibleWhen: field.visibleWhen,
    });
  }
}

export function isContainerType(type: FieldType): boolean {
  return CONTAINER_TYPES.has(type);
}

function isFloatType(type: FieldType): boolean {
  return type === 'float32' || type === 'float64';
}

function toBigInt(value: FieldValue): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) throw new FieldCodecError(`Invalid 64-bit integer value: "${value}"`);
    return BigInt(trimmed);
  }
  throw new FieldCodecError(`Cannot convert value to a 64-bit integer: ${String(value)}`);
}

function reverseNumeric(value: FieldValue, field: FieldSchema): number {
  const num = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
  if (Number.isNaN(num)) throw new FieldCodecError(`Field "${field.id}": expected a number, got "${String(value)}"`);
  const raw = applyTransformsReverse(num, field.transform);
  return isFloatType(field.type) ? raw : Math.round(raw);
}

export function readLeafValue(field: FieldSchema, offset: number, reader: BinaryReader): FieldValue {
  const little = (field.endianness ?? 'little') === 'little';
  switch (field.type) {
    case 'uint8':
      return applyTransformsForward(reader.uint8(offset), field.transform);
    case 'int8':
      return applyTransformsForward(reader.int8(offset), field.transform);
    case 'uint16':
      return applyTransformsForward(reader.uint16(offset, little), field.transform);
    case 'int16':
      return applyTransformsForward(reader.int16(offset, little), field.transform);
    case 'uint32':
      return applyTransformsForward(reader.uint32(offset, little), field.transform);
    case 'int32':
      return applyTransformsForward(reader.int32(offset, little), field.transform);
    case 'uint64':
      return reader.uint64(offset, little);
    case 'int64':
      return reader.int64(offset, little);
    case 'float32':
      return applyTransformsForward(reader.float32(offset, little), field.transform);
    case 'float64':
      return applyTransformsForward(reader.float64(offset, little), field.transform);
    case 'boolean':
      return reader.bit(offset, field.bit ?? 0);
    case 'bitfield':
      return reader.bitfield(offset, field.bitOffset ?? 0, field.bitLength ?? 1);
    case 'enum': {
      const storage = field.storageType ?? 'uint8';
      if (storage === 'uint8') return reader.uint8(offset);
      if (storage === 'uint16') return reader.uint16(offset, little);
      return reader.uint32(offset, little);
    }
    case 'string': {
      const length = field.length ?? 0;
      const encoding = field.encoding ?? 'utf8';
      if (field.stringMode === 'nullTerminated') {
        return reader.nullTerminatedString(offset, length, encoding === 'ascii' ? 'ascii' : 'utf8');
      }
      if (encoding === 'ascii') return reader.asciiString(offset, length);
      if (encoding === 'utf16') return reader.utf16String(offset, length, little);
      return reader.utf8String(offset, length);
    }
    case 'hexBytes':
      return reader.bytes(offset, field.length ?? 0);
    default:
      throw new FieldCodecError(`Field "${field.id}": cannot read type "${field.type}" as a leaf value`);
  }
}

export function writeLeafValue(field: FieldSchema, offset: number, writer: BinaryWriter, value: FieldValue): void {
  const little = (field.endianness ?? 'little') === 'little';
  switch (field.type) {
    case 'uint8':
      writer.uint8(offset, reverseNumeric(value, field));
      return;
    case 'int8':
      writer.int8(offset, reverseNumeric(value, field));
      return;
    case 'uint16':
      writer.uint16(offset, reverseNumeric(value, field), little);
      return;
    case 'int16':
      writer.int16(offset, reverseNumeric(value, field), little);
      return;
    case 'uint32':
      writer.uint32(offset, reverseNumeric(value, field), little);
      return;
    case 'int32':
      writer.int32(offset, reverseNumeric(value, field), little);
      return;
    case 'uint64':
      writer.uint64(offset, toBigInt(value), little);
      return;
    case 'int64':
      writer.int64(offset, toBigInt(value), little);
      return;
    case 'float32':
      writer.float32(offset, reverseNumeric(value, field), little);
      return;
    case 'float64':
      writer.float64(offset, reverseNumeric(value, field), little);
      return;
    case 'boolean':
      writer.bit(offset, field.bit ?? 0, Boolean(value));
      return;
    case 'bitfield':
      writer.bitfield(offset, field.bitOffset ?? 0, field.bitLength ?? 1, Number(value));
      return;
    case 'enum': {
      const storage = field.storageType ?? 'uint8';
      const num = Number(value);
      if (storage === 'uint8') writer.uint8(offset, num);
      else if (storage === 'uint16') writer.uint16(offset, num, little);
      else writer.uint32(offset, num, little);
      return;
    }
    case 'string': {
      const length = field.length ?? 0;
      const encoding = field.encoding ?? 'utf8';
      const str = String(value);
      if (field.stringMode === 'nullTerminated') {
        writer.nullTerminatedString(offset, length, str, encoding === 'ascii' ? 'ascii' : 'utf8');
        return;
      }
      if (encoding === 'ascii') writer.asciiString(offset, length, str);
      else if (encoding === 'utf16') writer.utf16String(offset, length, str, little);
      else writer.utf8String(offset, length, str);
      return;
    }
    case 'hexBytes':
      writer.bytes(offset, value as Uint8Array);
      return;
    default:
      throw new FieldCodecError(`Field "${field.id}": cannot write type "${field.type}" as a leaf value`);
  }
}
