import { describe, expect, it } from 'vitest';
import { computeChecksum } from '../../src/core/checksum/checksum-engine';

// "123456789" is the standard CRC catalogue check string; the expected
// values below are the published "check" values for each named variant
// (https://reveng.sourceforge.io/crc-catalogue/), used here as an external
// oracle independent of this codebase's own implementation.
const CHECK_STRING = new TextEncoder().encode('123456789');

describe('computeChecksum', () => {
  it('computes CRC-32/ISO-HDLC (zlib crc32) correctly', () => {
    expect(computeChecksum('crc32', CHECK_STRING)).toBe(0xcbf43926);
  });

  it('computes CRC-16/CCITT-FALSE correctly', () => {
    expect(computeChecksum('crc16', CHECK_STRING)).toBe(0x29b1);
  });

  it('computes CRC-8 correctly', () => {
    expect(computeChecksum('crc8', CHECK_STRING)).toBe(0xf4);
  });

  it('computes Adler-32 correctly (Wikipedia example)', () => {
    expect(computeChecksum('adler32', new TextEncoder().encode('Wikipedia'))).toBe(0x11e60398);
  });

  it('computes simple byte sums', () => {
    const data = new Uint8Array([1, 2, 3, 0xff]);
    expect(computeChecksum('sum8', data)).toBe((1 + 2 + 3 + 0xff) & 0xff);
    expect(computeChecksum('sum16', data)).toBe(1 + 2 + 3 + 0xff);
    expect(computeChecksum('sum32', data)).toBe(1 + 2 + 3 + 0xff);
  });

  it('computes an XOR checksum', () => {
    expect(computeChecksum('xor8', new Uint8Array([0x0f, 0xf0, 0x01]))).toBe(0x0f ^ 0xf0 ^ 0x01);
  });

  it('produces a deterministic result for an empty buffer', () => {
    expect(() => computeChecksum('crc32', new Uint8Array(0))).not.toThrow();
    expect(computeChecksum('crc32', new Uint8Array(0))).toBe(0);
  });

  it('supports custom CRC parameters (e.g. CRC-16/XMODEM: poly 0x1021, init 0x0000)', () => {
    const xmodem = computeChecksum('crc16', CHECK_STRING, { initialValue: 0x0000 });
    expect(xmodem).toBe(0x31c3);
  });
});
