import type { FingerprintAnalysis } from '../../core/fingerprint/fingerprint-engine';
import { Button } from './Button';
import { DiagnosticsPanel } from './DiagnosticsPanel';

interface UnknownFormatScreenProps {
  fileName: string;
  fileSize: number;
  analysis: FingerprintAnalysis;
  onTryAnother: () => void;
}

export function UnknownFormatScreen({ fileName, fileSize, analysis, onTryAnother }: UnknownFormatScreenProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-warning/30 bg-warning/[0.04] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-text">This format is currently unknown</h2>
        <p className="mt-2 text-sm text-text-muted">
          We don&apos;t have a community schema for this save yet — this doesn&apos;t mean the file is corrupted, only
          that nothing in the loaded schema repository matched it confidently.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Please contact <strong className="text-text">dislopik</strong> on Discord if you&apos;d like this game
          supported, and include the game name, platform, and version if known. Community schemas can be added to
          support additional games without an app update.
        </p>
      </div>

      <div className="mt-6">
        <DiagnosticsPanel fileName={fileName} fileSize={fileSize} analysis={analysis} />
      </div>

      <div className="mt-6 flex justify-center">
        <Button variant="secondary" onClick={onTryAnother}>
          Try Another Save
        </Button>
      </div>
    </div>
  );
}
