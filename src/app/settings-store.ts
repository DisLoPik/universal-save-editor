import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SCHEMA_BASE_URL } from '../schemas-repo/schema-loader';

interface SettingsState {
  schemaBaseUrl: string;
  debugMode: boolean;
  setSchemaBaseUrl: (url: string) => void;
  resetSchemaBaseUrl: () => void;
  toggleDebugMode: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      schemaBaseUrl: DEFAULT_SCHEMA_BASE_URL,
      debugMode: false,
      setSchemaBaseUrl: (url) => set({ schemaBaseUrl: url.trim() || DEFAULT_SCHEMA_BASE_URL }),
      resetSchemaBaseUrl: () => set({ schemaBaseUrl: DEFAULT_SCHEMA_BASE_URL }),
      toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
    }),
    { name: 'universal-save-editor-settings' },
  ),
);
