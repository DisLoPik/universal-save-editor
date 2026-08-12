import { create } from 'zustand';
import type { FieldValue } from '../core/field/field-codec';
import { SaveSession } from '../core/session/save-session';
import { validateFieldValues } from '../core/validation/validation-engine';
import type { FieldValidationError } from '../core/validation/validation-engine';
import { HistoryManager } from './history';

function valuesEqual(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  if (a === b) return true;
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return false;
}

interface EditorStoreState {
  session: SaveSession | null;
  originalValues: Map<string, FieldValue>;
  values: Map<string, FieldValue>;
  validationErrors: FieldValidationError[];
  historyVersion: number;

  loadSession: (session: SaveSession, values: Map<string, FieldValue>) => void;
  clearSession: () => void;
  setFieldValue: (instanceId: string, value: FieldValue) => void;
  resetField: (instanceId: string) => void;
  resetAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  isFieldDirty: (instanceId: string) => boolean;
  hasUnsavedChanges: () => boolean;
}

const history = new HistoryManager();

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  session: null,
  originalValues: new Map(),
  values: new Map(),
  validationErrors: [],
  historyVersion: 0,

  loadSession: (session, values) => {
    history.clear();
    set({
      session,
      originalValues: new Map(values),
      values: new Map(values),
      validationErrors: [],
      historyVersion: 0,
    });
  },

  clearSession: () => {
    history.clear();
    set({ session: null, originalValues: new Map(), values: new Map(), validationErrors: [], historyVersion: 0 });
  },

  setFieldValue: (instanceId, value) => {
    const { values, session } = get();
    const previousValue = values.get(instanceId);
    if (valuesEqual(previousValue, value)) return;
    history.record({ instanceId, previousValue, nextValue: value });
    const next = new Map(values);
    next.set(instanceId, value);
    const validationErrors = session ? validateFieldValues(session.layout, next) : [];
    set({ values: next, validationErrors, historyVersion: get().historyVersion + 1 });
  },

  resetField: (instanceId) => {
    const original = get().originalValues.get(instanceId);
    if (original === undefined) return;
    get().setFieldValue(instanceId, original);
  },

  resetAll: () => {
    const { originalValues, session } = get();
    history.clear();
    const validationErrors = session ? validateFieldValues(session.layout, originalValues) : [];
    set({ values: new Map(originalValues), validationErrors, historyVersion: 0 });
  },

  undo: () => {
    const edit = history.undo();
    if (!edit) return;
    const { values, session } = get();
    const next = new Map(values);
    if (edit.previousValue === undefined) next.delete(edit.instanceId);
    else next.set(edit.instanceId, edit.previousValue);
    const validationErrors = session ? validateFieldValues(session.layout, next) : [];
    set({ values: next, validationErrors, historyVersion: get().historyVersion + 1 });
  },

  redo: () => {
    const edit = history.redo();
    if (!edit) return;
    const { values } = get();
    const next = new Map(values);
    next.set(edit.instanceId, edit.nextValue);
    const session = get().session;
    const validationErrors = session ? validateFieldValues(session.layout, next) : [];
    set({ values: next, validationErrors, historyVersion: get().historyVersion + 1 });
  },

  canUndo: () => history.canUndo,
  canRedo: () => history.canRedo,

  isFieldDirty: (instanceId) => {
    const { originalValues, values } = get();
    return !valuesEqual(originalValues.get(instanceId), values.get(instanceId));
  },

  hasUnsavedChanges: () => {
    const { originalValues, values } = get();
    for (const [id, value] of values) {
      if (!valuesEqual(originalValues.get(id), value)) return true;
    }
    return false;
  },
}));
