import type { LeafFieldInstance, FieldValue } from '../field/field-codec';
import type { FieldSchema } from '../schema/schema-types';

export interface FieldValidationError {
  instanceId: string;
  message: string;
}

function validateOne(field: FieldSchema, value: FieldValue): string | null {
  switch (field.type) {
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'int8':
    case 'int16':
    case 'int32':
    case 'float32':
    case 'float64': {
      const num = Number(value);
      if (Number.isNaN(num)) return `"${field.name}" must be a number`;
      if (field.min !== undefined && num < field.min) return `"${field.name}" must be >= ${field.min}`;
      if (field.max !== undefined && num > field.max) return `"${field.name}" must be <= ${field.max}`;
      return null;
    }
    case 'uint64':
    case 'int64': {
      let big: bigint;
      try {
        big = typeof value === 'bigint' ? value : BigInt(String(value).trim() || '0');
      } catch {
        return `"${field.name}" must be a valid integer`;
      }
      if (field.min !== undefined && big < BigInt(Math.trunc(field.min))) return `"${field.name}" must be >= ${field.min}`;
      if (field.max !== undefined && big > BigInt(Math.trunc(field.max))) return `"${field.name}" must be <= ${field.max}`;
      return null;
    }
    case 'string': {
      const str = String(value);
      const maxLen = field.length ?? Infinity;
      const encoding = field.encoding ?? 'utf8';
      const byteLen = encoding === 'utf8' ? new TextEncoder().encode(str).length : encoding === 'utf16' ? str.length * 2 : str.length;
      if (byteLen > maxLen) return `"${field.name}" exceeds the maximum stored length of ${maxLen} bytes`;
      return null;
    }
    case 'hexBytes': {
      if (!(value instanceof Uint8Array)) return `"${field.name}" has invalid byte data`;
      if (field.length !== undefined && value.length !== field.length) {
        return `"${field.name}" must be exactly ${field.length} bytes (got ${value.length})`;
      }
      return null;
    }
    case 'enum': {
      const num = Number(value);
      if (Number.isNaN(num)) return `"${field.name}" must select a value`;
      if (field.values && !(String(num) in field.values)) {
        return `"${field.name}": ${num} is not a recognized value`;
      }
      return null;
    }
    case 'bitfield': {
      const num = Number(value);
      const max = Math.pow(2, field.bitLength ?? 1) - 1;
      if (Number.isNaN(num) || num < 0 || num > max) return `"${field.name}" must be between 0 and ${max}`;
      return null;
    }
    case 'boolean':
    default:
      return null;
  }
}

export function validateFieldValues(
  layout: LeafFieldInstance[],
  values: ReadonlyMap<string, FieldValue>,
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];
  for (const instance of layout) {
    const value = values.get(instance.instanceId);
    if (value === undefined) continue;
    const message = validateOne(instance.field, value);
    if (message) errors.push({ instanceId: instance.instanceId, message });
  }
  return errors;
}
