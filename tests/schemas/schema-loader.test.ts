import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshSchemas, loadSchemasFromCache } from '../../src/schemas-repo/schema-loader';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const validSchemaA = {
  id: 'game-a-pc-v1',
  game: 'Game A',
  platform: 'PC',
  schemaVersion: 1,
  fingerprints: [{ rules: [{ type: 'fileSize', value: 10 }] }],
  fields: [{ id: 'x', name: 'X', type: 'uint8', offset: '0x0' }],
};

const validSchemaB = { ...validSchemaA, game: 'Game B (id collides with Game A)' };
const brokenSchema = { game: 'Missing required fields' };

describe('refreshSchemas', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('index.json')) {
          return jsonResponse({
            schemaVersion: 1,
            schemas: [
              { id: 'game-a-pc-v1', path: 'a.json' },
              { id: 'game-a-pc-v1', path: 'b.json' },
              { id: 'broken', path: 'broken.json' },
            ],
          });
        }
        if (url.endsWith('a.json')) return jsonResponse(validSchemaA);
        if (url.endsWith('b.json')) return jsonResponse(validSchemaB);
        if (url.endsWith('broken.json')) return jsonResponse(brokenSchema);
        return jsonResponse(null, false, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates each schema, rejects duplicate ids across the repository, and reports invalid entries', async () => {
    const result = await refreshSchemas('/schemas');
    expect(result.source).toBe('network');
    // a.json and b.json are each individually valid but share an id -> both dropped.
    expect(result.schemas).toEqual([]);
    expect(result.invalid.length).toBe(3); // 2 duplicate-id drops + 1 failed validation
    expect(result.invalid.some((e) => e.path === 'broken.json')).toBe(true);
  });

  it('surfaces a network failure fetching the index', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(null, false, 500)),
    );
    await expect(refreshSchemas('/schemas')).rejects.toThrow();
  });
});

describe('loadSchemasFromCache', () => {
  it('returns an empty result rather than throwing when no cache is available', async () => {
    const result = await loadSchemasFromCache();
    expect(result.source).toBe('cache');
    expect(Array.isArray(result.schemas)).toBe(true);
  });
});
