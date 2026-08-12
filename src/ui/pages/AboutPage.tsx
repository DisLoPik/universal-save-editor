import { useState } from 'react';
import { useSchemasStore } from '../../app/schemas-store';
import { useSettingsStore } from '../../app/settings-store';
import { DEFAULT_SCHEMA_BASE_URL } from '../../schemas-repo/schema-loader';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

function SchemaSourceSettings() {
  const schemaBaseUrl = useSettingsStore((s) => s.schemaBaseUrl);
  const setSchemaBaseUrl = useSettingsStore((s) => s.setSchemaBaseUrl);
  const resetSchemaBaseUrl = useSettingsStore((s) => s.resetSchemaBaseUrl);
  const status = useSchemasStore((s) => s.status);
  const source = useSchemasStore((s) => s.source);
  const schemaCount = useSchemasStore((s) => s.schemas.length);
  const invalidCount = useSchemasStore((s) => s.invalid.length);
  const load = useSchemasStore((s) => s.load);

  const [draft, setDraft] = useState(schemaBaseUrl);
  const isDefault = schemaBaseUrl === DEFAULT_SCHEMA_BASE_URL;

  const apply = () => {
    setSchemaBaseUrl(draft);
    load(draft.trim() || DEFAULT_SCHEMA_BASE_URL);
  };

  return (
    <section>
      <h2 className="text-base font-semibold text-text">Schema source</h2>
      <p className="mt-2">
        Where the app loads the community schema repository index from. Defaults to this deployment's own{' '}
        <code>/schemas</code>, but can point at any other origin (a CDN mirror of the schemas git repo, for example)
        so new schemas can be published without a new app deployment.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={DEFAULT_SCHEMA_BASE_URL}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg-inset px-3 py-1.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        <Button size="sm" variant="secondary" onClick={apply}>
          Apply &amp; reload schemas
        </Button>
        {!isDefault && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              resetSchemaBaseUrl();
              setDraft(DEFAULT_SCHEMA_BASE_URL);
              load(DEFAULT_SCHEMA_BASE_URL);
            }}
          >
            Reset to default
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-faint">
        <Badge tone={status === 'error' ? 'danger' : status === 'loaded' ? 'success' : 'neutral'}>{status}</Badge>
        {status === 'loaded' && (
          <span>
            {schemaCount} schema{schemaCount === 1 ? '' : 's'} loaded from {source}
            {invalidCount > 0 ? ` (${invalidCount} rejected — see console)` : ''}
          </span>
        )}
      </div>
    </section>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-text">About</h1>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-text-muted">
        <section>
          <h2 className="text-base font-semibold text-text">What this is</h2>
          <p className="mt-2">
            Universal Save Editor is a generic, schema-driven save file editor. The application itself contains no
            game-specific logic — every offset, field, checksum, and fingerprint comes from a community-contributed
            JSON schema. Supporting a new game means writing a schema, not shipping a new app version.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text">Everything happens locally</h2>
          <p className="mt-2">
            Your save file never leaves your device. It's read with the browser's File API, fingerprinted and edited
            entirely in memory (optionally on a background Web Worker), and the modified copy is handed back to you
            as a download — there is no upload step, no server-side processing, and no third-party service ever sees
            your save data. This app can (and is meant to) run as a fully static site.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text">How identification works</h2>
          <p className="mt-2">
            Each schema declares its own fingerprints — file size, byte patterns (with wildcards), strings, exact
            SHA-256/SHA-1 hashes, or CRC32 over a range — with a confidence weight per rule. The app never guesses:
            if nothing clears the confidence threshold, or two schemas tie, you get the "unknown format" screen
            instead of a wrong match.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text">Contributing a schema</h2>
          <p className="mt-2">
            See the <a href="/docs" className="text-accent-hover underline decoration-dotted underline-offset-2">docs</a> for
            the full schema format and authoring guide. Want a specific game supported, or have questions about a
            schema you're writing? Contact <strong className="text-text">dislopik</strong> on Discord.
          </p>
        </section>

        <SchemaSourceSettings />
      </div>
    </div>
  );
}
