# Universal Save Editor

A production-quality, **community-schema-driven** browser save editor. Drag in a game save file, and the app
fingerprints it, identifies the game (when a schema is available), and lets you edit and re-export it — entirely in
your browser. Supporting a new game means writing a JSON schema and opening a PR, not shipping a new version of the
app: **the application contains no game-specific code.**

```text
User Save File → Browser File API → Binary Parser/Fingerprinter → Schema Matcher →
Schema Definition → Save Editor UI → Modified Binary → Download
```

Everything runs client-side. A save file is never uploaded anywhere, to this app's own infrastructure or to any
third party — the whole thing is a static site and can be hosted as one (see [Deploying to
Cloudflare](#deploying-to-cloudflare) below).

## Quick start

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
npm run test      # run the automated test suite (Vitest)
npm run typecheck # tsc --noEmit only
```

> Verified in this repository: `npx tsc --noEmit` is clean, the full Vitest suite passes, `npm run build` succeeds,
> and `npm run dev`/`npm run preview` serve correctly (including the static `/schemas/index.json` endpoint and SPA
> client-side routing). Re-run these yourself after pulling changes — see `npm run test` above.

## Project structure

```text
src/
  core/            game-agnostic engine — no UI, no game-specific logic
    binary/        BinaryReader/BinaryWriter (bounds-checked), offset parsing
    hash/          SHA-256/SHA-1 via Web Crypto (browser- and Cloudflare-safe)
    fingerprint/   confidence-scored fingerprint matching engine
    schema/        schema types + zod-based formal validator + offset resolution
    field/         generic field layout + read/write codec for every field type
    transform/     declarative (non-eval) value transformation pipeline
    checksum/      CRC8/16/32 (parameterized), Adler-32, sum, XOR
    encryption/    RC4/XOR (custom) + AES-CBC/CTR (Web Crypto) decrypt-on-load / encrypt-on-export
    validation/    post-edit value validation against schema constraints
    session/       SaveSession — ties the whole per-file pipeline together
  schemas-repo/    schema index/repository fetching + IndexedDB caching
  workers/         Web Worker (+ client) that runs fingerprinting off the UI thread
  editor/          undo/redo history + the Zustand editor state store
  app/             app-level stores (loaded schemas, settings) and the analyze-file pipeline
  ui/              React components and pages (dark, static-site-friendly)
schemas/           the community schema repository (see docs/schema-authoring.md)
docs/              schema authoring guide, contributing guide, example walkthrough
tests/             Vitest suite (core engine, schema validation, editor store)
```

The `core/` layer has no dependency on React or the DOM (aside from Web Crypto/IndexedDB, which are standard Web
APIs available in Workers too) — it's reusable from a CLI, a desktop shell, or tests without modification.

## How it works

1. **Fingerprinting.** Every schema declares one or more fingerprint rule sets (file size, byte patterns with
   wildcards, strings, exact SHA-256/SHA-1, CRC32-over-a-range, a self-consistent checksum match, or — for formats
   encrypted at rest — a trial-decrypt-then-check-magic rule). Rules within a set are AND'd; sets are OR'd across a
   schema. Each matched rule contributes a confidence weight. **The app never guesses** — below a confidence
   threshold, or on a tie between two schemas, the user gets an "unknown format" screen with diagnostics and a copy
   button, never a wrong match.
2. **Decryption.** If the matched schema declares `encryption`, the relevant region(s) are decrypted (RC4, XOR, or
   AES-CBC/CTR via the browser's native Web Crypto) before anything else touches the data.
3. **Schema-driven fields.** Every offset, field type, transform, and checksum comes from the matched schema's JSON
   — see `docs/schema-authoring.md` for the full format. Structs and arrays are pure organization; only leaf fields
   store values. Most fields resolve their absolute offset statically from the schema alone; fields in name-tagged
   serialization formats (e.g. Unreal Engine's GVAS saves) can instead be *searched for* by name at read time.
4. **Editing.** Field edits go through a small undo/redo history and live validation (`min`/`max`, string length,
   enum membership, bitfield range) before export is allowed.
5. **Export.** A modified copy is patched onto a fresh clone of the *decrypted* bytes (the original file buffer is
   never mutated), every declared checksum is recalculated, the result is re-encrypted if the schema declares
   encryption, and it downloads as `<name>_edited<ext>`. A "Download Backup Original" button is always available.

## Real games supported today

Most bundled schemas are deliberately fictional (see `docs/examples.md`) to demonstrate engine features without
risking a wrong offset in someone's real save. Two are real, both built from public documentation/source and
explicitly marked with their confidence level and sourcing in the schema's own `description` field — **neither has
been tested against an actual captured save file**, so please report back (or open a PR) if you try one and it needs
correcting:

- **Pokémon Diamond/Pearl (Nintendo DS)** — fixed-offset trainer data, CRC16-checksum-protected, unencrypted.
- **LEGO Batman: Legacy of the Dark Knight (PC/Steam)** — RC4-encrypted Unreal Engine "GVAS" save; the RC4 key and
  the one supported field (Studs Collected) were verified directly against the source code of an existing
  open-source save editor for this exact game. Deliberately scoped to just that field — the same reference tool also
  edits collectible unlock flags via variable-length string swaps this engine doesn't (yet) support safely.

Several other formats were researched and deliberately **not** shipped this round, with reasons documented in
`docs/schema-authoring.md`/commit history: 3DS-generation Pokémon (needs an LCRNG shuffle transform), PS1/PS2 (the
container format holds multiple saves per file, which the engine doesn't yet model), Switch saves like Animal
Crossing: New Horizons (key derivation needs a faithful Nintendo SEADRandom PRNG port, unverifiable without a real
sample file), and Wii/Wii U (Wii's save encryption key is real, long-public, and used by legitimate community
backup tools, but embedding a reverse-engineered platform key is a deliberate judgment call left to a maintainer
rather than a default; Wii U saves are genuinely console-bound and impractical to support at all).

## Community editors

Separate from the schema-driven engine above, `/community-editors` bundles 20 standalone, game-specific save
editors vendored from [marcrobledo/savegame-editors](https://github.com/marcrobledo/savegame-editors) (MIT
licensed, Copyright (c) 2017-2023 Marc Robledo, with `nintendogs+cats` and `the-lego-movie-videogame` credited to
[Magiczocker](https://github.com/magiczocker10)). These are full bespoke tools — plain HTML/CSS/JS, no schema, no
shared engine — kept as close to their upstream form as possible and still 100% client-side. See
`public/community-editors/NOTICE.md` for the exact (small) set of changes made so they run on this deployment
(dropped a stale service-worker registration that hardcoded the upstream site's own paths, fixed an author-credit
link that pointed at `/`, self-hosted one CDN script dependency, and excluded a few personal sample-save files that
turned out not to be required by the tools). Because these editors rely on inline event-handler attributes, they
get their own relaxed `script-src` in `public/_headers` scoped to `/community-editors/*` only — the rest of the
site keeps the strict policy described below.

## Security posture

- No `eval`, no arbitrary expression evaluation from schema data — transformations are a fixed, whitelisted,
  declarative step list (see `src/core/transform/transformation-engine.ts`).
- Every community schema is validated (zod-based formal schema + cross-reference checks) before it's used to read a
  single byte; invalid schemas are rejected outright.
- All binary reads/writes are bounds-checked (`BinaryReader`/`BinaryWriter`) and raise a catchable error rather than
  corrupting memory or crashing on malformed/adversarial schema offsets.
- Save files are read with the browser File API and processed in memory (optionally on a Web Worker); nothing is
  uploaded without explicit user action (there is no upload path for save data at all, only downloads).

## Deploying to Cloudflare

This is a 100% static site — no server-side Worker code, just prebuilt HTML/JS/CSS/JSON. **Which exact setup steps
apply depends on which Cloudflare project type you end up with**, which varies by account: Cloudflare has been
merging "Pages" and "Workers" into one product, and depending on your account, going through **Workers & Pages →
Create → Pages → Connect to Git** can actually provision either a classic Pages project or a Worker with a static
assets binding. Check which one you got before following the steps below — open the project in the dashboard: if
the tabs are *Overview / Metrics / Deployments / **Bindings** / Observability / Domains / Settings* and it shows
"Bindings", "Queues", it's a **Worker**; if there's no Bindings tab and it instead shows a "Custom domains" tab
alongside a plain "Deployments" list, it's classic **Pages**.

### If it's a Worker (with static assets) — has a "Bindings" tab

This repo's `wrangler.toml` is already configured for this case (a `name`, `compatibility_date`, and an `[assets]`
block pointing at `./dist`, with `not_found_handling = "single-page-application"` so client-side routes like `/docs`
fall back to `index.html` instead of 404ing). **There is deliberately no `public/_redirects` file** — Workers assets
processes `_redirects` too, and a classic Pages-style `/* /index.html 200` catch-all rule actively conflicts with
`not_found_handling`'s own URL normalization, which Cloudflare rejects at deploy time as an infinite-redirect-loop
config error. If you ever add a `_redirects` file back for some other purpose, keep it to specific paths, not a
blanket `/*` catch-all — `not_found_handling` already covers the SPA-fallback case entirely on its own.

1. In the project → **Settings → Builds & deployments**:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (no flags needed — everything comes from `wrangler.toml`)
2. Under **Settings → Builds & deployments → API Token**, you need a token with **Account → Cloudflare Pages → Edit**
   permission at minimum (create one at https://dash.cloudflare.com/profile/api-tokens if the field shows
   "unavailable") — an account role of Super Administrator does **not** substitute for this; the token itself needs
   the permission explicitly checked when it's created, and API tokens can also be broken by a Client IP Address
   Filter that doesn't include Cloudflare's build servers, so leave that filter empty.
3. Save, retry the deployment.
4. Once it deploys, the **Domains** tab will likely show "No URLs enabled" — enable a `*.workers.dev` URL there, or
   skip straight to attaching your own domain (same tab), for the site to actually be reachable.

CLI equivalent, run locally after `npm run build`:

```bash
npx wrangler deploy
```

### If it's classic Pages — has a "Custom domains" tab, no Bindings

1. Build command: `npm run build`
2. Build output directory: `dist`
3. Deploy command: leave blank — classic Pages uploads the build output directory directly, no `wrangler` step
   needed. If one is already saved from switching between project types, clear it.
4. No `wrangler.toml` is needed for this path — its presence can actually cause Cloudflare's build pipeline to try
   running a Worker-style deploy instead of the plain Pages upload, so keep it deleted if you're on this path.
5. Classic Pages does **not** auto-fallback to `index.html` for client-side routes the way this repo's
   `wrangler.toml` does for the Worker path — add a `public/_redirects` file containing `/* /index.html 200` if
   you're on classic Pages and want `/docs`, `/supported-games`, etc. to work on a hard refresh or a shared link.

CLI equivalent:

```bash
npm run build
npx wrangler pages deploy dist --project-name=<your-project-name>
```

### Updating schemas without redeploying the app

By default the app fetches `schemas/index.json` from its own origin (`/schemas`), which *does* redeploy with the
app. To let the community publish new schemas independently of app releases, point the schema base URL at an
external location instead (Settings section on the About page, or `useSettingsStore`) — e.g. a CDN mirror of a
separate schemas git repo — no app code change or redeploy required, just a config value.

## License

MIT — see `LICENSE`. Community schema files may carry their own `license` metadata field.

## Contact

Want a game supported, or have a schema question? Contact **dislopik** on Discord. See `docs/contributing.md` for
the full contribution workflow.
