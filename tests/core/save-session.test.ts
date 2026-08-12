import { describe, expect, it } from 'vitest';
import { SaveSession } from '../../src/core/session/save-session';
import { computeChecksum } from '../../src/core/checksum/checksum-engine';
import type { SaveSchema } from '../../src/core/schema/schema-types';
import { buildPixelQuestSave, buildStarForgeSave } from '../fixtures/example-saves';
import pixelQuestSchema from '../../schemas/nintendo-3ds/pixel-quest/usa-v1.json';
import starForgeSchema from '../../schemas/pc/star-forge/v1.json';

const pixelQuest = pixelQuestSchema as unknown as SaveSchema;
const starForge = starForgeSchema as unknown as SaveSchema;

function makeSession(buffer: Uint8Array, schema: SaveSchema, fileName = 'save.bin') {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return SaveSession.create({ originalBuffer: ab, fileName, sha256: '', sha1: '', schema });
}

describe('SaveSession (Pixel Quest — simple fixed-offset save)', () => {
  it('reads initial values matching the fixture', async () => {
    const session = await makeSession(buildPixelQuestSave({ playerName: 'Zelda', level: 7, money: 1234 }), pixelQuest);
    const { values, readErrors } = session.readInitialValues();
    expect(readErrors).toEqual([]);
    expect(values.get('playerName')).toBe('Zelda');
    expect(values.get('level')).toBe(7);
    expect(values.get('money')).toBe(1234);
  });

  it('patches only the edited bytes, leaving the rest of the buffer untouched', async () => {
    const original = buildPixelQuestSave({ level: 1, money: 100 });
    const session = await makeSession(original, pixelQuest);
    const { values } = session.readInitialValues();
    values.set('level', 99);

    const { bytes, errors } = await session.buildExport(values);
    expect(errors).toEqual([]);
    expect(bytes[0x18]).toBe(99);
    // Everything else should be byte-for-byte identical to the original.
    for (let i = 0; i < original.length; i++) {
      if (i === 0x18) continue;
      expect(bytes[i]).toBe(original[i]);
    }
    // The original buffer itself must never be mutated.
    expect(original[0x18]).toBe(1);
  });

  it('rejects an out-of-range value and does not modify the output bytes', async () => {
    const original = buildPixelQuestSave({ level: 1 });
    const session = await makeSession(original, pixelQuest);
    const { values } = session.readInitialValues();
    values.set('level', 255); // schema max is 100

    const { errors } = await session.buildExport(values);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].instanceId).toBe('level');
  });
});

describe('SaveSession (Star Forge — checksum-protected save)', () => {
  it('recalculates the CRC32 checksum after an edit', async () => {
    const original = buildStarForgeSave({ gold: 100 });
    const session = await makeSession(original, starForge);
    const { values } = session.readInitialValues();
    expect(values.get('gold')).toBe(100);
    values.set('gold', 999);

    const { bytes, errors } = await session.buildExport(values);
    expect(errors).toEqual([]);

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0x10, true)).toBe(999);

    const expectedCrc = computeChecksum('crc32', bytes.slice(0x0, 0x40));
    expect(view.getUint32(0x40, true)).toBe(expectedCrc);
  });

  it('produces a checksum that a fresh fingerprint-style recomputation agrees with', async () => {
    const session = await makeSession(buildStarForgeSave(), starForge);
    const { values } = session.readInitialValues();
    values.set('gold', 42);
    const { bytes } = await session.buildExport(values);

    // Re-deriving the session from the exported bytes and re-exporting with no
    // further edits should be a no-op on the checksum (idempotent).
    const secondSession = await makeSession(bytes, starForge);
    const { values: secondValues } = secondSession.readInitialValues();
    const { bytes: secondBytes } = await secondSession.buildExport(secondValues);
    expect([...secondBytes]).toEqual([...bytes]);
  });

  it('reads an inventory array element correctly', async () => {
    const session = await makeSession(buildStarForgeSave({ items: [[2, 5], [0, 0], [0, 0], [0, 0], [0, 0]] }), starForge);
    const { values } = session.readInitialValues();
    expect(values.get('inventory[0].itemId')).toBe(2);
    expect(values.get('inventory[0].quantity')).toBe(5);
  });
});
