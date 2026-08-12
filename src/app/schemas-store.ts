import { create } from 'zustand';
import type { SaveSchema } from '../core/schema/schema-types';
import { loadSchemas } from '../schemas-repo/schema-loader';
import type { InvalidSchemaEntry } from '../schemas-repo/schema-loader';

interface SchemasState {
  schemas: SaveSchema[];
  invalid: InvalidSchemaEntry[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
  source: 'network' | 'cache' | null;
  fetchedAt: string | null;
  error: string | null;
  load: (baseUrl: string) => Promise<void>;
}

export const useSchemasStore = create<SchemasState>((set) => ({
  schemas: [],
  invalid: [],
  status: 'idle',
  source: null,
  fetchedAt: null,
  error: null,
  load: async (baseUrl: string) => {
    set({ status: 'loading', error: null });
    try {
      const result = await loadSchemas(baseUrl);
      set({
        schemas: result.schemas,
        invalid: result.invalid,
        source: result.source,
        fetchedAt: result.fetchedAt,
        status: 'loaded',
      });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },
}));
