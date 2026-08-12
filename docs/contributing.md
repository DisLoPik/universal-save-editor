# Contributing

There are two very different kinds of contribution here, and they have very different bars:

1. **A schema** for a game (a JSON file — no app code). This is the main way the project grows, and it's the
   contribution we most want.
2. **Application code** (the fingerprinting/schema/checksum engine, the editor UI, etc.).

## Contributing a schema

1. **Analyze the save.** Figure out the file's magic bytes/header, its size (fixed or variable?), and locate a
   handful of fields by trial and error — change a value in-game, save, diff the file against a previous save. A hex
   editor and the app's own built-in debug hex viewer (drop any file into the app, then toggle debug mode) both help
   here.
2. **Create a JSON schema** following `docs/schema-authoring.md`. Start minimal — a magic-byte fingerprint and one or
   two fields — and grow it once the basics are matching correctly.
3. **Test it locally**: `npm run dev`, drop in a real save, confirm it's identified with reasonable confidence, edit
   a field, export, and make sure the game itself still loads the exported save correctly. This last step (actually
   loading it back in the game) is the one automated tests can't do for you — always do it by hand at least once.
4. **Submit it**: open a pull request adding your schema file under `schemas/<platform>/<game>/<variant>.json` and an
   entry in `schemas/index.json`. Include in the PR description: which game/platform/region/version you tested
   against, and ideally a screenshot of the editor working against a real save.
5. **Once merged and published**, every user of the app automatically gets support for your game — no app update
   required, because the app fetches the schema repository independently of its own release cycle.

### What makes a good schema PR

- Real offsets, verified against a real save file you tested — not guessed or copied from unrelated formats.
- Fingerprints specific enough not to falsely match unrelated files (prefer combining file size + a magic byte
  pattern over file size alone).
- Sensible `min`/`max` on numeric fields (matches whatever legitimate range the game itself allows), so the app can
  stop obviously-invalid edits before they're written.
- A `license` and `author` in the schema's metadata.
- If the format has a checksum, declare it — don't ship a schema that produces saves the game will reject.

### What we can't accept

- Offsets you're not confident are correct, presented as if verified — see the note in the project's example
  schemas: fabricated offsets for a real commercial game, presented as fact, are actively harmful (they cause
  players to corrupt real save files). If you're not sure, say so in the PR.
- Anything that requires uploading a user's save file to a third-party service to work. Everything must run
  client-side.

## Contributing application code

The core engine (`src/core/*`) is deliberately game-agnostic — it should never gain an `if (schema.game === "X")`
branch. If you're fixing a bug or adding a capability, it should show up as a new *declarative* schema capability
(a new field type, transform step, or checksum algorithm), not a special case.

- `npm install`, `npm run dev` to run locally.
- `npm run typecheck` and `npm run test` before opening a PR.
- Add or update tests under `tests/` for anything in `src/core`, `src/editor`, or `src/schemas-repo` — those are the
  parts every schema depends on.

## Questions / requesting a game

Not comfortable writing a schema yourself, or want a specific game supported? Contact **dislopik** on Discord with
the game name, platform, and version (and a save file if you're able to share one) — schema requests and questions
about the format are welcome there.
