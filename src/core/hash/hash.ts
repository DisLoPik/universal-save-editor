/**
 * Uses the standard Web Crypto SubtleCrypto API (`crypto.subtle`), which is
 * available in every modern browser, in Cloudflare Workers, and in Node 20+.
 * Deliberately NOT using Node's `node:crypto` module — that would break the
 * moment this code runs anywhere other than a Node process (browsers,
 * Cloudflare's edge runtime, etc. don't have it).
 */

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  return data;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  return bufferToHex(digest);
}

export async function sha1Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', toArrayBuffer(data));
  return bufferToHex(digest);
}
