import { useEffect, useMemo, useState } from 'react';
import type { FieldValue, LeafFieldInstance } from '../../core/field/field-codec';
import type { SaveSchema } from '../../core/schema/schema-types';
import { useEditorStore } from '../../editor/editor-store';
import { useSettingsStore } from '../../app/settings-store';
import { buildBackupFileName, buildExportFileName, downloadBytes } from '../../utils/download';
import { formatBytes } from '../../utils/bytes';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { GroupPanel } from '../components/GroupPanel';
import { HexViewer } from '../components/HexViewer';

interface GroupData {
  id: string;
  name: string;
  order: number;
  instances: LeafFieldInstance[];
}

function buildGroups(layout: LeafFieldInstance[], schema: SaveSchema): GroupData[] {
  const groupMeta = new Map((schema.groups ?? []).map((g) => [g.id, g]));
  const map = new Map<string, GroupData>();
  for (const instance of layout) {
    const groupId = instance.group ?? '__general__';
    if (!map.has(groupId)) {
      const meta = groupMeta.get(groupId);
      map.set(groupId, {
        id: groupId,
        name: meta?.name ?? (groupId === '__general__' ? 'General' : groupId),
        order: meta?.order ?? 0,
        instances: [],
      });
    }
    map.get(groupId)!.instances.push(instance);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const g of groups) {
    g.instances.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return groups;
}

function resolveVisible(instance: LeafFieldInstance, values: Map<string, FieldValue>): boolean {
  const vw = instance.visibleWhen;
  if (!vw) return true;
  let candidate: FieldValue | undefined;
  const scoped = instance.instanceId.match(/^(.*\[\d+\]\.)[^.]+$/);
  if (scoped) candidate = values.get(`${scoped[1]}${vw.field}`);
  if (candidate === undefined) candidate = values.get(vw.field);
  if (candidate === undefined) return true;
  if (vw.equals !== undefined) return candidate === vw.equals;
  if (vw.notEquals !== undefined) return candidate !== vw.notEquals;
  if (vw.in !== undefined) return vw.in.some((v) => v === candidate);
  return true;
}

export function EditorPage({ onBack }: { onBack: () => void }) {
  const session = useEditorStore((s) => s.session);
  const values = useEditorStore((s) => s.values);
  const validationErrors = useEditorStore((s) => s.validationErrors);
  const setFieldValue = useEditorStore((s) => s.setFieldValue);
  const resetField = useEditorStore((s) => s.resetField);
  const resetAll = useEditorStore((s) => s.resetAll);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo());
  const canRedo = useEditorStore((s) => s.canRedo());
  const isFieldDirty = useEditorStore((s) => s.isFieldDirty);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges());

  const debugMode = useSettingsStore((s) => s.debugMode);
  const toggleDebugMode = useSettingsStore((s) => s.toggleDebugMode);

  const [search, setSearch] = useState('');
  const [exportNotice, setExportNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey;
      if (!isMeta) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const groups = useMemo(() => (session ? buildGroups(session.layout, session.schema) : []), [session]);
  const errorMap = useMemo(() => new Map(validationErrors.map((e) => [e.instanceId, e.message])), [validationErrors]);

  if (!session) return null;

  const handleBack = () => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Discard them and go back?')) return;
    onBack();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await session.buildExport(values);
      if (result.errors.length > 0) {
        setExportNotice({ kind: 'error', message: `Cannot export: ${result.errors[0].message}` });
        return;
      }
      downloadBytes(result.bytes, buildExportFileName(session.fileName));
      setPreviewBytes(result.bytes);
      setExportNotice({ kind: 'success', message: 'Export ready — check your downloads.' });
    } catch (e) {
      setExportNotice({ kind: 'error', message: `Export failed: ${(e as Error).message}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackup = () => {
    downloadBytes(new Uint8Array(session.originalBuffer), buildBackupFileName(session.fileName));
  };

  const { schema } = session;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">{schema.game}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {schema.platform}
            {schema.region ? ` • ${schema.region}` : ''}
            {schema.version ? ` • v${schema.version}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && <Badge tone="warning">Unsaved changes</Badge>}
          <Badge tone="neutral">{formatBytes(session.fileSize)}</Badge>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={undo} disabled={!canUndo}>
          Undo
        </Button>
        <Button variant="secondary" size="sm" onClick={redo} disabled={!canRedo}>
          Redo
        </Button>
        <Button variant="ghost" size="sm" onClick={resetAll} disabled={!hasUnsavedChanges}>
          Reset all changes
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleDebugMode}>
          {debugMode ? 'Hide' : 'Show'} debug info
        </Button>
        <div className="ml-auto min-w-[10rem] flex-1 sm:flex-none">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
            className="w-full rounded-lg border border-border bg-bg-inset px-3 py-1.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
      </div>

      {exportNotice && (
        <div
          className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${
            exportNotice.kind === 'success' ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {exportNotice.message}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {groups.map((group) => (
          <GroupPanel
            key={group.id}
            groupName={group.name}
            instances={group.instances}
            values={values}
            errors={errorMap}
            searchTerm={search}
            isFieldVisible={(instance) => resolveVisible(instance, values)}
            isFieldDirty={isFieldDirty}
            onChange={setFieldValue}
            onReset={resetField}
          />
        ))}
      </div>

      {debugMode && (
        <div className="mt-8 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-faint">Developer / Debug</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-border bg-bg-panel p-5 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-text-muted">Filename</dt>
            <dd className="font-mono text-text">{session.fileName}</dd>
            <dt className="text-text-muted">File size</dt>
            <dd className="font-mono text-text">{session.fileSize} bytes</dd>
            <dt className="text-text-muted">SHA-256</dt>
            <dd className="break-all font-mono text-xs text-text">{session.sha256}</dd>
            <dt className="text-text-muted">SHA-1</dt>
            <dd className="break-all font-mono text-xs text-text">{session.sha1}</dd>
            <dt className="text-text-muted">Schema</dt>
            <dd className="font-mono text-text">{schema.id} (v{schema.schemaVersion})</dd>
            <dt className="text-text-muted">Fields</dt>
            <dd className="font-mono text-text">{session.layout.length}</dd>
            <dt className="text-text-muted">Checksums</dt>
            <dd className="font-mono text-text">{schema.checksums?.length ?? 0}</dd>
          </dl>
          <HexViewer data={previewBytes ?? new Uint8Array(session.originalBuffer)} />
          <p className="text-xs text-text-faint">
            {previewBytes ? 'Showing the most recently exported buffer.' : 'Showing the original, unmodified buffer — export once to preview patched bytes.'}
          </p>
        </div>
      )}

      <div className="sticky bottom-4 z-10 mt-8 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-bg-panel/95 p-4 shadow-panel backdrop-blur">
        <Button variant="secondary" onClick={handleBackup}>
          Download Backup Original
        </Button>
        <Button variant="primary" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting…' : 'Export Save'}
        </Button>
      </div>
    </div>
  );
}
