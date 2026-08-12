/** Repeating-key XOR — also symmetric (encrypt === decrypt). */

export class XorCipherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XorCipherError';
  }
}

export function xorApply(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length === 0) throw new XorCipherError('XOR key must not be empty');
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}
