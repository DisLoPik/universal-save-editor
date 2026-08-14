# Community Editors — third-party code notice

The editors in this directory are **not** part of Universal Save Editor's own
schema-driven engine. They are vendored, mostly as-is, from
[marcrobledo/savegame-editors](https://github.com/marcrobledo/savegame-editors)
(MIT licensed, Copyright (c) 2017-2023 Marc Robledo), a separate collection of
standalone, game-specific browser save editors built with plain HTML/CSS/JS.
Individual games are credited to their original author in each editor's own
page (most to Marc Robledo; `nintendogs+cats` and `the-lego-movie-videogame`
to [Magiczocker](https://github.com/magiczocker10)). See
[`LICENSE-savegame-editors.txt`](./LICENSE-savegame-editors.txt) for the full
license text, which also covers the bundled [Octicons](https://github.com/primer/octicons/)
icon set.

`zelda-totk/lib/fflate.min.js` vendors [fflate](https://github.com/101arrowz/fflate)
0.8.0 (MIT licensed), self-hosted here instead of loaded from `unpkg.com` (see
below).

Most games also bundle a small sample save file (e.g. `progress.sav`,
`APP.BIN`, `savedata.dat` — whatever that game's own expected filename is).
These aren't test leftovers: `savegame-editor.js`'s shared "Try an example
savegame" button fetches that exact file, so every editor can offer a
one-click demo. They're kept as shipped.

## What was changed for this deployment

Everything else — every game's HTML structure, CSS, and JS logic — is
untouched. The following changes were made only so the tools work correctly
when served from this site's Cloudflare Worker instead of the upstream site:

- **Removed the per-editor service worker registration.** Every game shipped
  an inline `<script>` that registered `_cache_service_worker.js` for offline
  caching, using paths hardcoded to the upstream site's own `/savegame-editors/<game>/`
  layout. Those paths don't exist on this domain, this project doesn't use
  service workers anywhere else, and the stale `_cache_service_worker.js`
  files themselves were dropped along with it.
- **Fixed the "by Marc Robledo" / "by Magiczocker" credit link.** It pointed
  at `/`, the root of the upstream site (a gallery of all of Marc Robledo's
  editors). On this domain that would silently point back at this site's own
  homepage instead, so it now links to the author's GitHub directly.
- **Self-hosted `fflate`** (`zelda-totk`'s only external dependency, previously
  loaded from `unpkg.com`) as `zelda-totk/lib/fflate.min.js`, since this
  site's Content-Security-Policy doesn't allow loading scripts from third-party
  CDNs.
- **Relaxed this site's Content-Security-Policy for this one path only**
  (see `/public/_headers`). These editors rely on inline `onclick`-style
  event handlers throughout, which the main app's strict
  `script-src 'self'` policy would silently break. `/community-editors/*`
  gets its own policy that adds `'unsafe-inline'` to `script-src`; the rest
  of the site (including the main schema-driven editor) is unaffected.

Nothing here uploads a save file anywhere — like the rest of this site, these
editors run entirely client-side.
