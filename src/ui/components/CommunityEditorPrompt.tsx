import { Button } from './Button';
import { formatBytes } from '../../utils/bytes';

interface CommunityEditorPromptProps {
  fileName: string;
  fileSize: number;
  game: string;
  slug: string;
  onCancel: () => void;
}

export function CommunityEditorPrompt({ fileName, fileSize, game, slug, onCancel }: CommunityEditorPromptProps) {
  const href = `/community-editors/${slug}/`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 17 17 7M17 7H9M17 7v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-text">This looks like a {game} save</h2>
        <p className="mt-2 text-sm text-text-muted">
          This app doesn&apos;t have an inline field editor for {game} — instead, there&apos;s a dedicated{' '}
          <strong className="text-text">community editor</strong> for it, bundled with this site.
        </p>
        <p className="mt-4 text-sm font-medium text-text">You are being redirected to a community editor. Continue?</p>
        <p className="mt-1 text-xs text-text-faint">
          {fileName} &middot; {formatBytes(fileSize)}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => window.location.assign(href)}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
