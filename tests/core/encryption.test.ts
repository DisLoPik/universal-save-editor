import { describe, expect, it } from 'vitest';
import { rc4Apply } from '../../src/core/encryption/rc4';
import { xorApply } from '../../src/core/encryption/xor-cipher';
import { aesCbcDecrypt, aesCbcEncrypt, aesCtrDecrypt, aesCtrEncrypt } from '../../src/core/encryption/aes';
import { decryptForSchema, encryptForSchema, trialDecryptRegion } from '../../src/core/encryption/encryption-engine';
import { bytesToHex, hexToBytes } from '../../src/utils/bytes';
import type { SaveSchema } from '../../src/core/schema/schema-types';

function ascii(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('RC4 (Wikipedia standard test vectors)', () => {
  it('Key="Key", Plaintext="Plaintext" -> BBF316E8D940AF0AD3', () => {
    const out = rc4Apply(ascii('Plaintext'), ascii('Key'));
    expect(bytesToHex(out, '')).toBe('BBF316E8D940AF0AD3');
  });

  it('Key="Wiki", Plaintext="pedia" -> 1021BF0420', () => {
    const out = rc4Apply(ascii('pedia'), ascii('Wiki'));
    expect(bytesToHex(out, '')).toBe('1021BF0420');
  });

  it('is symmetric: applying twice with the same key recovers the original', () => {
    const key = ascii('some-key');
    const plaintext = ascii('recover me exactly');
    const ciphertext = rc4Apply(plaintext, key);
    const recovered = rc4Apply(ciphertext, key);
    expect(new TextDecoder().decode(recovered)).toBe('recover me exactly');
  });
});

describe('XOR cipher', () => {
  it('is symmetric with a repeating key', () => {
    const key = hexToBytes('AA BB');
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
    const ciphertext = xorApply(plaintext, key);
    expect([...ciphertext]).toEqual([1 ^ 0xaa, 2 ^ 0xbb, 3 ^ 0xaa, 4 ^ 0xbb, 5 ^ 0xaa]);
    expect([...xorApply(ciphertext, key)]).toEqual([...plaintext]);
  });
});

describe('AES via Web Crypto (round-trip correctness of this codebase\'s glue code)', () => {
  it('AES-CBC round-trips', async () => {
    const key = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const plaintext = ascii('a message that needs padding');
    const ciphertext = await aesCbcEncrypt(plaintext, key, iv);
    const decrypted = await aesCbcDecrypt(ciphertext, key, iv);
    expect(new TextDecoder().decode(decrypted)).toBe('a message that needs padding');
  });

  it('AES-CTR round-trips', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const counter = crypto.getRandomValues(new Uint8Array(16));
    const plaintext = ascii('exact block length');
    const ciphertext = await aesCtrEncrypt(plaintext, key, counter);
    const decrypted = await aesCtrDecrypt(ciphertext, key, counter);
    expect(new TextDecoder().decode(decrypted)).toBe('exact block length');
  });

  it('decrypting with the wrong key does not recover the plaintext', async () => {
    const key = crypto.getRandomValues(new Uint8Array(16));
    const wrongKey = crypto.getRandomValues(new Uint8Array(16));
    const iv = new Uint8Array(16);
    const ciphertext = await aesCbcEncrypt(ascii('secret data'), key, iv);
    await expect(aesCbcDecrypt(ciphertext, wrongKey, iv)).rejects.toThrow();
  });
});

describe('encryption-engine (schema-driven decrypt/encrypt)', () => {
  const rc4Schema: SaveSchema = {
    id: 'test-rc4',
    game: 'Test',
    platform: 'PC',
    schemaVersion: 1,
    fingerprints: [{ rules: [{ type: 'fileSize', value: 4 }] }],
    fields: [{ id: 'x', name: 'X', type: 'uint8', offset: '0x0' }],
    encryption: [
      {
        id: 'main',
        algorithm: 'rc4',
        range: { start: '0x0', end: 'eof' },
        key: { type: 'literal', value: '4B 65 79' }, // "Key"
      },
    ],
  };

  it('decryptForSchema/encryptForSchema round-trip a whole-file RC4 region', async () => {
    const plaintext = ascii('GVAS-like-plaintext!!!!'); // arbitrary content
    const encrypted = rc4Apply(plaintext, ascii('Key'));

    const decrypted = await decryptForSchema(rc4Schema, encrypted.buffer as ArrayBuffer);
    expect(new TextDecoder().decode(new Uint8Array(decrypted))).toBe('GVAS-like-plaintext!!!!');

    const reEncrypted = await encryptForSchema(rc4Schema, decrypted, encrypted.buffer as ArrayBuffer);
    expect([...new Uint8Array(reEncrypted)]).toEqual([...encrypted]);
  });

  it('returns the buffer unchanged when the schema declares no encryption', async () => {
    const schemaNoEncryption: SaveSchema = { ...rc4Schema, encryption: undefined };
    const data = ascii('plain data');
    const result = await decryptForSchema(schemaNoEncryption, data.buffer as ArrayBuffer);
    expect([...new Uint8Array(result)]).toEqual([...data]);
  });

  it('trialDecryptRegion decrypts without needing a full schema (used by fingerprinting)', async () => {
    const plaintext = ascii('GVAS');
    const encrypted = rc4Apply(plaintext, ascii('Key'));
    const result = await trialDecryptRegion(
      { id: 'x', algorithm: 'rc4', range: { start: '0x0', end: 'eof' }, key: { type: 'literal', value: '4B 65 79' } },
      encrypted.buffer as ArrayBuffer,
    );
    expect(new TextDecoder().decode(result)).toBe('GVAS');
  });

  it('resolves a fileRegion key source from the original (undecrypted) buffer', async () => {
    // First 3 bytes of the file ARE the XOR key; the rest is the encrypted payload.
    const key = ascii('Key');
    const plaintext = ascii('payload');
    const encryptedPayload = xorApply(plaintext, key);
    const file = new Uint8Array(key.length + encryptedPayload.length);
    file.set(key, 0);
    file.set(encryptedPayload, key.length);

    const schema: SaveSchema = {
      ...rc4Schema,
      encryption: [
        {
          id: 'main',
          algorithm: 'xor',
          range: { start: key.length, end: 'eof' },
          key: { type: 'fileRegion', offset: '0x0', length: key.length },
        },
      ],
    };
    const decrypted = await decryptForSchema(schema, file.buffer as ArrayBuffer);
    const decryptedBytes = new Uint8Array(decrypted);
    expect(new TextDecoder().decode(decryptedBytes.slice(key.length))).toBe('payload');
  });
});
