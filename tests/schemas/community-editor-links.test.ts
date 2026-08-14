import { describe, expect, it } from 'vitest';
import { analyzeBuffer, MATCH_CONFIDENCE_THRESHOLD } from '../../src/core/fingerprint/fingerprint-engine';
import { sha256Hex, sha1Hex } from '../../src/core/hash/hash';
import { parseOffset } from '../../src/core/binary/offsets';
import { validateSchema } from '../../src/core/schema/schema-validator';
import type { FingerprintRule, SaveSchema } from '../../src/core/schema/schema-types';
import schemaIndex from '../../schemas/index.json';
import finalFantasyExplorersLink from '../../schemas/community-editor-links/final-fantasy-explorers.json';
import hyruleWarriorsLink from '../../schemas/community-editor-links/hyrule-warriors.json';
import hyruleWarriorsAocLink from '../../schemas/community-editor-links/hyrule-warriors-age-of-calamity.json';
import kidIcarusUprisingLink from '../../schemas/community-editor-links/kid-icarus-uprising.json';
import kirbysBlowoutBlastLink from '../../schemas/community-editor-links/kirbys-blowout-blast.json';
import marioKart7Link from '../../schemas/community-editor-links/mario-kart-7.json';
import nintendogsCatsLink from '../../schemas/community-editor-links/nintendogs-cats.json';
import picross3dRound2Link from '../../schemas/community-editor-links/picross-3d-round-2.json';
import picrossELink from '../../schemas/community-editor-links/picross-e.json';
import pokemonPicrossLink from '../../schemas/community-editor-links/pokemon-picross.json';
import pokemonShuffleLink from '../../schemas/community-editor-links/pokemon-shuffle.json';
import rhythmParadiseMegamixLink from '../../schemas/community-editor-links/rhythm-paradise-megamix.json';
import smashBrosUltimateLink from '../../schemas/community-editor-links/smash-bros-ultimate.json';
import streetpassMiiPlazaLink from '../../schemas/community-editor-links/streetpass-mii-plaza.json';
import superKirbyClashLink from '../../schemas/community-editor-links/super-kirby-clash.json';
import sushiStrikerLink from '../../schemas/community-editor-links/sushi-striker.json';
import teamKirbyClashDxLink from '../../schemas/community-editor-links/team-kirby-clash-dx.json';
import theLegoMovieVideogameLink from '../../schemas/community-editor-links/the-lego-movie-videogame.json';
import zeldaBotwLink from '../../schemas/community-editor-links/zelda-botw.json';
import zeldaTotkLink from '../../schemas/community-editor-links/zelda-totk.json';

const allLinks = [
  finalFantasyExplorersLink,
  hyruleWarriorsLink,
  hyruleWarriorsAocLink,
  kidIcarusUprisingLink,
  kirbysBlowoutBlastLink,
  marioKart7Link,
  nintendogsCatsLink,
  picross3dRound2Link,
  picrossELink,
  pokemonPicrossLink,
  pokemonShuffleLink,
  rhythmParadiseMegamixLink,
  smashBrosUltimateLink,
  streetpassMiiPlazaLink,
  superKirbyClashLink,
  sushiStrikerLink,
  teamKirbyClashDxLink,
  theLegoMovieVideogameLink,
  zeldaBotwLink,
  zeldaTotkLink,
] as unknown as SaveSchema[];

const schemas = allLinks;

/** Builds the smallest buffer that satisfies every 'fileSize'/'bytes' rule in a fingerprint set (this repo's pointer schemas never use other rule types). */
function synthesizeBuffer(rules: FingerprintRule[]): Uint8Array {
  let size = 0;
  for (const rule of rules) {
    if (rule.type === 'fileSize') size = Math.max(size, rule.value);
  }
  const buf = new Uint8Array(size);
  for (const rule of rules) {
    if (rule.type === 'bytes') {
      const offset = parseOffset(rule.offset);
      const bytes = rule.value.trim().split(/\s+/).map((b) => parseInt(b, 16));
      buf.set(bytes, offset);
    }
  }
  return buf;
}

async function analyze(buffer: Uint8Array) {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const [sha256, sha1] = await Promise.all([sha256Hex(ab), sha1Hex(ab)]);
  return analyzeBuffer(ab, sha256, sha1, schemas);
}

describe('community-editor-links schemas', () => {
  it('are all registered in schemas/index.json', () => {
    const registeredIds = new Set(schemaIndex.schemas.map((s) => s.id));
    for (const schema of allLinks) {
      expect(registeredIds.has(schema.id), `${schema.id} should be registered in schemas/index.json`).toBe(true);
    }
  });

  it('all pass formal validation', () => {
    for (const schema of allLinks) {
      const result = validateSchema(schema);
      expect(result.valid, `${schema.id}: ${result.errors.join('; ')}`).toBe(true);
    }
  });

  it('every fingerprint set clears the match-confidence threshold on its own', async () => {
    for (const schema of allLinks) {
      for (const set of schema.fingerprints) {
        const buffer = synthesizeBuffer(set.rules);
        const result = await analyze(buffer);
        expect(
          result.bestMatch?.schema.id,
          `${schema.id} / fingerprint set "${set.id}" should confidently self-match (got best match: ${result.bestMatch?.schema.id ?? 'none'}, score ${result.allMatches[0]?.score ?? 0})`,
        ).toBe(schema.id);
        expect(result.bestMatch!.score).toBeGreaterThanOrEqual(MATCH_CONFIDENCE_THRESHOLD);
        expect(result.bestMatch!.schema.communityEditor?.slug).toBeTruthy();
      }
    }
  });

  it('zelda-totk does not match on file size alone (magic bytes are required)', async () => {
    const totk = zeldaTotkLink as unknown as SaveSchema;
    const rule = totk.fingerprints[0].rules.find((r) => r.type === 'fileSize')!;
    const buffer = new Uint8Array((rule as { value: number }).value); // right size, all zero bytes (no magic)
    const result = await analyze(buffer);
    expect(result.bestMatch?.schema.id).not.toBe('community-editor-zelda-totk');
  });

  it('zelda-botw Wii U and Switch headers for the same version do not cross-match', async () => {
    const botw = zeldaBotwLink as unknown as SaveSchema;
    const wiiuSet = botw.fingerprints.find((s) => s.id === 'wiiu-0-v1.0')!;
    const switchSet = botw.fingerprints.find((s) => s.id === 'switch-0-v1.0')!;
    // The Wii U (big-endian) header bytes at a Switch (little-endian) fingerprint's same file size should not
    // accidentally also satisfy the Switch set's byte pattern (and vice versa) — sanity check they're distinct.
    const wiiuBuffer = synthesizeBuffer(wiiuSet.rules);
    const result = await analyze(wiiuBuffer);
    expect(result.bestMatch?.matchedSetId).toBe('wiiu-0-v1.0');
    expect(result.bestMatch?.matchedSetId).not.toBe(switchSet.id);
  });
});
