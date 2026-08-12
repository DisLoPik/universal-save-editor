# Schema Authoring Guide

A **schema** is a single JSON file that fully describes one save-format variant: how to recognize it, how to read its
data, how to display it, how to validate edits, and how to write it back. The application itself contains **no
game-specific code** — everything a game needs comes from its schema file. This is the entire point of the project:
supporting a new game means writing a schema and opening a PR, not shipping a new version of the app.

This document is the full reference. The same content, in a more skimmable form, is also available at `/docs` inside
the running app.

## Where schemas live

```text
schemas/
├── index.json                 <- the repository index; the app fetches this first
├── nintendo-3ds/
│   └── pixel-quest/
│       └── usa-v1.json
├── nintendo-ds/
│   └── pokemon-diamond-pearl/
│       └── usa-v1.json        <- real game
├── gbc/
│   └── iron-keep/
│       └── usa-v1.json
└── pc/
    ├── star-forge/
    │   └── v1.json
    └── lego-batman-lotdk/
        └── steam-v1.json      <- real game, RC4-encrypted
```

`schemas/index.json` lists every schema's `id` and file `path`, relative to the `schemas/` directory:

```json
{
  "schemaVersion": 1,
  "schemas": [{ "id": "pixel-quest-3ds-usa-v1", "path": "nintendo-3ds/pixel-quest/usa-v1.json" }]
}
```

The app fetches this index (and the schemas it references) at runtime from `/schemas` by default — or from any other
URL a deployment configures — so publishing a new schema does **not** require a new app build or deployment.

## Schema structure

```json
{
  "id": "example-quest-3ds-usa-v1",
  "game": "Example Quest",
  "platform": "Nintendo 3DS",
  "region": "USA",
  "version": "1.0.0",
  "author": "your-name",
  "license": "MIT",
  "description": "One-line summary of the game/format.",
  "lastUpdated": "2026-08-11",
  "schemaVersion": 1,

  "fingerprints": [ /* how to recognize this save — required, at least one */ ],
  "baseOffsets": { "slot2": "0x2000" },
  "groups": [{ "id": "player", "name": "Player", "order": 0 }],
  "fields": [ /* what to read/display/edit — required, at least one */ ],
  "checksums": [ /* optional — recalculated automatically on export */ ]
}
```

- `id` must be **kebab-case** and unique across the whole repository. Convention: `game-platform-region-version`.
- `schemaVersion` is the schema *format* version this file was authored against (currently `1`), not your schema's
  own revision — bump `version`/`lastUpdated` for that.

## Fingerprints

`fingerprints` is a list of independent **sets**. A save matches a set only if **every** rule inside it matches
(logical AND). A schema matches if **any** of its sets fully match (logical OR across sets) — useful when one game
has several regional or version-specific layouts that should all resolve to variants of "the same game."

```json
"fingerprints": [
  {
    "id": "usa-v1",
    "rules": [
      { "type": "fileSize", "value": 524288 },
      { "type": "bytes", "offset": "0x0", "value": "45 58 41 4D ?? ??" },
      { "type": "string", "offset": "0x10", "value": "EXAMPLEQUEST", "encoding": "ascii" }
    ]
  }
]
```

Rule types:

| Type | Matches on | Default weight |
| --- | --- | --- |
| `fileSize` | exact byte length (`tolerance` allowed) | 10 (low) |
| `bytes` | byte pattern at an offset; `??` is a wildcard byte | 30 (medium) |
| `string` | ASCII/UTF-8 text at an offset | 25 (medium) |
| `sha256` | exact SHA-256 of the whole file | 100 (very high) |
| `sha1` | exact SHA-1 of the whole file | 90 (very high) |
| `crc32` | CRC32 over a byte range equals a fixed value | 60 (high) |
| `checksumMatch` | any checksum algorithm over a range equals the value stored elsewhere in the file | 50 (medium-high) |
| `decryptedBytes` | trial-decrypt a region, then check for a byte pattern in the result | 70 (high) |
| `allOf` | nested AND group of sub-rules | sum of matched sub-rules |
| `anyOf` | nested OR group of sub-rules | best matched sub-rule |

Every matched rule in a set contributes its weight; the set's score is the sum, capped at 100. **The app never
guesses**: if the best-scoring schema doesn't clear the confidence threshold (50 by default), or if two schemas tie
for the top score, the user gets the "unknown format" screen instead of a possibly-wrong match. Override a rule's
weight explicitly with `"weight": N` when the defaults don't fit (e.g. a file-size match that's unusually
distinctive for a given format).

`checksumMatch` is often a *stronger* signal than a guessed magic-byte sequence — a self-consistent checksum over a
large data range is unlikely by chance, and it only requires knowing the (usually documented) algorithm, not an
unverified fixed byte value:

```json
{ "type": "checksumMatch", "algorithm": "crc16", "dataRange": { "start": "0x0", "end": "0xC0EC" }, "storedAt": "0xC0FE" }
```

`decryptedBytes` is for formats that are encrypted-at-rest with no recognizable plaintext header — the only way to
confirm a match is to try decrypting and see if a known magic value appears:

```json
{
  "type": "decryptedBytes",
  "algorithm": "rc4",
  "key": { "type": "literal", "value": "4B 65 79" },
  "offset": "0x0",
  "value": "47 56 41 53"
}
```

Because this involves a real decrypt attempt (and AES support goes through the browser's async Web Crypto API),
fingerprint evaluation is asynchronous end-to-end — nothing you need to do differently as a schema author, just
worth knowing if you're reading the engine's source.

## Offsets & endianness

Offsets are hex strings like `"0x120"` or plain decimal strings like `"288"`. Every leaf field needs an `offset`.
Two ways to add a base before it:

- `"baseOffset": "0x1000"` — a literal, inline.
- `"baseOffsetRef": "slot2"` — looks up `"0x1000"`-style value in the schema's top-level `baseOffsets` map, so the
  same field layout can be reused at multiple locations (e.g. multiple save slots).

Multi-byte numeric fields take `"endianness": "little"` (the default) or `"big"`.

### Search-based addressing (name-tagged formats)

Some formats — notably Unreal Engine's "GVAS" serialized-property saves — don't have fixed field offsets at all: a
save is a list of `{name, type, value}` entries whose positions shift between saves and game versions. For these,
use `searchPattern` instead of `offset`: the field's position is located by searching for a byte string at read
time, rather than computed from the schema alone.

```json
{
  "id": "studsCollected",
  "name": "Studs Collected",
  "type": "int64",
  "searchPattern": "StudsCollected",
  "searchValueType": "Int64Property",
  "searchValueTypeMaxDistance": 45,
  "searchValueDelta": 23
}
```

- `searchPattern`: the byte string to search for (typically a property name, null-terminated).
- `searchValueType` *(optional)*: a second marker searched for within `searchValueTypeMaxDistance` bytes after the
  end of `searchPattern` — e.g. a serialized type tag confirming this is really the property you expect.
- `searchValueDelta`: bytes from the start of the `searchValueType` match (or, if that's absent, the end of
  `searchPattern`) to where the value itself starts.

`offset` and `searchPattern` are mutually exclusive on a field. If the pattern isn't found in a particular file
(e.g. optional/DLC-gated content), the field is simply omitted from that file's editable layout rather than
erroring — other fields are unaffected. Search-based addressing is only supported on leaf fields, not on
`struct`/`array` containers, and (being inherently data-dependent) it's excluded from the out-of-bounds validator
check that applies to plain offset-based fields.

## Encryption

`encryption` is a top-level list of regions to decrypt before fingerprints/fields/checksums are evaluated, and
re-encrypt (in reverse order) when exporting:

```json
"encryption": [
  {
    "id": "main",
    "algorithm": "rc4",
    "range": { "start": "0x0", "end": "eof" },
    "key": { "type": "literal", "value": "4B 65 79" }
  }
]
```

- `algorithm`: `rc4`, `xor` (both simple symmetric stream operations — encrypt and decrypt are the same operation),
  or `aes-cbc`/`aes-ctr` (via the browser's native Web Crypto API; both require an `iv`). Raw/no-padding AES-ECB is
  **not** supported — Web Crypto has no ECB mode, and approximating it on top of CBC isn't reliably correct, so it's
  excluded rather than shipped subtly broken.
- `range.end` can be the literal string `"eof"` for whole-file (or tail-of-file) encryption, common for formats that
  are fully encrypted at rest.
- `key` (and `iv`, for the AES modes) is either `{ "type": "literal", "value": "<hex bytes>" }` (a fixed key baked
  into the schema) or `{ "type": "fileRegion", "offset": "...", "length": N }` (the key/IV is itself stored in the
  file, e.g. an embedded IV in an unencrypted header) — always read from the *original*, undecrypted file bytes.

Because fingerprinting runs on raw file bytes *before* any schema is known to apply, an encrypted-at-rest format
with no plaintext header needs a `decryptedBytes` fingerprint rule (see above) rather than a `bytes`/`string` rule —
there's nothing plaintext to match against until you've already decrypted it with the right key.

Fields are addressed relative to the *decrypted* buffer, exactly as if the file had never been encrypted. Checksums
are computed over the decrypted buffer too, matching the common case where a checksum protects the plaintext content
before it's encrypted for storage.

## Field types

`uint8/16/32/64`, `int8/16/32/64`, `float32`, `float64`, `boolean`, `bitfield`, `string`, `hexBytes`, `enum`,
`array`, and `struct`.

`struct` and `array` are pure **organization** — they don't store a value themselves, only their children do:

```json
{
  "id": "stats",
  "name": "Stats",
  "type": "struct",
  "offset": "0x8",
  "fields": [
    { "id": "strength", "name": "Strength", "type": "uint8", "offset": "0x0" },
    { "id": "hp", "name": "HP", "type": "uint16", "offset": "0x1" }
  ]
}
```

```json
{
  "id": "inventory",
  "name": "Inventory",
  "type": "array",
  "offset": "0x300",
  "count": 10,
  "stride": "0x4",
  "items": {
    "id": "slot",
    "name": "Item",
    "type": "struct",
    "fields": [
      { "id": "itemId", "name": "Item", "type": "uint16", "offset": "0x0" },
      { "id": "quantity", "name": "Quantity", "type": "uint16", "offset": "0x2" }
    ]
  }
}
```

Each of the array's `count` elements is placed `stride` bytes apart, starting at the array's own offset. `items` can
be a single primitive field (for an array of plain numbers) or a `struct` (for an array of records), as above.

## Bitfields & booleans

A single flag bit:

```json
{ "id": "hasSword", "name": "Has Sword", "type": "boolean", "offset": "0x250", "bit": 3 }
```

A multi-bit value packed into part of a byte/word — `bitOffset` (0 = least significant bit) and `bitLength` (up to
32 bits, capped at spanning 4 bytes):

```json
{ "id": "chapter", "name": "Chapter", "type": "bitfield", "offset": "0x40", "bitOffset": 4, "bitLength": 3, "min": 0, "max": 7 }
```

Multiple booleans/bitfields can share the same byte at different bit positions — that's the normal way flags are
packed and is fully supported.

## Strings

- `encoding`: `ascii`, `utf8`, or `utf16`.
- `stringMode`: `"fixed"` (default — padded to `length` bytes with `0x00`) or `"nullTerminated"` (reads/writes up to
  `length` bytes, stopping at the first `0x00`).
- Trailing NUL bytes are stripped automatically when a fixed string is read.

## Enums

`values` maps the raw stored number (as a **string** key, since JSON object keys are always strings) to a display
label. `storageType` controls how many bytes back it: `uint8` (default), `uint16`, or `uint32`.

```json
{
  "id": "difficulty",
  "name": "Difficulty",
  "type": "enum",
  "offset": "0x60",
  "storageType": "uint8",
  "values": { "0": "Normal", "1": "Hard", "2": "Expert" }
}
```

## Transformations

`transform` is an ordered list of declarative steps applied when **reading** (raw stored value → the number shown in
the editor) and automatically reversed, in reverse order, when **writing** (edited display value → raw stored
value). `min`/`max`/`step` on the field are interpreted in **display** units.

**No arbitrary code ever runs from a schema.** Steps are a small, fixed, whitelisted set:

`multiply`, `divide`, `add`, `subtract`, `xor`, `bitmaskAnd`, `shiftLeft`, `shiftRight`, `toSigned`, `toUnsigned`,
`fixedPoint`, `scale`.

```json
// Stored as an integer, raw/2 when displayed (e.g. raw 100 -> displayed 50)
{ "type": "uint8", "offset": "0x0D", "transform": [{ "type": "scale", "divisor": 2 }], "min": 0, "max": 100 }
```

`bitmaskAnd`, and to a lesser extent `shiftRight`, are lossy and not perfectly invertible — only use them as the
final step in a chain, or on fields you don't intend to round-trip losslessly.

## Checksums

Declared at the schema's top level, independent of any one field:

```json
"checksums": [{
  "id": "main",
  "type": "checksum",
  "algorithm": "crc32",
  "dataRange": { "start": "0x0", "end": "0x40" },
  "writeOffset": "0x40",
  "endianness": "little"
}]
```

Every export recalculates **every** declared checksum automatically, after all field edits are applied and before
the file is offered for download.

Algorithms: `crc32`, `crc16`, `crc8` (all support an optional `params` object to override `polynomial`,
`initialValue`, `finalXor`, `reflectIn`, `reflectOut` for non-default variants), plus `adler32`, `sum8`, `sum16`,
`sum32`, and `xor8`.

## Validation

Every schema is formally validated before it's ever used to read a byte, and invalid schemas are rejected outright
(not partially applied):

- required top-level properties, kebab-case `id`
- offset syntax on every offset-shaped value
- per-field-type requirements (e.g. `bitfield` needs `bitOffset`/`bitLength`, `enum` needs `values`, `array` needs
  `count`/`stride`/`items`)
- `min` ≤ `max`
- fingerprint rule structure (valid hex patterns, valid hash lengths, etc.)
- checksum `dataRange` sanity (`end` > `start`)
- duplicate field ids and duplicate checksum ids within a schema; duplicate schema ids across the whole repository
- unresolved `baseOffsetRef`/`visibleWhen` references
- fields that would read or write past an exactly-declared file size, where statically determinable

## Testing a schema locally

1. Put your schema JSON at `schemas/<platform>/<game>/<variant>.json` and add an entry to `schemas/index.json`.
2. Run `npm run dev` and drag in a real save file for the game.
3. Open the debug panel in the editor (toggle button) to confirm the matched fingerprint, its confidence score, and
   use the hex viewer to check the exact bytes your fields point at (it supports hex/text search).
4. Edit a field, export, and re-open the exported file to confirm your edit round-trips and nothing else changed.
5. If you're comfortable with [Vitest](https://vitest.dev), add a fixture-based test under `tests/` — see
   `tests/fixtures/example-saves.ts` and `tests/core/save-session.test.ts` for the pattern used by the bundled
   example schemas.

See `docs/contributing.md` for how to submit your schema, and `docs/examples.md` for an annotated walkthrough of the
three bundled example schemas.
