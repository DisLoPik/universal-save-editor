import { z } from 'zod';
import { isValidOffsetSyntax, parseOffset } from '../binary/offsets';
import { SUPPORTED_CHECKSUM_ALGORITHMS } from '../checksum/checksum-engine';
import { fieldByteLength, resolveFieldOffset } from './offset-resolver';
import type { FieldSchema, SaveSchema } from './schema-types';

const ENCRYPTION_ALGORITHMS = ['rc4', 'xor', 'aes-cbc', 'aes-ctr'] as const;

/* ------------------------------------------------------------------ */
/* Shape validation (zod) — untrusted community JSON in, typed data out */
/* ------------------------------------------------------------------ */

const offsetValue = z
  .union([z.string(), z.number()])
  .refine((v) => isValidOffsetSyntax(v), { message: 'Invalid offset syntax (expected hex like "0x120" or a decimal integer)' });

const offsetOrEof = z.union([offsetValue, z.literal('eof')]);

const encryptionKeySourceZod = z.object({
  type: z.enum(['literal', 'fileRegion']),
  value: z.string().optional(),
  offset: offsetValue.optional(),
  length: z.number().int().min(1).optional(),
});

const encryptionRegionZod = z.object({
  id: z.string().min(1),
  algorithm: z.enum(ENCRYPTION_ALGORITHMS),
  range: z.object({ start: offsetValue, end: offsetOrEof }),
  key: encryptionKeySourceZod,
  iv: encryptionKeySourceZod.optional(),
  counterLength: z.number().int().min(1).max(128).optional(),
});

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean()]);

const transformStep: z.ZodTypeAny = z.union([
  z.object({ type: z.literal('multiply'), factor: z.number() }),
  z.object({ type: z.literal('divide'), factor: z.number() }),
  z.object({ type: z.literal('add'), value: z.number() }),
  z.object({ type: z.literal('subtract'), value: z.number() }),
  z.object({ type: z.literal('xor'), mask: z.number() }),
  z.object({ type: z.literal('bitmaskAnd'), mask: z.number() }),
  z.object({ type: z.literal('shiftLeft'), bits: z.number() }),
  z.object({ type: z.literal('shiftRight'), bits: z.number() }),
  z.object({ type: z.literal('toSigned'), bits: z.number() }),
  z.object({ type: z.literal('toUnsigned'), bits: z.number() }),
  z.object({ type: z.literal('fixedPoint'), fractionalBits: z.number() }),
  z.object({ type: z.literal('scale'), divisor: z.number() }),
]);

const visibleWhen = z.object({
  field: z.string().min(1),
  equals: jsonPrimitive.optional(),
  notEquals: jsonPrimitive.optional(),
  in: z.array(jsonPrimitive).optional(),
});

const FIELD_TYPES = [
  'uint8', 'uint16', 'uint32', 'uint64',
  'int8', 'int16', 'int32', 'int64',
  'float32', 'float64',
  'boolean', 'bitfield', 'string', 'hexBytes', 'enum', 'array', 'struct',
] as const;

const fieldSchemaZod: z.ZodType<FieldSchema> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(FIELD_TYPES),
    offset: offsetValue.optional(),
    baseOffset: offsetValue.optional(),
    baseOffsetRef: z.string().optional(),
    endianness: z.enum(['little', 'big']).optional(),
    readOnly: z.boolean().optional(),
    group: z.string().optional(),
    order: z.number().optional(),
    visibleWhen: visibleWhen.optional(),
    transform: z.array(transformStep).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    defaultValue: jsonPrimitive.optional(),
    bit: z.number().int().min(0).max(7).optional(),
    bitOffset: z.number().int().min(0).optional(),
    bitLength: z.number().int().min(1).max(32).optional(),
    length: z.number().int().min(0).optional(),
    encoding: z.enum(['ascii', 'utf8', 'utf16']).optional(),
    stringMode: z.enum(['fixed', 'nullTerminated']).optional(),
    storageType: z.enum(['uint8', 'uint16', 'uint32']).optional(),
    values: z.record(z.string()).optional(),
    count: z.number().int().min(0).optional(),
    stride: offsetValue.optional(),
    items: z.lazy(() => fieldSchemaZod).optional(),
    fields: z.array(z.lazy(() => fieldSchemaZod)).optional(),
    searchPattern: z.string().min(1).optional(),
    searchValueType: z.string().min(1).optional(),
    searchValueTypeMaxDistance: z.number().int().min(1).optional(),
    searchValueDelta: z.number().int().optional(),
  }),
) as unknown as z.ZodType<FieldSchema>;

const BYTE_PATTERN = /^([0-9a-fA-F]{2}|\?\?)(\s+([0-9a-fA-F]{2}|\?\?))*$/;

const fingerprintRuleZod: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('fileSize'),
      value: z.number().int().min(0),
      tolerance: z.number().int().min(0).optional(),
      weight: z.number().optional(),
    }),
    z.object({
      type: z.literal('bytes'),
      offset: offsetValue,
      value: z.string().regex(BYTE_PATTERN, 'Invalid byte pattern (expected space-separated hex bytes, "??" wildcard allowed)'),
      weight: z.number().optional(),
    }),
    z.object({
      type: z.literal('string'),
      offset: offsetValue,
      value: z.string().min(1),
      encoding: z.enum(['ascii', 'utf8']).optional(),
      weight: z.number().optional(),
    }),
    z.object({
      type: z.literal('sha256'),
      value: z.string().regex(/^[0-9a-fA-F]{64}$/, 'sha256 must be 64 hex characters'),
      weight: z.number().optional(),
    }),
    z.object({
      type: z.literal('sha1'),
      value: z.string().regex(/^[0-9a-fA-F]{40}$/, 'sha1 must be 40 hex characters'),
      weight: z.number().optional(),
    }),
    z.object({
      type: z.literal('crc32'),
      value: z.string().regex(/^(0x)?[0-9a-fA-F]{1,8}$/, 'crc32 must be a hex value'),
      dataRange: z.object({ start: offsetValue, end: offsetValue }).optional(),
      weight: z.number().optional(),
    }),
    z.object({
      type: z.literal('checksumMatch'),
      algorithm: z.enum(SUPPORTED_CHECKSUM_ALGORITHMS as unknown as [string, ...string[]]),
      dataRange: z.object({ start: offsetValue, end: offsetValue }),
      storedAt: offsetValue,
      endianness: z.enum(['little', 'big']).optional(),
      params: z
        .object({
          polynomial: z.number().optional(),
          initialValue: z.number().optional(),
          finalXor: z.number().optional(),
          reflectIn: z.boolean().optional(),
          reflectOut: z.boolean().optional(),
        })
        .optional(),
      weight: z.number().optional(),
    }),
    z.object({
      type: z.literal('decryptedBytes'),
      algorithm: z.enum(ENCRYPTION_ALGORITHMS),
      key: encryptionKeySourceZod,
      iv: encryptionKeySourceZod.optional(),
      range: z.object({ start: offsetValue, end: offsetOrEof }).optional(),
      offset: offsetValue,
      value: z.string().regex(BYTE_PATTERN, 'Invalid byte pattern (expected space-separated hex bytes, "??" wildcard allowed)'),
      weight: z.number().optional(),
    }),
    z.object({ type: z.literal('allOf'), rules: z.lazy(() => z.array(fingerprintRuleZod).min(1)), weight: z.number().optional() }),
    z.object({ type: z.literal('anyOf'), rules: z.lazy(() => z.array(fingerprintRuleZod).min(1)), weight: z.number().optional() }),
  ]),
);

const fingerprintSetZod = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  rules: z.array(fingerprintRuleZod).min(1),
});

const checksumDefinitionZod = z.object({
  id: z.string().min(1),
  type: z.literal('checksum'),
  algorithm: z.enum(SUPPORTED_CHECKSUM_ALGORITHMS as unknown as [string, ...string[]]),
  dataRange: z.object({ start: offsetValue, end: offsetValue }),
  writeOffset: offsetValue,
  endianness: z.enum(['little', 'big']).optional(),
  params: z
    .object({
      polynomial: z.number().optional(),
      initialValue: z.number().optional(),
      finalXor: z.number().optional(),
      reflectIn: z.boolean().optional(),
      reflectOut: z.boolean().optional(),
    })
    .optional(),
  description: z.string().optional(),
});

const schemaGroupZod = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().optional(),
  description: z.string().optional(),
});

const communityEditorLinkZod = z.object({
  slug: z.string().regex(/^[a-z0-9+]+(-[a-z0-9+]+)*$/, 'slug must match a /community-editors directory name'),
});

export const saveSchemaZod = z.object({
  id: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case: lowercase letters, digits, and hyphens only'),
  game: z.string().min(1),
  platform: z.string().min(1),
  region: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  description: z.string().optional(),
  lastUpdated: z.string().optional(),
  schemaVersion: z.number().int().min(1),
  fingerprints: z.array(fingerprintSetZod).min(1, 'schema must define at least one fingerprint'),
  baseOffsets: z.record(offsetValue).optional(),
  groups: z.array(schemaGroupZod).optional(),
  // Non-empty is enforced in semantic validation below, EXCEPT for
  // communityEditor pointer schemas, which must be empty instead.
  fields: z.array(fieldSchemaZod),
  checksums: z.array(checksumDefinitionZod).optional(),
  encryption: z.array(encryptionRegionZod).optional(),
  communityEditor: communityEditorLinkZod.optional(),
});

/* ------------------------------------------------------------------ */
/* Semantic validation — cross references, duplicates, sane ranges     */
/* ------------------------------------------------------------------ */

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  schema: SaveSchema | null;
}

function collectFieldIds(fields: FieldSchema[], out: string[] = []): string[] {
  for (const field of fields) {
    out.push(field.id);
    if (field.type === 'struct' && field.fields) collectFieldIds(field.fields, out);
    if (field.type === 'array' && field.items) collectFieldIds([field.items], out);
  }
  return out;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}

function checkFieldTypeRequirements(field: FieldSchema, errors: string[], path: string) {
  if (field.type !== 'struct' && field.type !== 'array') {
    if (field.offset === undefined && field.searchPattern === undefined) {
      errors.push(`${path}: requires either "offset" or "searchPattern"`);
    }
    if (field.offset !== undefined && field.searchPattern !== undefined) {
      errors.push(`${path}: "offset" and "searchPattern" are mutually exclusive`);
    }
  }
  if ((field.searchValueType !== undefined || field.searchValueTypeMaxDistance !== undefined || field.searchValueDelta !== undefined) && field.searchPattern === undefined) {
    errors.push(`${path}: "searchValueType"/"searchValueTypeMaxDistance"/"searchValueDelta" require "searchPattern"`);
  }

  switch (field.type) {
    case 'boolean':
      if (field.bit !== undefined && (field.bit < 0 || field.bit > 7)) {
        errors.push(`${path}: boolean "bit" must be between 0 and 7`);
      }
      break;
    case 'bitfield':
      if (field.bitLength === undefined) errors.push(`${path}: bitfield requires "bitLength"`);
      if (field.bitOffset === undefined) errors.push(`${path}: bitfield requires "bitOffset"`);
      break;
    case 'string':
      if (field.length === undefined) errors.push(`${path}: string field requires "length"`);
      break;
    case 'hexBytes':
      if (field.length === undefined) errors.push(`${path}: hexBytes field requires "length"`);
      break;
    case 'enum':
      if (!field.values || Object.keys(field.values).length === 0) {
        errors.push(`${path}: enum field requires a non-empty "values" map`);
      }
      break;
    case 'array':
      if (field.count === undefined) errors.push(`${path}: array field requires "count"`);
      if (field.stride === undefined) errors.push(`${path}: array field requires "stride"`);
      if (!field.items) errors.push(`${path}: array field requires "items"`);
      break;
    case 'struct':
      if (!field.fields || field.fields.length === 0) {
        errors.push(`${path}: struct field requires a non-empty "fields" array`);
      }
      break;
    default:
      break;
  }

  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    errors.push(`${path}: "min" (${field.min}) is greater than "max" (${field.max})`);
  }
}

function walkFields(
  fields: FieldSchema[],
  schema: SaveSchema,
  errors: string[],
  pathPrefix: string,
  parentOffset: number | null,
) {
  for (const field of fields) {
    const path = `${pathPrefix}${field.id}`;
    checkFieldTypeRequirements(field, errors, path);

    if (field.baseOffsetRef && !schema.baseOffsets?.[field.baseOffsetRef]) {
      errors.push(`${path}: baseOffsetRef "${field.baseOffsetRef}" is not defined in the schema's "baseOffsets"`);
    }

    if (field.visibleWhen && !collectFieldIds(schema.fields).includes(field.visibleWhen.field)) {
      errors.push(`${path}: visibleWhen references unknown field "${field.visibleWhen.field}"`);
    }

    if (schema.groups && schema.groups.length > 0 && field.group && !schema.groups.some((g) => g.id === field.group)) {
      errors.push(`${path}: group "${field.group}" is not declared in the schema's "groups"`);
    }

    // Best-effort out-of-bounds check against an exact fileSize fingerprint, where offsets are statically resolvable.
    // Search-based fields aren't statically resolvable at all (their position depends on file content), so skip them.
    if (parentOffset !== null && field.type !== 'struct' && field.type !== 'array' && field.searchPattern === undefined) {
      const exactSize = findExactFileSize(schema);
      if (exactSize !== null) {
        try {
          const offset = resolveFieldOffset(field, schema, parentOffset);
          const length = fieldByteLength(field);
          if (length !== null && offset + length > exactSize) {
            errors.push(`${path}: field extends past the declared file size (offset ${offset} + length ${length} > ${exactSize} bytes)`);
          }
        } catch {
          // Offset depends on runtime data (e.g. an unresolved baseOffsetRef already reported above) — skip.
        }
      }
    }

    if (field.type === 'struct' && field.fields) {
      let nextParent: number | null = null;
      if (parentOffset !== null) {
        try {
          nextParent = resolveFieldOffset(field, schema, parentOffset);
        } catch {
          nextParent = null;
        }
      }
      walkFields(field.fields, schema, errors, `${path}.`, nextParent);
    }
    if (field.type === 'array' && field.items) {
      let nextParent: number | null = null;
      if (parentOffset !== null) {
        try {
          nextParent = resolveFieldOffset(field, schema, parentOffset);
        } catch {
          nextParent = null;
        }
      }
      walkFields([field.items], schema, errors, `${path}[].`, nextParent);
    }
  }
}

function findExactFileSize(schema: SaveSchema): number | null {
  for (const set of schema.fingerprints) {
    for (const rule of set.rules) {
      if (rule.type === 'fileSize' && !rule.tolerance) return rule.value;
    }
  }
  return null;
}

export function validateSchema(input: unknown): SchemaValidationResult {
  const parsed = saveSchemaZod.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
      schema: null,
    };
  }

  const schema = parsed.data as SaveSchema;
  const errors: string[] = [];

  if (schema.communityEditor) {
    if (schema.fields.length > 0) {
      errors.push('a schema with "communityEditor" set must have an empty "fields" array — it points to a standalone external editor instead of defining editable fields');
    }
    if (schema.checksums && schema.checksums.length > 0) {
      errors.push('a schema with "communityEditor" set must not define "checksums" (nothing is ever edited/exported through this app for it)');
    }
    if (schema.encryption && schema.encryption.length > 0) {
      errors.push('a schema with "communityEditor" set must not define "encryption" (nothing is ever decrypted/read through this app for it)');
    }
  } else if (schema.fields.length === 0) {
    errors.push('schema must define at least one field (or set "communityEditor" to link out to a standalone editor instead)');
  }

  const allIds = collectFieldIds(schema.fields);
  const dupes = findDuplicates(allIds);
  if (dupes.length > 0) {
    errors.push(`Duplicate field id(s): ${dupes.join(', ')}`);
  }

  if (schema.checksums) {
    const checksumIds = schema.checksums.map((c) => c.id);
    const dupChecksums = findDuplicates(checksumIds);
    if (dupChecksums.length > 0) errors.push(`Duplicate checksum id(s): ${dupChecksums.join(', ')}`);
    for (const checksum of schema.checksums) {
      try {
        const start = parseOffset(checksum.dataRange.start);
        const end = parseOffset(checksum.dataRange.end);
        if (end <= start) {
          errors.push(`checksum "${checksum.id}": dataRange.end must be greater than dataRange.start`);
        }
      } catch (e) {
        errors.push(`checksum "${checksum.id}": invalid dataRange (${(e as Error).message})`);
      }
    }
  }

  if (schema.encryption) {
    const encryptionIds = schema.encryption.map((r) => r.id);
    const dupEncryption = findDuplicates(encryptionIds);
    if (dupEncryption.length > 0) errors.push(`Duplicate encryption region id(s): ${dupEncryption.join(', ')}`);
    for (const region of schema.encryption) {
      try {
        const start = parseOffset(region.range.start);
        if (region.range.end !== 'eof') {
          const end = parseOffset(region.range.end);
          if (end <= start) errors.push(`encryption "${region.id}": range.end must be greater than range.start`);
        }
      } catch (e) {
        errors.push(`encryption "${region.id}": invalid range (${(e as Error).message})`);
      }
      if (region.key.type === 'literal' && !region.key.value) {
        errors.push(`encryption "${region.id}": key of type "literal" requires "value"`);
      }
      if (region.key.type === 'fileRegion' && (region.key.offset === undefined || region.key.length === undefined)) {
        errors.push(`encryption "${region.id}": key of type "fileRegion" requires "offset" and "length"`);
      }
      if ((region.algorithm === 'aes-cbc' || region.algorithm === 'aes-ctr') && !region.iv) {
        errors.push(`encryption "${region.id}": algorithm "${region.algorithm}" requires "iv"`);
      }
    }
  }

  if (schema.baseOffsets) {
    for (const [key, value] of Object.entries(schema.baseOffsets)) {
      if (!isValidOffsetSyntax(value)) {
        errors.push(`baseOffsets.${key}: invalid offset syntax`);
      }
    }
  }

  walkFields(schema.fields, schema, errors, '', 0);

  return { valid: errors.length === 0, errors, schema: errors.length === 0 ? schema : null };
}
