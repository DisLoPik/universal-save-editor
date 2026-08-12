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
third party — the whole thing is a static site and can be hosted as one (see [Deploying to Cloudflare
Pages](#deploying-to-cloudflare-pages) below).

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

## Security posture

- No `eval`, no arbitrary expression evaluation from schema data — transformations are a fixed, whitelisted,
  declarative step list (see `src/core/transform/transformation-engine.ts`).
- Every community schema is validated (zod-based formal schema + cross-reference checks) before it's used to read a
  single byte; invalid schemas are rejected outright.
- All binary reads/writes are bounds-checked (`BinaryReader`/`BinaryWriter`) and raise a catchable error rather than
  corrupting memory or crashing on malformed/adversarial schema offsets.
- Save files are read with the browser File API and processed in memory (optionally on a Web Worker); nothing is
  uploaded without explicit user action (there is no upload path for save data at all, only downloads).


## License

MIT — see `LICENSE`. Community schema files may carry their own `license` metadata field.

## Contact

Want a game supported, or have a schema question? Contact **dislopik** on Discord. See `docs/contributing.md` for
the full contribution workflow.
