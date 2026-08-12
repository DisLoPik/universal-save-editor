import { formatBytes } from '../../utils/bytes';
import { Button } from './Button';

interface FileSummaryProps {
  fileName: string;
  fileSize: number;
  status: 'analyzing' | 'done';
  onRemove: () => void;
}

export function FileSummary({ fileName, fileSize, status, onRemove }: FileSummaryProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-panel px-5 py-4 shadow-panel">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-raised text-accent">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M15 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-text-muted">{formatBytes(fileSize)}</p>
        </div>
      </div>
      {status === 'analyzing' ? (
        <div className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" />
          Analyzing…
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      )}
    </div>
  );
}
