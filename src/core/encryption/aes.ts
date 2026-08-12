/**
 * AES via the browser's native Web Crypto SubtleCrypto — the same API used
 * for hashing elsewhere in this codebase, so it works unchanged in browsers
 * and on Cloudflare's edge runtime. Only CBC and CTR are exposed: both map
 * directly onto standard SubtleCrypto algorithms with no ambiguity. AES-ECB
 * is deliberately NOT supported — see schema-types.ts for why.
 */

export class AesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AesError';
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importAesKey(key: Uint8Array, algorithm: 'AES-CBC' | 'AES-CTR', usage: 'encrypt' | 'decrypt') {
  if (![16, 24, 32].includes(key.length)) {
    throw new AesError(`AES key must be 16, 24, or 32 bytes (got ${key.length})`);
  }
  return crypto.subtle.importKey('raw', toArrayBuffer(key), algorithm, false, [usage]);
}

export async function aesCbcDecrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  if (iv.length !== 16) throw new AesError(`AES-CBC IV must be 16 bytes (got ${iv.length})`);
  const cryptoKey = await importAesKey(key, 'AES-CBC', 'decrypt');
  const result = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(data));
  return new Uint8Array(result);
}

export async function aesCbcEncrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  if (iv.length !== 16) throw new AesError(`AES-CBC IV must be 16 bytes (got ${iv.length})`);
  const cryptoKey = await importAesKey(key, 'AES-CBC', 'encrypt');
  const result = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(data));
  return new Uint8Array(result);
}

export async function aesCtrDecrypt(data: Uint8Array, key: Uint8Array, counter: Uint8Array, counterLength = 64): Promise<Uint8Array> {
  if (counter.length !== 16) throw new AesError(`AES-CTR counter block must be 16 bytes (got ${counter.length})`);
  const cryptoKey = await importAesKey(key, 'AES-CTR', 'decrypt');
  const result = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: toArrayBuffer(counter), length: counterLength },
    cryptoKey,
    toArrayBuffer(data),
  );
  return new Uint8Array(result);
}

export async function aesCtrEncrypt(data: Uint8Array, key: Uint8Array, counter: Uint8Array, counterLength = 64): Promise<Uint8Array> {
  if (counter.length !== 16) throw new AesError(`AES-CTR counter block must be 16 bytes (got ${counter.length})`);
  const cryptoKey = await importAesKey(key, 'AES-CTR', 'encrypt');
  const result = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: toArrayBuffer(counter), length: counterLength },
    cryptoKey,
    toArrayBuffer(data),
  );
  return new Uint8Array(result);
}
