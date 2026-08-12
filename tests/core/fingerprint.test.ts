import { describe, expect, it } from 'vitest';
import { analyzeBuffer, MATCH_CONFIDENCE_THRESHOLD } from '../../src/core/fingerprint/fingerprint-engine';
import { sha256Hex, sha1Hex } from '../../src/core/hash/hash';
import type { SaveSchema } from '../../src/core/schema/schema-types';
import { buildPixelQuestSave, buildIronKeepSave, buildStarForgeSave, buildPokemonDiamondPearlSave, buildLotdkSave } from '../fixtures/example-saves';
import pixelQuestSchema from '../../schemas/nintendo-3ds/pixel-quest/usa-v1.json';
import ironKeepSchema from '../../schemas/gbc/iron-keep/usa-v1.json';
import starForgeSchema from '../../schemas/pc/star-forge/v1.json';
import pokemonDpSchema from '../../schemas/nintendo-ds/pokemon-diamond-pearl/usa-v1.json';
import lotdkSchema from '../../schemas/pc/lego-batman-lotdk/steam-v1.json';

const schemas = [pixelQuestSchema, ironKeepSchema, starForgeSchema, pokemonDpSchema, lotdkSchema] as unknown as SaveSchema[];

async function analyze(buffer: Uint8Array) {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const [sha256, sha1] = await Promise.all([sha256Hex(ab), sha1Hex(ab)]);
  return analyzeBuffer(ab, sha256, sha1, schemas);
}

describe('fingerprint engine against the example schemas', () => {
  it('confidently matches a Pixel Quest save', async () => {
    const result = await analyze(buildPixelQuestSave());
    expect(result.bestMatch?.schema.id).toBe('pixel-quest-3ds-usa-v1');
    expect(result.bestMatch!.score).toBeGreaterThanOrEqual(MATCH_CONFIDENCE_THRESHOLD);
  });

  it('confidently matches an Iron Keep save', async () => {
    const result = await analyze(buildIronKeepSave());
    expect(result.bestMatch?.schema.id).toBe('iron-keep-gbc-usa-v1');
  });

  it('confidently matches a Star Forge save', async () => {
    const result = await analyze(buildStarForgeSave());
    expect(result.bestMatch?.schema.id).toBe('star-forge-pc-v1');
  });

  it('does not match a save with the wrong file size', async () => {
    const truncated = buildPixelQuestSave().slice(0, 100);
    const result = await analyze(truncated);
    expect(result.allMatches.find((m) => m.schema.id === 'pixel-quest-3ds-usa-v1')).toBeUndefined();
  });

  it('does not match a save with the right size but wrong magic bytes', async () => {
    const corrupted = buildPixelQuestSave();
    corrupted[0] = 0x00;
    const result = await analyze(corrupted);
    expect(result.bestMatch?.schema.id).not.toBe('pixel-quest-3ds-usa-v1');
  });

  it('confidently matches a Pokemon Diamond/Pearl save via checksumMatch (no fixed magic bytes needed)', async () => {
    const result = await analyze(buildPokemonDiamondPearlSave());
    expect(result.bestMatch?.schema.id).toBe('pokemon-diamond-pearl-ds-usa-v1');
    expect(result.bestMatch!.score).toBeGreaterThanOrEqual(MATCH_CONFIDENCE_THRESHOLD);
  });

  it('rejects a Pokemon-Diamond-Pearl-sized save whose checksum does not validate', async () => {
    const buffer = buildPokemonDiamondPearlSave();
    buffer[0x100] ^= 0xff; // corrupt data inside the checksummed range without fixing the checksum
    const result = await analyze(buffer);
    expect(result.allMatches.find((m) => m.schema.id === 'pokemon-diamond-pearl-ds-usa-v1')).toBeUndefined();
  });

  it('confidently matches an RC4-encrypted LOTDK save via decryptedBytes (trial-decrypt then check for GVAS)', async () => {
    const result = await analyze(buildLotdkSave());
    expect(result.bestMatch?.schema.id).toBe('lego-batman-lotdk-pc-steam-v1');
    expect(result.bestMatch!.score).toBeGreaterThanOrEqual(MATCH_CONFIDENCE_THRESHOLD);
  });

  it('does not match a corrupted LOTDK save whose first byte no longer decrypts to "G"', async () => {
    const corrupted = buildLotdkSave();
    corrupted[0] ^= 0xff; // stream cipher: corrupts exactly the first decrypted byte, breaking the GVAS check
    const result = await analyze(corrupted);
    expect(result.allMatches.find((m) => m.schema.id === 'lego-batman-lotdk-pc-steam-v1')).toBeUndefined();
  });

  it('never guesses on random, unrecognizable data', async () => {
    const random = new Uint8Array(200);
    for (let i = 0; i < random.length; i++) random[i] = (i * 37 + 11) % 256;
    const result = await analyze(random);
    expect(result.bestMatch).toBeNull();
  });

  it('treats an empty buffer as unrecognized rather than crashing', async () => {
    const result = await analyze(new Uint8Array(0));
    expect(result.bestMatch).toBeNull();
  });
});
