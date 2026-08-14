import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchemasStore } from '../../app/schemas-store';
import { Badge } from '../components/Badge';

export function SupportedGamesPage() {
  const schemas = useSchemasStore((s) => s.schemas);
  const status = useSchemasStore((s) => s.status);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return schemas;
    return schemas.filter((s) =>
      [s.game, s.platform, s.region, s.version, s.author, s.id].filter(Boolean).some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [schemas, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof schemas>();
    for (const schema of filtered) {
      const key = schema.game;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(schema);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-text">Supported Games</h1>
      <p className="mt-2 text-sm text-text-muted">
        Every game with a community schema currently loaded from the repository. Search by game, platform, region,
        version, or author. A <strong className="text-text">Community editor</strong> badge means the game is
        recognized but edited through a standalone tool under{' '}
        <Link to="/community-editors" className="text-accent-hover underline decoration-dotted underline-offset-2">
          Community Editors
        </Link>{' '}
        instead of the inline field editor.
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search games, platforms, regions, versions…"
        className="mt-5 w-full rounded-lg border border-border bg-bg-inset px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
      />

      {status === 'loading' && <p className="mt-6 text-sm text-text-muted">Loading schema repository…</p>}
      {status === 'loaded' && grouped.length === 0 && <p className="mt-6 text-sm text-text-muted">No games match your search.</p>}

      <div className="mt-6 space-y-4">
        {grouped.map(([game, entries]) => (
          <div key={game} className="rounded-xl border border-border bg-bg-panel p-5">
            <h2 className="text-base font-semibold text-text">{game}</h2>
            <div className="mt-3 space-y-2">
              {entries.map((schema) => (
                <div
                  key={schema.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-bg-inset px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{schema.platform}</Badge>
                    {schema.region && <Badge tone="neutral">{schema.region}</Badge>}
                    {schema.version && <Badge tone="neutral">v{schema.version}</Badge>}
                    {schema.communityEditor && (
                      <a href={`/community-editors/${schema.communityEditor.slug}/`} title="Opens a standalone community editor, not the inline field editor above">
                        <Badge tone="warning">Community editor ↗</Badge>
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-text-faint">
                    {schema.author && <span>by {schema.author} • </span>}
                    {schema.lastUpdated && <span>updated {schema.lastUpdated}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
