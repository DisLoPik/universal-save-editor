import { useState } from 'react';
import { formatBytes } from '../../utils/bytes';
import type { FingerprintAnalysis } from '../../core/fingerprint/fingerprint-engine';
import { Badge, confidenceTone } from './Badge';
import { Button } from './Button';

interface DiagnosticsPanelProps {
  fileName: string;
  fileSize: number;
  analysis: FingerprintAnalysis;
}

function buildDiagnosticsText(props: DiagnosticsPanelProps): string {
  const { fileName, fileSize, analysis } = props;
  const lines = [
    `File name: ${fileName}`,
    `File size: ${fileSize} bytes (${formatBytes(fileSize)})`,
    `SHA-256: ${analysis.sha256}`,
    `SHA-1: ${analysis.sha1}`,
    '',
    analysis.allMatches.length > 0 ? 'Closest candidates:' : 'No schema produced any partial fingerprint match.',
    ...analysis.allMatches
      .slice(0, 5)
      .map((m) => `  - ${m.schema.game} (${m.schema.platform}${m.schema.region ? `, ${m.schema.region}` : ''}) — schema "${m.schema.id}" — confidence ${m.score}%`),
  ];
  return lines.join('\n');
}

export function DiagnosticsPanel({ fileName, fileSize, analysis }: DiagnosticsPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = buildDiagnosticsText({ fileName, fileSize, analysis });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context); fail silently, the info is still visible on screen.
    }
  };

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">Diagnostic Information</h3>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy Diagnostics'}
        </Button>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-text-muted">File</dt>
        <dd className="truncate font-mono text-text" title={fileName}>{fileName}</dd>
        <dt className="text-text-muted">Size</dt>
        <dd className="font-mono text-text">{fileSize.toLocaleString()} bytes ({formatBytes(fileSize)})</dd>
        <dt className="text-text-muted">SHA-256</dt>
        <dd className="break-all font-mono text-xs text-text">{analysis.sha256}</dd>
        <dt className="text-text-muted">SHA-1</dt>
        <dd className="break-all font-mono text-xs text-text">{analysis.sha1}</dd>
      </dl>

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-faint">Fingerprint analysis</h4>
        {analysis.allMatches.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No loaded schema matched any part of this file.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {analysis.allMatches.slice(0, 5).map((m) => (
              <li key={m.schema.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-bg-inset px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text">{m.schema.game}</p>
                  <p className="truncate text-xs text-text-muted">
                    {m.schema.platform}
                    {m.schema.region ? ` • ${m.schema.region}` : ''} • {m.schema.id}
                  </p>
                </div>
                <Badge tone={confidenceTone(m.score)}>{m.score}%</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
