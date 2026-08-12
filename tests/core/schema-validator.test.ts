import { describe, expect, it } from 'vitest';
import { validateSchema } from '../../src/core/schema/schema-validator';

function baseSchema(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-game-pc-v1',
    game: 'Test Game',
    platform: 'PC',
    schemaVersion: 1,
    fingerprints: [{ rules: [{ type: 'fileSize', value: 64 }] }],
    fields: [{ id: 'money', name: 'Money', type: 'uint32', offset: '0x10', min: 0, max: 999999 }],
    ...overrides,
  };
}

describe('validateSchema', () => {
  it('accepts a well-formed schema', () => {
    const result = validateSchema(baseSchema());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.schema?.id).toBe('test-game-pc-v1');
  });

  it('rejects a schema missing required properties', () => {
    const result = validateSchema({ game: 'No Id' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid offset syntax', () => {
    const result = validateSchema(
      baseSchema({ fields: [{ id: 'x', name: 'X', type: 'uint8', offset: 'not-an-offset' }] }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a non-kebab-case schema id', () => {
    const result = validateSchema(baseSchema({ id: 'Not_Kebab_Case' }));
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate field ids', () => {
    const result = validateSchema(
      baseSchema({
        fields: [
          { id: 'dup', name: 'A', type: 'uint8', offset: '0x0' },
          { id: 'dup', name: 'B', type: 'uint8', offset: '0x1' },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate field id'))).toBe(true);
  });

  it('rejects min greater than max', () => {
    const result = validateSchema(
      baseSchema({ fields: [{ id: 'x', name: 'X', type: 'uint8', offset: '0x0', min: 10, max: 5 }] }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects an unresolved baseOffsetRef', () => {
    const result = validateSchema(
      baseSchema({ fields: [{ id: 'x', name: 'X', type: 'uint8', offset: '0x0', baseOffsetRef: 'missing' }] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('baseOffsetRef'))).toBe(true);
  });

  it('rejects a visibleWhen reference to an unknown field', () => {
    const result = validateSchema(
      baseSchema({
        fields: [
          { id: 'x', name: 'X', type: 'uint8', offset: '0x0', visibleWhen: { field: 'ghost', equals: 1 } },
        ],
      }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a struct field with no children', () => {
    const result = validateSchema(
      baseSchema({ fields: [{ id: 'x', name: 'X', type: 'struct', offset: '0x0' }] }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects an array field missing count/stride/items', () => {
    const result = validateSchema(baseSchema({ fields: [{ id: 'x', name: 'X', type: 'array', offset: '0x0' }] }));
    expect(result.valid).toBe(false);
  });

  it('rejects a field that reads past an exact declared file size', () => {
    const result = validateSchema(
      baseSchema({
        fingerprints: [{ rules: [{ type: 'fileSize', value: 8 }] }],
        fields: [{ id: 'x', name: 'X', type: 'uint32', offset: '0x8' }],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('past the declared file size'))).toBe(true);
  });

  it('rejects an invalid checksum data range', () => {
    const result = validateSchema(
      baseSchema({
        checksums: [
          { id: 'c1', type: 'checksum', algorithm: 'crc32', dataRange: { start: '0x10', end: '0x10' }, writeOffset: '0x20' },
        ],
      }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects an invalid byte-pattern fingerprint', () => {
    const result = validateSchema(
      baseSchema({ fingerprints: [{ rules: [{ type: 'bytes', offset: '0x0', value: 'ZZ ZZ' }] }] }),
    );
    expect(result.valid).toBe(false);
  });

  it('accepts a byte-pattern fingerprint with wildcards', () => {
    const result = validateSchema(
      baseSchema({ fingerprints: [{ rules: [{ type: 'bytes', offset: '0x0', value: '45 ?? 41' }] }] }),
    );
    expect(result.valid).toBe(true);
  });
});
