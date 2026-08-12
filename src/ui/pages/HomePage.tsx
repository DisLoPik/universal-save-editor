import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { FileSummary } from '../components/FileSummary';
import { UnknownFormatScreen } from '../components/UnknownFormatScreen';
import { EditorPage } from './EditorPage';
import { useSchemasStore } from '../../app/schemas-store';
import { useEditorStore } from '../../editor/editor-store';
import { analyzeFile } from '../../app/analyze-file';
import type { FingerprintAnalysis } from '../../core/fingerprint/fingerprint-engine';

type FlowState = 'idle' | 'analyzing' | 'unknown' | 'matched';

export function HomePage() {
  const schemas = useSchemasStore((s) => s.schemas);
  const schemasStatus = useSchemasStore((s) => s.status);
  const schemasError = useSchemasStore((s) => s.error);
  const loadSession = useEditorStore((s) => s.loadSession);
  const clearSession = useEditorStore((s) => s.clearSession);
  const session = useEditorStore((s) => s.session);

  const [flow, setFlow] = useState<FlowState>('idle');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [analysis, setAnalysis] = useState<FingerprintAnalysis | null>(null);

  const handleFile = async (file: File) => {
    setFlow('analyzing');
    setFileName(file.name);
    setFileSize(file.size);
    try {
      const result = await analyzeFile(file, schemas);
      setAnalysis(result.analysis);
      if (result.session) {
        const { values } = result.session.readInitialValues();
        loadSession(result.session, values);
        setFlow('matched');
      } else {
        setFlow('unknown');
      }
    } catch (e) {
      console.error('Failed to analyze file', e);
      setFlow('unknown');
      setAnalysis({
        bestMatch: null,
        allMatches: [],
        ambiguous: false,
        fileSize: file.size,
        sha256: '',
        sha1: '',
      });
    }
  };

  const reset = () => {
    clearSession();
    setFlow('idle');
    setFileName('');
    setFileSize(0);
    setAnalysis(null);
  };

  if (flow === 'matched' && session) {
    return <EditorPage onBack={reset} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {flow === 'idle' && (
        <>
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">Universal Save Editor</h1>
            <p className="mx-auto mt-3 max-w-xl text-text-muted">
              Drop in a game save file and edit it right here — fingerprinted, validated, and patched entirely in
              your browser. Nothing is ever uploaded.
            </p>
          </div>
          <Dropzone onFile={handleFile} disabled={schemasStatus === 'loading'} />
          {schemasStatus === 'loading' && (
            <p className="mt-3 text-center text-xs text-text-faint">Loading community schema repository…</p>
          )}
          {schemasStatus === 'error' && (
            <p className="mt-3 text-center text-xs text-danger">
              Failed to load the schema repository{schemasError ? `: ${schemasError}` : ''}. You can still drop a
              file, but it likely won&apos;t be recognized until this is resolved.
            </p>
          )}
          {schemasStatus === 'loaded' && (
            <p className="mt-3 text-center text-xs text-text-faint">
              {schemas.length} game{schemas.length === 1 ? '' : 's'} supported —{' '}
              <Link to="/supported-games" className="underline decoration-dotted underline-offset-2 hover:text-accent-hover">
                browse the list
              </Link>
              .
            </p>
          )}
        </>
      )}

      {flow === 'analyzing' && (
        <div className="mx-auto max-w-md">
          <FileSummary fileName={fileName} fileSize={fileSize} status="analyzing" onRemove={reset} />
        </div>
      )}

      {flow === 'unknown' && analysis && (
        <UnknownFormatScreen fileName={fileName} fileSize={fileSize} analysis={analysis} onTryAnother={reset} />
      )}
    </div>
  );
}
