import type { ReactNode } from 'react';

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-bg-inset p-4 text-xs leading-relaxed text-text">
      <code>{children}</code>
    </pre>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border/70 py-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

const TOC = [
  ['structure', 'Schema structure'],
  ['fingerprints', 'Fingerprints'],
  ['offsets', 'Offsets & endianness'],
  ['fields', 'Field types'],
  ['bitfields', 'Bitfields & booleans'],
  ['strings', 'Strings'],
  ['enums', 'Enums'],
  ['transforms', 'Transformations'],
  ['checksums', 'Checksums'],
  ['validation', 'Validation'],
  ['testing', 'Testing a schema'],
] as const;

export function DocsPage() {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[200px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <h1 className="text-lg font-semibold text-text">Schema Authoring</h1>
        <p className="mt-1 text-xs text-text-faint">The full reference also lives in /docs in the repository.</p>
        <nav className="mt-4 space-y-1 text-sm">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded px-2 py-1 text-text-muted hover:bg-bg-raised hover:text-text">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div>
        <Section id="structure" title="Schema structure">
          <p>
            A schema is one JSON file describing a single save format variant: what identifies it, and how to read,
            display, validate, and write every field. The app never contains game-specific code — everything comes
            from this file.
          </p>
          <Code>{`{
  "id": "example-quest-3ds-usa-v1",
  "game": "Example Quest",
  "platform": "Nintendo 3DS",
  "region": "USA",
  "version": "1.0.0",
  "author": "your-name",
  "license": "MIT",
  "schemaVersion": 1,
  "fingerprints": [ /* see below */ ],
  "groups": [{ "id": "player", "name": "Player" }],
  "fields": [ /* see below */ ],
  "checksums": [ /* optional */ ]
}`}</Code>
          <p>
            <code>id</code> must be kebab-case and unique across the whole repository. Convention:{' '}
            <code>game-platform-region-version</code>.
          </p>
        </Section>

        <Section id="fingerprints" title="Fingerprints">
          <p>
            <code>fingerprints</code> is a list of independent <em>sets</em>; a save matches a set only if{' '}
            <em>every</em> rule inside it matches (logical AND). A schema matches if <em>any</em> of its sets fully
            match (logical OR across sets) — useful for a game with multiple regional/version layouts.
          </p>
          <Code>{`"fingerprints": [
  {
    "id": "usa-v1",
    "rules": [
      { "type": "fileSize", "value": 524288 },
      { "type": "bytes", "offset": "0x0", "value": "45 58 41 4D ?? ??" },
      { "type": "string", "offset": "0x10", "value": "EXAMPLEQUEST" }
    ]
  }
]`}</Code>
          <p>Rule types: <code>fileSize</code>, <code>bytes</code> (hex, <code>??</code> = wildcard byte),{' '}
            <code>string</code>, <code>sha256</code>, <code>sha1</code>, <code>crc32</code> (over a byte range), plus{' '}
            <code>allOf</code>/<code>anyOf</code> for nested grouping. Each rule type carries a default confidence
            weight (an exact hash match is worth far more than a bare file-size match); override it with an explicit{' '}
            <code>weight</code> if needed. The app never guesses — below a confidence threshold, or on a tie between
            two schemas, the user gets the "unknown format" screen instead of a wrong match.
          </p>
        </Section>

        <Section id="offsets" title="Offsets & endianness">
          <p>
            Offsets are hex strings like <code>"0x120"</code> or plain decimal integers. Every field needs an{' '}
            <code>offset</code>; a <code>baseOffset</code> (literal) or <code>baseOffsetRef</code> (name into the
            schema's top-level <code>baseOffsets</code> map) is added first, so the same field layout can be reused
            at multiple base locations:
          </p>
          <Code>{`"baseOffsets": { "saveSlot2": "0x2000" },
"fields": [
  { "id": "money", "name": "Money", "type": "uint32", "baseOffsetRef": "saveSlot2", "offset": "0x20" }
]`}</Code>
          <p>
            Multi-byte numeric fields take <code>"endianness": "little"</code> (default) or{' '}
            <code>"big"</code>.
          </p>
        </Section>

        <Section id="fields" title="Field types">
          <p>
            <code>uint8/16/32/64</code>, <code>int8/16/32/64</code>, <code>float32</code>, <code>float64</code>,{' '}
            <code>boolean</code>, <code>bitfield</code>, <code>string</code>, <code>hexBytes</code>,{' '}
            <code>enum</code>, <code>array</code>, and <code>struct</code>. <code>struct</code> groups child fields
            under a shared relative base offset; <code>array</code> repeats an <code>items</code> template{' '}
            <code>count</code> times, <code>stride</code> bytes apart — both are pure organization, not their own
            stored value.
          </p>
          <Code>{`{
  "id": "inventory",
  "name": "Inventory",
  "type": "array",
  "offset": "0x300",
  "count": 10,
  "stride": "0x4",
  "items": { "id": "itemId", "name": "Item", "type": "uint16" }
}`}</Code>
        </Section>

        <Section id="bitfields" title="Bitfields & booleans">
          <p>
            A single flag bit: <code>{`{ "type": "boolean", "offset": "0x250", "bit": 3 }`}</code>. A multi-bit
            field packed into a byte/word: <code>bitOffset</code> (0 = least significant bit) and{' '}
            <code>bitLength</code> (up to 32, capped at spanning 4 bytes).
          </p>
          <Code>{`{ "type": "bitfield", "offset": "0x40", "bitOffset": 4, "bitLength": 3, "min": 0, "max": 7 }`}</Code>
        </Section>

        <Section id="strings" title="Strings">
          <p>
            <code>encoding</code>: <code>ascii</code>, <code>utf8</code>, or <code>utf16</code>.{' '}
            <code>stringMode</code>: <code>"fixed"</code> (padded to <code>length</code> bytes, default) or{' '}
            <code>"nullTerminated"</code> (up to <code>length</code> bytes, stops at the first 0x00). Trailing NUL
            bytes are stripped when reading.
          </p>
        </Section>

        <Section id="enums" title="Enums">
          <p>
            <code>values</code> maps the raw stored number (as a string key) to a display label.{' '}
            <code>storageType</code> controls how many bytes back it (<code>uint8</code> default,{' '}
            <code>uint16</code>, or <code>uint32</code>).
          </p>
          <Code>{`{ "type": "enum", "offset": "0x60", "storageType": "uint8",
  "values": { "0": "Normal", "1": "Hard", "2": "Expert" } }`}</Code>
        </Section>

        <Section id="transforms" title="Transformations">
          <p>
            <code>transform</code> is an ordered list of declarative steps applied when reading (raw → display) and
            reversed automatically when writing (display → raw). No arbitrary code ever runs from a schema — steps
            are a fixed, whitelisted set: <code>multiply</code>, <code>divide</code>, <code>add</code>,{' '}
            <code>subtract</code>, <code>xor</code>, <code>bitmaskAnd</code>, <code>shiftLeft</code>,{' '}
            <code>shiftRight</code>, <code>toSigned</code>, <code>toUnsigned</code>, <code>fixedPoint</code>,{' '}
            <code>scale</code>.
          </p>
          <Code>{`// Stored as an integer percent * 100; shown as a decimal, e.g. 4250 -> 42.5
{ "type": "uint16", "offset": "0x80", "transform": [{ "type": "scale", "divisor": 100 }] }`}</Code>
        </Section>

        <Section id="checksums" title="Checksums">
          <p>
            Declared at the schema's top level, independent of any one field. Every export recalculates all of them
            automatically after edits are applied and before the file is offered for download.
          </p>
          <Code>{`"checksums": [{
  "id": "main",
  "type": "checksum",
  "algorithm": "crc32",
  "dataRange": { "start": "0x100", "end": "0x1FFF" },
  "writeOffset": "0x20",
  "endianness": "little"
}]`}</Code>
          <p>Algorithms: <code>crc32</code>, <code>crc16</code>, <code>crc8</code> (all parameterizable via an
            optional <code>params</code> object — polynomial, init, reflect-in/out, final XOR), plus{' '}
            <code>adler32</code>, <code>sum8/16/32</code>, and <code>xor8</code>.
          </p>
        </Section>

        <Section id="validation" title="Validation">
          <p>
            Every community schema is validated before use — required properties, offset syntax, field-type
            requirements, numeric ranges, fingerprint/checksum structure, duplicate field or checksum ids, unresolved{' '}
            <code>baseOffsetRef</code>/<code>visibleWhen</code> references, and (where statically determinable)
            fields that would read or write past an exact declared file size. Invalid schemas are rejected outright
            rather than partially applied.
          </p>
        </Section>

        <Section id="testing" title="Testing a schema locally">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Drop your schema JSON into <code>schemas/&lt;platform&gt;/&lt;game&gt;/</code> and add it to that
              folder's <code>index.json</code>.</li>
            <li>Run <code>npm run dev</code> and drag in a real save file for the game.</li>
            <li>Use the debug panel (toggle in the editor) to confirm the matched fingerprint, confidence score, and
              hex-dump the exact bytes your fields point at.</li>
            <li>Edit a field, export, and re-open the exported file to confirm it round-trips.</li>
            <li>Add a fixture-based test under <code>tests/</code> if you're comfortable with Vitest — see existing
              example schema tests for the pattern.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}
