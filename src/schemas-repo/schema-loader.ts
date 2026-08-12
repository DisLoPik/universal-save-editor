import { validateSchema } from '../core/schema/schema-validator';
import type { SaveSchema, SchemaIndex } from '../core/schema/schema-types';
import { getAllCachedSchemas, getCacheMeta, putCachedSchema, putCacheMeta } from './schema-cache';

export class SchemaLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaLoadError';
  }
}

/**
 * Same-origin by default (the `schemas/` directory bundled with this app,
 * see vite.config.ts). Can be pointed at any other origin (a CDN mirror of
 * the community schemas git repo, e.g. jsDelivr over GitHub) at runtime via
 * Settings, without a new app deployment — see docs/schema-authoring.md.
 */
export const DEFAULT_SCHEMA_BASE_URL = '/schemas';

export interface InvalidSchemaEntry {
  path: string;
  errors: string[];
}

export interface LoadSchemasResult {
  schemas: SaveSchema[];
  invalid: InvalidSchemaEntry[];
  source: 'network' | 'cache';
  fetchedAt: string | null;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new SchemaLoadError(`Request to "${url}" failed with status ${res.status}`);
  }
  return res.json();
}

async function fetchSchemaIndex(baseUrl: string): Promise<SchemaIndex> {
  const json = await fetchJson(joinUrl(baseUrl, 'index.json'));
  if (!json || typeof json !== 'object' || !Array.isArray((json as Record<string, unknown>).schemas)) {
    throw new SchemaLoadError('Malformed schema index: expected an object with a "schemas" array');
  }
  return json as SchemaIndex;
}

/**
 * Fetches the index and every listed schema from `baseUrl`, validates each
 * one, and caches the valid ones to IndexedDB. Invalid schemas are skipped
 * (reported in `invalid`) rather than allowed to break the whole repository
 * load — one bad community submission shouldn't take down every game.
 */
export async function refreshSchemas(baseUrl: string = DEFAULT_SCHEMA_BASE_URL): Promise<LoadSchemasResult> {
  const index = await fetchSchemaIndex(baseUrl);
  const fetchedAt = new Date().toISOString();
  const invalid: InvalidSchemaEntry[] = [];
  const schemas: SaveSchema[] = [];

  await Promise.all(
    index.schemas.map(async (entry) => {
      try {
        const raw = await fetchJson(joinUrl(baseUrl, entry.path));
        const result = validateSchema(raw);
        if (result.valid && result.schema) {
          schemas.push(result.schema);
          try {
            await putCachedSchema({ id: result.schema.id, path: entry.path, schema: result.schema, fetchedAt });
          } catch {
            // Caching is a best-effort convenience — failing to cache must not fail the load.
          }
        } else {
          invalid.push({ path: entry.path, errors: result.errors });
        }
      } catch (e) {
        invalid.push({ path: entry.path, errors: [(e as Error).message] });
      }
    }),
  );

  // Reject the whole set of schemas sharing an id: fingerprinting can't tell them apart.
  const idCounts = new Map<string, number>();
  for (const schema of schemas) idCounts.set(schema.id, (idCounts.get(schema.id) ?? 0) + 1);
  const deduped = schemas.filter((schema) => {
    if ((idCounts.get(schema.id) ?? 0) > 1) {
      invalid.push({ path: schema.id, errors: [`Duplicate schema id "${schema.id}" is declared by more than one schema file in the repository`] });
      return false;
    }
    return true;
  });

  try {
    await putCacheMeta({ baseUrl, fetchedAt });
  } catch {
    // Non-fatal.
  }

  return { schemas: deduped, invalid, source: 'network', fetchedAt };
}

/** Reads whatever was last cached, with no network access — used offline or as a network-failure fallback. */
export async function loadSchemasFromCache(): Promise<LoadSchemasResult> {
  const [records, meta] = await Promise.all([
    getAllCachedSchemas().catch(() => []),
    getCacheMeta().catch(() => undefined),
  ]);
  return {
    schemas: records.map((r) => r.schema),
    invalid: [],
    source: 'cache',
    fetchedAt: meta?.fetchedAt ?? null,
  };
}

/** Tries the network first (to pick up newly-published community schemas); falls back to cache if offline. */
export async function loadSchemas(baseUrl: string = DEFAULT_SCHEMA_BASE_URL): Promise<LoadSchemasResult> {
  try {
    return await refreshSchemas(baseUrl);
  } catch (networkError) {
    const cached = await loadSchemasFromCache();
    if (cached.schemas.length > 0) {
      return cached;
    }
    throw networkError instanceof Error ? networkError : new SchemaLoadError('Failed to load schemas');
  }
}
