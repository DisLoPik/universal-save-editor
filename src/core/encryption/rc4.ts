/**
 * RC4 (ARC4) — a symmetric stream cipher: encryption and decryption are the
 * exact same keystream-XOR operation, so one function serves both
 * directions. Standard KSA (key-scheduling algorithm) + PRGA
 * (pseudo-random generation algorithm), operating on plain byte arrays with
 * no padding concerns since it's a stream cipher.
 */

export class Rc4Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Rc4Error';
  }
}

export function rc4Apply(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length === 0) throw new Rc4Error('RC4 key must not be empty');

  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
  }

  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
    const k = s[(s[i] + s[j]) & 0xff];
    out[n] = data[n] ^ k;
  }
  return out;
}
