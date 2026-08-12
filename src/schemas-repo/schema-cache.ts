import type { SaveSchema } from '../core/schema/schema-types';

/**
 * Thin IndexedDB wrapper (no external dependency) used to cache validated
 * community schemas locally so the app keeps working offline for any
 * schema it has already downloaded, per the schema-repository requirement.
 */

const DB_NAME = 'universal-save-editor';
const DB_VERSION = 1;
const SCHEMA_STORE = 'schemas';
const META_STORE = 'meta';

export interface CachedSchemaRecord {
  id: string;
  path: string;
  schema: SaveSchema;
  fetchedAt: string;
}

export interface CacheMeta {
  baseUrl: string;
  fetchedAt: string;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SCHEMA_STORE)) {
        db.createObjectStore(SCHEMA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open schema cache database'));
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`IndexedDB operation failed on "${storeName}"`));
    tx.oncomplete = () => db.close();
  });
}

export async function putCachedSchema(record: CachedSchemaRecord): Promise<void> {
  await withStore(SCHEMA_STORE, 'readwrite', (store) => store.put(record));
}

export async function getCachedSchema(id: string): Promise<CachedSchemaRecord | undefined> {
  return withStore<CachedSchemaRecord | undefined>(SCHEMA_STORE, 'readonly', (store) => store.get(id));
}

export async function getAllCachedSchemas(): Promise<CachedSchemaRecord[]> {
  return withStore<CachedSchemaRecord[]>(SCHEMA_STORE, 'readonly', (store) => store.getAll());
}

export async function clearSchemaCache(): Promise<void> {
  await withStore(SCHEMA_STORE, 'readwrite', (store) => store.clear());
  await withStore(META_STORE, 'readwrite', (store) => store.clear());
}

export async function putCacheMeta(meta: CacheMeta): Promise<void> {
  await withStore(META_STORE, 'readwrite', (store) => store.put({ key: 'index', ...meta }));
}

export async function getCacheMeta(): Promise<CacheMeta | undefined> {
  const result = await withStore<(CacheMeta & { key: string }) | undefined>(META_STORE, 'readonly', (store) => store.get('index'));
  if (!result) return undefined;
  const { key: _key, ...meta } = result;
  return meta;
}
