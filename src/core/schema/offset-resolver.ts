import { parseOffset } from '../binary/offsets';
import type { FieldSchema, SaveSchema } from './schema-types';

export class SchemaOffsetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaOffsetError';
  }
}

/**
 * Resolves the base offset (before the field's own `offset`) contributed by
 * `baseOffsetRef` (a lookup into the schema's `baseOffsets` map) and/or a
 * literal `baseOffset`, stacked on top of whatever offset the field's
 * container (a struct or array element) already resolved to.
 */
export function resolveFieldBase(field: FieldSchema, schema: SaveSchema, parentOffset = 0): number {
  let base = parentOffset;
  if (field.baseOffsetRef) {
    const ref = schema.baseOffsets?.[field.baseOffsetRef];
    if (ref === undefined) {
      throw new SchemaOffsetError(`Unknown baseOffsetRef "${field.baseOffsetRef}" referenced by field "${field.id}"`);
    }
    base += parseOffset(ref);
  }
  if (field.baseOffset !== undefined) {
    base += parseOffset(field.baseOffset);
  }
  return base;
}

/** Resolves a field's own absolute byte offset within the save buffer. */
export function resolveFieldOffset(field: FieldSchema, schema: SaveSchema, parentOffset = 0): number {
  const base = resolveFieldBase(field, schema, parentOffset);
  if (field.offset === undefined) {
    throw new SchemaOffsetError(`Field "${field.id}" is missing an "offset"`);
  }
  return base + parseOffset(field.offset);
}

/**
 * Static byte length of a field's storage, where determinable without
 * reading the file (used for bounds-checking and for array striding).
 * Returns null when the length is only known once the schema is combined
 * with runtime data the validator doesn't have (e.g. a struct's size is the
 * sum of its children, which is still statically computable, so this
 * recurses for struct; array total span is `count * stride`).
 */
export function fieldByteLength(field: FieldSchema): number | null {
  switch (field.type) {
    case 'uint8':
    case 'int8':
    case 'boolean':
      return 1;
    case 'uint16':
    case 'int16':
      return 2;
    case 'uint32':
    case 'int32':
    case 'float32':
      return 4;
    case 'uint64':
    case 'int64':
    case 'float64':
      return 8;
    case 'bitfield':
      if (field.bitOffset == null || field.bitLength == null) return null;
      return Math.ceil((field.bitOffset + field.bitLength) / 8);
    case 'string':
    case 'hexBytes':
      return field.length ?? null;
    case 'enum': {
      const storage = field.storageType ?? 'uint8';
      return storage === 'uint8' ? 1 : storage === 'uint16' ? 2 : 4;
    }
    case 'array': {
      if (field.count == null || field.stride == null) return null;
      try {
        return field.count * parseOffset(field.stride);
      } catch {
        return null;
      }
    }
    case 'struct': {
      if (!field.fields || field.fields.length === 0) return null;
      let maxEnd = 0;
      for (const child of field.fields) {
        const childOffset = child.offset !== undefined ? tryParseOffset(child.offset) : null;
        const childBase = child.baseOffset !== undefined ? tryParseOffset(child.baseOffset) : 0;
        const childLen = fieldByteLength(child);
        if (childOffset === null || childBase === null || childLen === null) return null;
        maxEnd = Math.max(maxEnd, childOffset + childBase + childLen);
      }
      return maxEnd;
    }
    default:
      return null;
  }
}

function tryParseOffset(value: string | number): number | null {
  try {
    return parseOffset(value);
  } catch {
    return null;
  }
}
