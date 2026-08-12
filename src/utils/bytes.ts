export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? value : value.toFixed(2)} ${units[exponent]}`;
}

export function bytesToHex(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(separator);
}

export class HexParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HexParseError';
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const tokens = hex.trim().split(/\s+/).filter(Boolean);
  const out = new Uint8Array(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    if (!/^[0-9a-fA-F]{1,2}$/.test(tokens[i])) {
      throw new HexParseError(`Invalid hex byte: "${tokens[i]}"`);
    }
    out[i] = parseInt(tokens[i], 16);
  }
  return out;
}

export function asciiToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** Plain substring search over bytes, optionally bounded to [from, to). Returns -1 if not found. */
export function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0, to = haystack.length): number {
  if (needle.length === 0) return -1;
  const limit = Math.min(to, haystack.length) - needle.length;
  outer: for (let i = Math.max(0, from); i <= limit; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
