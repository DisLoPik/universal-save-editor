# Example Schemas

Three fully working example schemas ship with the app under `schemas/`, each demonstrating a different set of
features. **All three games are fictional** — they exist purely to exercise the engine end-to-end without ever
presenting fabricated offsets for a real commercial game as fact. Matching fixture generators live in
`tests/fixtures/example-saves.ts`, and are exercised by `tests/core/save-session.test.ts`,
`tests/core/field-codec.test.ts`, and `tests/core/fingerprint.test.ts`.

## 1. Pixel Quest — simple fixed-offset save

`schemas/nintendo-3ds/pixel-quest/usa-v1.json` — 128-byte fixed-layout save. Demonstrates: `string`, `uint8`,
`uint32`, `boolean`, `float32`, `hexBytes`, and a multi-rule fingerprint.

```text
0x00  8 bytes   "PXLQST01"           magic (fingerprint only, not a field)
0x08  16 bytes  Player Name          ascii, fixed-length
0x18  1 byte    Level                uint8, 1-100
0x19  4 bytes   Money                uint32 LE, 0-999999
0x1D  1 byte    Hardcore Mode        boolean, bit 0
0x1E  4 bytes   Difficulty Multiplier float32 LE
0x22  8 bytes   Secret Seed          hexBytes
0x2A  1 byte    (format version)     fingerprint only, not a field
```

## 2. Iron Keep — bitfields, packed flags, enums, a struct, a transform

`schemas/gbc/iron-keep/usa-v1.json` — 64-byte fixed-layout save. Demonstrates: `enum`, four `boolean` fields packed
into one byte, a `bitfield` sharing a byte with another `boolean`, a `struct`, and a `transform` (`scale`).

```text
0x00  4 bytes  "IRNK"                magic (fingerprint only)
0x04  1 byte   (format version)      fingerprint only
0x05  1 byte   Difficulty            enum: Normal/Hard/Expert
0x06  1 byte   unlock flags byte:    bit0 hasMap · bit1 hasSword · bit2 hasShield · bit3 hasBoat
0x07  1 byte   quest byte:           bits0-2 currentChapter (bitfield, 0-7) · bit3 bossDefeated
0x08  6 bytes  Stats struct:         strength(u8) · defense(u8) · speed(u8) · hp(u16 LE) · magicPercent(u8, raw/2)
```

`magicPercent` is stored as an integer 0-200 but shown/edited as 0-100 via `{ "type": "scale", "divisor": 2 }` — a
good template for any "stored as an integer, shown as a friendlier unit" field.

## 3. Star Forge — checksum-protected save with an item array

`schemas/pc/star-forge/v1.json` — 68-byte fixed-layout save. Demonstrates: a `struct`, an `array` of `struct`
(inventory slots, each with an `enum` item id and a `uint16` quantity), and a `checksums` entry that's recalculated
automatically on every export.

```text
0x00  4 bytes   "SFRG"               magic (fingerprint only)
0x04  1 byte    (format version)     fingerprint only
0x08  6 bytes   Stats struct:        hp(u16 LE) · mp(u16 LE) · atk(u8) · def(u8)
0x10  4 bytes   Gold                 uint32 LE
0x20  20 bytes  Inventory:           5 slots x 4 bytes, each { itemId: enum(u16), quantity: u16 }
0x40  4 bytes   Checksum             CRC32 over 0x00-0x3F, little-endian
```

Edit any field — gold, stats, or an inventory slot — and export: the CRC32 at `0x40` is recalculated automatically
over the (now-modified) `0x00`-`0x3F` range before the file is offered for download.

## Reading these as templates

If you're writing your first real schema, the closest of these three to your format is usually the fastest starting
point to copy from:

- Nothing packed, no checksum → start from **Pixel Quest**.
- Flags/enums/small packed values → start from **Iron Keep**.
- A checksum, or a repeated list of items (inventory, party members, unlocked levels...) → start from **Star Forge**.
