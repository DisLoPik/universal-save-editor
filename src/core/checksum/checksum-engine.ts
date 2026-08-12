/**
 * Modular checksum engine. CRC-8/16/32 all share one generic, parameterized
 * bit-by-bit CRC implementation (the standard "Rocksoft" model: width, poly,
 * init, reflect-in, reflect-out, xor-out) so adding another CRC width/variant
 * later is a one-line preset, not new code.
 */

export type ChecksumAlgorithm = 'crc32' | 'crc16' | 'crc8' | 'adler32' | 'sum8' | 'sum16' | 'sum32' | 'xor8';

export interface ChecksumParams {
  /** Override the default polynomial (unreflected form) for crc8/16/32. */
  polynomial?: number;
  initialValue?: number;
  finalXor?: number;
  reflectIn?: boolean;
  reflectOut?: boolean;
}

export class ChecksumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChecksumError';
  }
}

interface CrcSpec {
  width: number;
  poly: number;
  init: number;
  refIn: boolean;
  refOut: boolean;
  xorOut: number;
}

/** Well-known default variant per width: CRC-32/ISO-HDLC, CRC-16/CCITT-FALSE, CRC-8 (poly 0x07). */
const CRC_PRESETS: Record<'crc8' | 'crc16' | 'crc32', CrcSpec> = {
  crc32: { width: 32, poly: 0x04c11db7, init: 0xffffffff, refIn: true, refOut: true, xorOut: 0xffffffff },
  crc16: { width: 16, poly: 0x1021, init: 0xffff, refIn: false, refOut: false, xorOut: 0x0000 },
  crc8: { width: 8, poly: 0x07, init: 0x00, refIn: false, refOut: false, xorOut: 0x00 },
};

function reflect(value: number, bits: number): number {
  let result = 0;
  let v = value;
  for (let i = 0; i < bits; i++) {
    result = result * 2 + (v % 2);
    v = Math.floor(v / 2);
  }
  return result;
}

function crcGeneric(data: Uint8Array, spec: CrcSpec): number {
  const mask = spec.width === 32 ? 0xffffffff : Math.pow(2, spec.width) - 1;
  let crc = (spec.init & mask) >>> 0;
  for (const raw of data) {
    const byte = spec.refIn ? reflect(raw, 8) : raw;
    crc ^= byte * Math.pow(2, spec.width - 8);
    crc >>>= 0;
    for (let bit = 0; bit < 8; bit++) {
      const msb = spec.width === 32 ? (crc & 0x80000000) !== 0 : ((crc >>> (spec.width - 1)) & 1) === 1;
      crc = (crc * 2) >>> 0;
      if (msb) crc = (crc ^ spec.poly) >>> 0;
      // For width 32 the mask is 0xFFFFFFFF, which as an `&` operand forces a
      // signed Int32 result (e.g. -1) in JS — skip it there since `>>> 0`
      // above already normalizes to the full unsigned 32-bit value.
      if (spec.width < 32) crc &= mask;
    }
  }
  if (spec.refOut) crc = reflect(crc, spec.width);
  crc = (crc ^ spec.xorOut) >>> 0;
  // Same signed-Int32 pitfall as above: `& mask` alone would re-sign a
  // width-32 result (mask is 0xFFFFFFFF, i.e. -1 as an Int32 operand).
  return (crc & mask) >>> 0;
}

function resolveSpec(preset: 'crc8' | 'crc16' | 'crc32', params: ChecksumParams): CrcSpec {
  const base = CRC_PRESETS[preset];
  return {
    width: base.width,
    poly: params.polynomial ?? base.poly,
    init: params.initialValue ?? base.init,
    refIn: params.reflectIn ?? base.refIn,
    refOut: params.reflectOut ?? base.refOut,
    xorOut: params.finalXor ?? base.xorOut,
  };
}

function adler32(data: Uint8Array): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}

function sumBytes(data: Uint8Array): number {
  let sum = 0;
  for (const byte of data) sum += byte;
  return sum;
}

function xor8(data: Uint8Array): number {
  let x = 0;
  for (const byte of data) x ^= byte;
  return x & 0xff;
}

export function computeChecksum(
  algorithm: ChecksumAlgorithm,
  data: Uint8Array,
  params: ChecksumParams = {},
): number {
  switch (algorithm) {
    case 'crc32':
      return crcGeneric(data, resolveSpec('crc32', params));
    case 'crc16':
      return crcGeneric(data, resolveSpec('crc16', params));
    case 'crc8':
      return crcGeneric(data, resolveSpec('crc8', params));
    case 'adler32':
      return adler32(data);
    case 'sum8':
      return sumBytes(data) & 0xff;
    case 'sum16':
      return sumBytes(data) & 0xffff;
    case 'sum32':
      return sumBytes(data) >>> 0;
    case 'xor8':
      return xor8(data);
    default:
      throw new ChecksumError(`Unsupported checksum algorithm: ${algorithm as string}`);
  }
}

export function checksumByteWidth(algorithm: ChecksumAlgorithm): number {
  switch (algorithm) {
    case 'crc32':
    case 'sum32':
      return 4;
    case 'crc16':
    case 'sum16':
      return 2;
    case 'crc8':
    case 'sum8':
    case 'xor8':
      return 1;
    case 'adler32':
      return 4;
    default:
      throw new ChecksumError(`Unsupported checksum algorithm: ${algorithm as string}`);
  }
}

export const SUPPORTED_CHECKSUM_ALGORITHMS: ChecksumAlgorithm[] = [
  'crc32',
  'crc16',
  'crc8',
  'adler32',
  'sum8',
  'sum16',
  'sum32',
  'xor8',
];
