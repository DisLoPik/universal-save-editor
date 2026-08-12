import { describe, expect, it } from 'vitest';
import { SaveSession } from '../../src/core/session/save-session';
import { computeChecksum } from '../../src/core/checksum/checksum-engine';
import { rc4Apply } from '../../src/core/encryption/rc4';
import type { SaveSchema } from '../../src/core/schema/schema-types';
import { buildPokemonDiamondPearlSave, buildLotdkSave } from '../fixtures/example-saves';
import pokemonDpSchema from '../../schemas/nintendo-ds/pokemon-diamond-pearl/usa-v1.json';
import lotdkSchema from '../../schemas/pc/lego-batman-lotdk/steam-v1.json';

const pokemonDp = pokemonDpSchema as unknown as SaveSchema;
const lotdk = lotdkSchema as unknown as SaveSchema;

const LOTDK_KEY = Uint8Array.from([
  0x21, 0x38, 0x11, 0x60, 0x17, 0x47, 0x2f, 0x53, 0x5d, 0x37, 0x24, 0x0e, 0x0e, 0x0f, 0x60, 0x43, 0x2f, 0x0e, 0x3f,
  0x0a, 0x27, 0x55, 0x4b, 0x0b, 0x4f, 0x59, 0x25, 0x38, 0x0b, 0x3a, 0x44, 0x17,
]);

async function makeSession(buffer: Uint8Array, schema: SaveSchema) {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return SaveSession.create({ originalBuffer: ab, fileName: 'save.bin', sha256: '', sha1: '', schema });
}

describe('Pokemon Diamond/Pearl schema (real game, unencrypted, checksum-protected)', () => {
  it('reads trainer fields at their documented offsets', async () => {
    const session = await makeSession(buildPokemonDiamondPearlSave({ trainerId: 1, secretId: 2, money: 500 }), pokemonDp);
    const { values, readErrors } = session.readInitialValues();
    expect(readErrors).toEqual([]);
    expect(values.get('trainerId')).toBe(1);
    expect(values.get('secretId')).toBe(2);
    expect(values.get('money')).toBe(500);
  });

  it('recalculates the CRC16 small-block checksum after an edit', async () => {
    const session = await makeSession(buildPokemonDiamondPearlSave(), pokemonDp);
    const { values } = session.readInitialValues();
    values.set('money', 999999);

    const { bytes, errors } = await session.buildExport(values);
    expect(errors).toEqual([]);

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0x7c, true)).toBe(999999);

    const expectedCrc = computeChecksum('crc16', bytes.slice(0x0, 0xc0ec));
    expect(view.getUint16(0xc0fe, true)).toBe(expectedCrc);
  });

  it('rejects money above the documented cap of 999999', async () => {
    const session = await makeSession(buildPokemonDiamondPearlSave(), pokemonDp);
    const { values } = session.readInitialValues();
    values.set('money', 1000000);
    const { errors } = await session.buildExport(values);
    expect(errors.some((e) => e.instanceId === 'money')).toBe(true);
  });
});

describe('LEGO Batman: Legacy of the Dark Knight schema (real game, RC4-encrypted, search-addressed field)', () => {
  it('decrypts the whole file and locates StudsCollected by name search', async () => {
    const session = await makeSession(buildLotdkSave({ studsCollected: 777n }), lotdk);
    const { values, readErrors } = session.readInitialValues();
    expect(readErrors).toEqual([]);
    expect(values.get('studsCollected')).toBe(777n);
  });

  it('decrypted buffer starts with the GVAS magic', async () => {
    const session = await makeSession(buildLotdkSave(), lotdk);
    const decrypted = new Uint8Array(session.decryptedBuffer);
    expect(new TextDecoder().decode(decrypted.slice(0, 4))).toBe('GVAS');
  });

  it('edits StudsCollected and re-encrypts the whole file with the same RC4 key on export', async () => {
    const original = buildLotdkSave({ studsCollected: 100n });
    const session = await makeSession(original, lotdk);
    const { values } = session.readInitialValues();
    values.set('studsCollected', 9999n);

    const { bytes, errors } = await session.buildExport(values);
    expect(errors).toEqual([]);

    // The exported file should itself be RC4-encrypted (same key, symmetric) — decrypting it
    // manually should reveal GVAS and the new studs value at the same located position.
    const manuallyDecrypted = rc4Apply(bytes, LOTDK_KEY);
    expect(new TextDecoder().decode(manuallyDecrypted.slice(0, 4))).toBe('GVAS');

    const nameIdx = manuallyDecrypted.findIndex((_, i) =>
      new TextDecoder().decode(manuallyDecrypted.slice(i, i + 15)) === 'StudsCollected\0',
    );
    expect(nameIdx).toBeGreaterThan(0);
    const typeIdx = nameIdx + 15 + 5; // + gap, per the fixture's layout
    const valueOffset = typeIdx + 23;
    const view = new DataView(manuallyDecrypted.buffer, manuallyDecrypted.byteOffset, manuallyDecrypted.byteLength);
    expect(view.getBigInt64(valueOffset, true)).toBe(9999n);

    // Bytes outside the field's 8-byte value should be unchanged from the original decrypted plaintext.
    const originalDecrypted = rc4Apply(original, LOTDK_KEY);
    for (let i = 0; i < manuallyDecrypted.length; i++) {
      if (i >= valueOffset && i < valueOffset + 8) continue;
      expect(manuallyDecrypted[i]).toBe(originalDecrypted[i]);
    }
  });

  it('omits the field entirely (rather than erroring) when the property name is not found', async () => {
    const plaintext = new TextEncoder().encode('GVAS-but-no-studs-property-here-at-all');
    const encrypted = rc4Apply(plaintext, LOTDK_KEY);
    const session = await makeSession(encrypted, lotdk);
    expect(session.layout.find((f) => f.instanceId === 'studsCollected')).toBeUndefined();
    const { values } = session.readInitialValues();
    expect(values.has('studsCollected')).toBe(false);
  });
});
