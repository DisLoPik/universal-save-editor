export function Footer() {
  return (
    <footer className="border-t border-border/80 py-8 text-sm text-text-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center sm:px-6">
        <p>
          Everything runs in your browser. Save files are never uploaded anywhere.
        </p>
        <p>
          Want a game supported?{' '}
          <span className="text-text">Contact <strong className="text-accent-hover">dislopik</strong> on Discord</span>, or contribute a
          schema — see the <a href="/docs" className="underline decoration-dotted underline-offset-2 hover:text-accent-hover">docs</a>.
        </p>
        <p className="text-text-faint">Universal Save Editor &middot; MIT licensed</p>
      </div>
    </footer>
  );
}
