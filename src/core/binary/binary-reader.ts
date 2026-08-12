/**
 * A bounds-checked reader over an ArrayBuffer. Every read validates the
 * requested range against the buffer length first — schemas are untrusted
 * input (community-contributed JSON), so an out-of-range offset must raise
 * a catchable error instead of corrupting memory or throwing an opaque
 * RangeError deep inside DataView.
 */

export class BinaryReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinaryReadError';
  }
}

export class BinaryReader {
  private readonly view: DataView;
  readonly length: number;

  constructor(buffer: ArrayBufferLike, byteOffset = 0, byteLength?: number) {
    this.view = new DataView(buffer, byteOffset, byteLength);
    this.length = this.view.byteLength;
  }

  private assertRange(offset: number, size: number): void {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BinaryReadError(`Invalid read offset: ${offset}`);
    }
    if (!Number.isInteger(size) || size < 0) {
      throw new BinaryReadError(`Invalid read size: ${size}`);
    }
    if (offset + size > this.length) {
      throw new BinaryReadError(
        `Read out of bounds: offset=${offset} size=${size} bufferLength=${this.length}`,
      );
    }
  }

  inBounds(offset: number, size: number): boolean {
    return Number.isInteger(offset) && Number.isInteger(size) && offset >= 0 && size >= 0 && offset + size <= this.length;
  }

  uint8(offset: number): number {
    this.assertRange(offset, 1);
    return this.view.getUint8(offset);
  }

  int8(offset: number): number {
    this.assertRange(offset, 1);
    return this.view.getInt8(offset);
  }

  uint16(offset: number, little = true): number {
    this.assertRange(offset, 2);
    return this.view.getUint16(offset, little);
  }

  int16(offset: number, little = true): number {
    this.assertRange(offset, 2);
    return this.view.getInt16(offset, little);
  }

  uint32(offset: number, little = true): number {
    this.assertRange(offset, 4);
    return this.view.getUint32(offset, little);
  }

  int32(offset: number, little = true): number {
    this.assertRange(offset, 4);
    return this.view.getInt32(offset, little);
  }

  uint64(offset: number, little = true): bigint {
    this.assertRange(offset, 8);
    return this.view.getBigUint64(offset, little);
  }

  int64(offset: number, little = true): bigint {
    this.assertRange(offset, 8);
    return this.view.getBigInt64(offset, little);
  }

  float32(offset: number, little = true): number {
    this.assertRange(offset, 4);
    return this.view.getFloat32(offset, little);
  }

  float64(offset: number, little = true): number {
    this.assertRange(offset, 8);
    return this.view.getFloat64(offset, little);
  }

  /** Returns a copy — never a live view — so callers can't mutate the source buffer through it. */
  bytes(offset: number, length: number): Uint8Array {
    this.assertRange(offset, length);
    return new Uint8Array(this.view.buffer, this.view.byteOffset + offset, length).slice();
  }

  bit(offset: number, bitIndex: number): boolean {
    if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex > 7) {
      throw new BinaryReadError(`Bit index out of range (0-7): ${bitIndex}`);
    }
    const byte = this.uint8(offset);
    return ((byte >> bitIndex) & 1) === 1;
  }

  /**
   * Reads `bitLength` bits starting at `bitOffset` (0 = least significant
   * bit) from the little-endian integer formed by the bytes needed to cover
   * that span, starting at `offset`. Limited to 32 bits total so results fit
   * safely in a JS number.
   */
  bitfield(offset: number, bitOffset: number, bitLength: number): number {
    if (!Number.isInteger(bitLength) || bitLength <= 0 || bitLength > 32) {
      throw new BinaryReadError(`Unsupported bitfield length (1-32): ${bitLength}`);
    }
    if (!Number.isInteger(bitOffset) || bitOffset < 0) {
      throw new BinaryReadError(`Invalid bitfield bitOffset: ${bitOffset}`);
    }
    const byteLength = Math.ceil((bitOffset + bitLength) / 8);
    if (byteLength > 4) {
      throw new BinaryReadError('Bitfield spans more than 4 bytes; unsupported');
    }
    this.assertRange(offset, byteLength);
    let value = 0;
    for (let i = byteLength - 1; i >= 0; i--) {
      value = value * 256 + this.view.getUint8(offset + i);
    }
    value = Math.floor(value / Math.pow(2, bitOffset));
    const mask = Math.pow(2, bitLength) - 1;
    return value % (mask + 1);
  }

  asciiString(offset: number, length: number): string {
    const bytes = this.bytes(offset, length);
    let out = '';
    for (const b of bytes) out += String.fromCharCode(b);
    return out.replace(/\0+$/, '');
  }

  utf8String(offset: number, length: number): string {
    const bytes = this.bytes(offset, length);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0+$/, '');
  }

  utf16String(offset: number, length: number, little = true): string {
    this.assertRange(offset, length);
    const units: number[] = [];
    for (let i = 0; i + 1 < length; i += 2) {
      units.push(this.view.getUint16(offset + i, little));
    }
    let out = '';
    for (const u of units) out += String.fromCharCode(u);
    return out.replace(/\0+$/, '');
  }

  nullTerminatedString(offset: number, maxLength: number, encoding: 'ascii' | 'utf8' = 'utf8'): string {
    this.assertRange(offset, maxLength);
    let end = offset;
    const limit = offset + maxLength;
    while (end < limit && this.view.getUint8(end) !== 0) end++;
    const len = end - offset;
    return encoding === 'ascii' ? this.asciiString(offset, len) : this.utf8String(offset, len);
  }
}
