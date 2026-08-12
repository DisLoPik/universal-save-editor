import { computeChecksum } from '../../src/core/checksum/checksum-engine';
import { rc4Apply } from '../../src/core/encryption/rc4';
import { asciiToBytes } from '../../src/utils/bytes';

export interface PixelQuestOverrides {
  playerName?: string;
  level?: number;
  money?: number;
  hardcoreMode?: boolean;
  difficultyMultiplier?: number;
  secretSeed?: number[];
}

/** Matches schemas/nintendo-3ds/pixel-quest/usa-v1.json exactly. */
export function buildPixelQuestSave(overrides: PixelQuestOverrides = {}): Uint8Array {
  const buf = new Uint8Array(128);
  const view = new DataView(buf.buffer);

  buf.set([0x50, 0x58, 0x4c, 0x51, 0x53, 0x54, 0x30, 0x31], 0x0); // "PXLQST01"

  const name = overrides.playerName ?? 'Barry';
  for (let i = 0; i < 16; i++) buf[0x8 + i] = i < name.length ? name.charCodeAt(i) : 0;

  buf[0x18] = overrides.level ?? 42;
  view.setUint32(0x19, overrides.money ?? 50000, true);
  buf[0x1d] = overrides.hardcoreMode ? 1 : 0;
  view.setFloat32(0x1e, overrides.difficultyMultiplier ?? 1.5, true);
  buf.set(overrides.secretSeed ?? [0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04], 0x22);
  buf[0x2a] = 0x01; // format version — fingerprint-only, not a declared field

  return buf;
}

export interface IronKeepOverrides {
  difficulty?: number;
  hasMap?: boolean;
  hasSword?: boolean;
  hasShield?: boolean;
  hasBoat?: boolean;
  currentChapter?: number;
  bossDefeated?: boolean;
  strength?: number;
  defense?: number;
  speed?: number;
  hp?: number;
  magicPercentRaw?: number;
}

/** Matches schemas/gbc/iron-keep/usa-v1.json exactly. */
export function buildIronKeepSave(overrides: IronKeepOverrides = {}): Uint8Array {
  const buf = new Uint8Array(64);
  const view = new DataView(buf.buffer);

  buf.set([0x49, 0x52, 0x4e, 0x4b], 0x0); // "IRNK"
  buf[0x4] = 0x01;
  buf[0x5] = overrides.difficulty ?? 1;

  let unlockByte = 0;
  if (overrides.hasMap ?? true) unlockByte |= 1 << 0;
  if (overrides.hasSword ?? true) unlockByte |= 1 << 1;
  if (overrides.hasShield ?? false) unlockByte |= 1 << 2;
  if (overrides.hasBoat ?? false) unlockByte |= 1 << 3;
  buf[0x6] = unlockByte;

  let questByte = (overrides.currentChapter ?? 3) & 0b111;
  if (overrides.bossDefeated ?? false) questByte |= 1 << 3;
  buf[0x7] = questByte;

  buf[0x8] = overrides.strength ?? 12;
  buf[0x9] = overrides.defense ?? 8;
  buf[0xa] = overrides.speed ?? 10;
  view.setUint16(0xb, overrides.hp ?? 120, true);
  buf[0xd] = overrides.magicPercentRaw ?? 100; // raw 100 -> displayed 50 (divisor 2)

  return buf;
}

export interface StarForgeOverrides {
  hp?: number;
  mp?: number;
  atk?: number;
  def?: number;
  gold?: number;
  items?: Array<[number, number]>;
}

/** Matches schemas/pc/star-forge/v1.json exactly, including a correct CRC32. */
export function buildStarForgeSave(overrides: StarForgeOverrides = {}): Uint8Array {
  const buf = new Uint8Array(68);
  const view = new DataView(buf.buffer);

  buf.set([0x53, 0x46, 0x52, 0x47], 0x0); // "SFRG"
  buf[0x4] = 0x01;

  view.setUint16(0x8, overrides.hp ?? 500, true);
  view.setUint16(0xa, overrides.mp ?? 80, true);
  buf[0xc] = overrides.atk ?? 15;
  buf[0xd] = overrides.def ?? 10;

  view.setUint32(0x10, overrides.gold ?? 1234, true);

  const items: Array<[number, number]> = overrides.items ?? [
    [1, 3],
    [2, 1],
    [0, 0],
    [0, 0],
    [4, 1],
  ];
  for (let i = 0; i < 5; i++) {
    const [itemId, quantity] = items[i] ?? [0, 0];
    view.setUint16(0x20 + i * 4, itemId, true);
    view.setUint16(0x20 + i * 4 + 2, quantity, true);
  }

  const dataForChecksum = buf.slice(0x0, 0x40);
  const crc = computeChecksum('crc32', dataForChecksum);
  view.setUint32(0x40, crc, true);

  return buf;
}

export interface PokemonDiamondPearlOverrides {
  trainerId?: number;
  secretId?: number;
  money?: number;
  playTimeHours?: number;
  playTimeMinutes?: number;
  playTimeSeconds?: number;
}

/**
 * Matches schemas/nintendo-ds/pokemon-diamond-pearl/usa-v1.json's documented
 * layout (trainer block only — the rest of the 512KB save is left zeroed,
 * which is fine since only the declared fields + checksum range are read).
 */
export function buildPokemonDiamondPearlSave(overrides: PokemonDiamondPearlOverrides = {}): Uint8Array {
  const buf = new Uint8Array(524288);
  const view = new DataView(buf.buffer);

  view.setUint16(0x78, overrides.trainerId ?? 12345, true);
  view.setUint16(0x7a, overrides.secretId ?? 54321, true);
  view.setUint32(0x7c, overrides.money ?? 3000, true);
  view.setUint16(0x8a, overrides.playTimeHours ?? 10, true);
  buf[0x8c] = overrides.playTimeMinutes ?? 30;
  buf[0x8d] = overrides.playTimeSeconds ?? 15;

  const data = buf.slice(0x0, 0xc0ec);
  const crc = computeChecksum('crc16', data);
  view.setUint16(0xc0fe, crc, true);

  return buf;
}

export interface LotdkOverrides {
  studsCollected?: bigint;
}

const LOTDK_RC4_KEY = Uint8Array.from([
  0x21, 0x38, 0x11, 0x60, 0x17, 0x47, 0x2f, 0x53, 0x5d, 0x37, 0x24, 0x0e, 0x0e, 0x0f, 0x60, 0x43, 0x2f, 0x0e, 0x3f,
  0x0a, 0x27, 0x55, 0x4b, 0x0b, 0x4f, 0x59, 0x25, 0x38, 0x0b, 0x3a, 0x44, 0x17,
]);

/**
 * A synthetic (not real-captured) GVAS-shaped buffer matching
 * schemas/pc/lego-batman-lotdk/steam-v1.json's verified property-search
 * layout: "StudsCollected\0", then "Int64Property\0" (within 45 bytes),
 * then the value 23 bytes after the start of that match (8 bytes = a
 * 4-byte GVAS-style length prefix + 4 bytes of padding, then the int64).
 * The whole thing is RC4-encrypted with the verified key, exactly as a
 * real save would be. Real GVAS internals beyond what this schema reads
 * are not modeled.
 */
export function buildLotdkSave(overrides: LotdkOverrides = {}): Uint8Array {
  const header = asciiToBytes('GVAS' + '\0'.repeat(20)); // magic + placeholder version/header bytes
  const name = asciiToBytes('StudsCollected\0');
  const gap = new Uint8Array(5); // bytes between the name and the type tag, well within the 45-byte search window
  const typeTag = asciiToBytes('Int64Property\0'); // 14 bytes
  const preamble = new Uint8Array(9); // 23 - 14 = 9 bytes between the start of the type tag and the value
  const value = new Uint8Array(8);
  new DataView(value.buffer).setBigInt64(0, overrides.studsCollected ?? 4200n, true);
  const trailer = new Uint8Array(16);

  const plaintext = new Uint8Array(header.length + name.length + gap.length + typeTag.length + preamble.length + value.length + trailer.length);
  let offset = 0;
  for (const part of [header, name, gap, typeTag, preamble, value, trailer]) {
    plaintext.set(part, offset);
    offset += part.length;
  }

  return rc4Apply(plaintext, LOTDK_RC4_KEY);
}
