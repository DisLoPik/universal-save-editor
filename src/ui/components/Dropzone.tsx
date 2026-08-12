import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';

interface DropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function Dropzone({ onFile, disabled }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      if (disabled) return;
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [disabled, onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragActive(true);
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={handleDrop}
      className={`group relative flex min-h-[280px] w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
        disabled
          ? 'cursor-not-allowed border-border/60 opacity-60'
          : isDragActive
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent/60 hover:bg-bg-raised/40'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-raised text-accent transition-transform group-hover:scale-105">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-medium text-text">Drop a save file here</p>
        <p className="mt-1 text-sm text-text-muted">or click to browse — any file type, any size</p>
      </div>
      <p className="max-w-sm text-xs text-text-faint">
        Nothing leaves your device. The file is read and identified entirely in your browser.
      </p>
    </div>
  );
}
