import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../../src/editor/editor-store';
import { SaveSession } from '../../src/core/session/save-session';
import type { SaveSchema } from '../../src/core/schema/schema-types';
import { buildPixelQuestSave } from '../fixtures/example-saves';
import pixelQuestSchema from '../../schemas/nintendo-3ds/pixel-quest/usa-v1.json';

const pixelQuest = pixelQuestSchema as unknown as SaveSchema;

function freshSession() {
  const buffer = buildPixelQuestSave({ level: 10 });
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return SaveSession.create({ originalBuffer: ab, fileName: 'x.sav', sha256: '', sha1: '', schema: pixelQuest });
}

beforeEach(() => {
  useEditorStore.getState().clearSession();
});

describe('editor store undo/redo', () => {
  it('tracks edits and supports undo/redo', async () => {
    const session = await freshSession();
    const { values } = session.readInitialValues();
    useEditorStore.getState().loadSession(session, values);

    useEditorStore.getState().setFieldValue('level', 50);
    expect(useEditorStore.getState().values.get('level')).toBe(50);
    expect(useEditorStore.getState().canUndo()).toBe(true);
    expect(useEditorStore.getState().canRedo()).toBe(false);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().values.get('level')).toBe(10);
    expect(useEditorStore.getState().canRedo()).toBe(true);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().values.get('level')).toBe(50);
  });

  it('resetField restores the original value', async () => {
    const session = await freshSession();
    const { values } = session.readInitialValues();
    useEditorStore.getState().loadSession(session, values);

    useEditorStore.getState().setFieldValue('level', 77);
    useEditorStore.getState().resetField('level');
    expect(useEditorStore.getState().values.get('level')).toBe(10);
  });

  it('resetAll restores every field and clears history', async () => {
    const session = await freshSession();
    const { values } = session.readInitialValues();
    useEditorStore.getState().loadSession(session, values);

    useEditorStore.getState().setFieldValue('level', 77);
    useEditorStore.getState().setFieldValue('money', 1);
    useEditorStore.getState().resetAll();

    expect(useEditorStore.getState().values.get('level')).toBe(10);
    expect(useEditorStore.getState().hasUnsavedChanges()).toBe(false);
    expect(useEditorStore.getState().canUndo()).toBe(false);
  });

  it('tracks per-field dirty state independently', async () => {
    const session = await freshSession();
    const { values } = session.readInitialValues();
    useEditorStore.getState().loadSession(session, values);

    useEditorStore.getState().setFieldValue('level', 77);
    expect(useEditorStore.getState().isFieldDirty('level')).toBe(true);
    expect(useEditorStore.getState().isFieldDirty('money')).toBe(false);
  });

  it('surfaces validation errors for out-of-range edits', async () => {
    const session = await freshSession();
    const { values } = session.readInitialValues();
    useEditorStore.getState().loadSession(session, values);

    useEditorStore.getState().setFieldValue('level', 500); // max is 100
    expect(useEditorStore.getState().validationErrors.some((e) => e.instanceId === 'level')).toBe(true);
  });
});
