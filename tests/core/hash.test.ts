import { describe, expect, it } from 'vitest';
import { sha1Hex, sha256Hex } from '../../src/core/hash/hash';

describe('hash (Web Crypto SubtleCrypto)', () => {
  it('computes SHA-256 of an empty buffer', async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('computes SHA-256 of "abc"', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('computes SHA-1 of an empty buffer', async () => {
    expect(await sha1Hex(new Uint8Array(0))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('computes SHA-1 of "abc"', async () => {
    expect(await sha1Hex(new TextEncoder().encode('abc'))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });
});
