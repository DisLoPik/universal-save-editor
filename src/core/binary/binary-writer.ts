/**
 * A bounds-checked writer that mutates a Uint8Array **in place**. Callers
 * are responsible for handing this a working *copy* of the original save
 * buffer (see SaveSession) — the writer itself has no notion of "original
 * vs. modified"; it just patches bytes, which keeps everything the schema
 * didn't touch byte-for-byte identical to the source file.
 */

export class BinaryWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinaryWriteError';
  }
}

export class BinaryWriter {
  private readonly view: DataView;
  readonly length: number;

  constructor(private readonly buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    this.length = buffer.byteLength;
  }

  private assertRange(offset: number, size: number): void {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BinaryWriteError(`Invalid write offset: ${offset}`);
    }
    if (!Number.isInteger(size) || size < 0) {
      throw new BinaryWriteError(`Invalid write size: ${size}`);
    }
    if (offset + size > this.length) {
      throw new BinaryWriteError(
        `Write out of bounds: offset=${offset} size=${size} bufferLength=${this.length}`,
      );
    }
  }

  uint8(offset: number, value: number): void {
    this.assertRange(offset, 1);
    this.view.setUint8(offset, value);
  }

  int8(offset: number, value: number): void {
    this.assertRange(offset, 1);
    this.view.setInt8(offset, value);
  }

  uint16(offset: number, value: number, little = true): void {
    this.assertRange(offset, 2);
    this.view.setUint16(offset, value, little);
  }

  int16(offset: number, value: number, little = true): void {
    this.assertRange(offset, 2);
    this.view.setInt16(offset, value, little);
  }

  uint32(offset: number, value: number, little = true): void {
    this.assertRange(offset, 4);
    this.view.setUint32(offset, value, little);
  }

  int32(offset: number, value: number, little = true): void {
    this.assertRange(offset, 4);
    this.view.setInt32(offset, value, little);
  }

  uint64(offset: number, value: bigint, little = true): void {
    this.assertRange(offset, 8);
    this.view.setBigUint64(offset, value, little);
  }

  int64(offset: number, value: bigint, little = true): void {
    this.assertRange(offset, 8);
    this.view.setBigInt64(offset, value, little);
  }

  float32(offset: number, value: number, little = true): void {
    this.assertRange(offset, 4);
    this.view.setFloat32(offset, value, little);
  }

  float64(offset: number, value: number, little = true): void {
    this.assertRange(offset, 8);
    this.view.setFloat64(offset, value, little);
  }

  bytes(offset: number, data: Uint8Array): void {
    this.assertRange(offset, data.length);
    this.buffer.set(data, offset);
  }

  bit(offset: number, bitIndex: number, value: boolean): void {
    if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex > 7) {
      throw new BinaryWriteError(`Bit index out of range (0-7): ${bitIndex}`);
    }
    this.assertRange(offset, 1);
    const byte = this.view.getUint8(offset);
    const updated = value ? (byte | (1 << bitIndex)) : (byte & (~(1 << bitIndex) & 0xff));
    this.view.setUint8(offset, updated);
  }

  /**
   * Writes `value` into `bitLength` bits starting at `bitOffset` (0 = LSB)
   * without disturbing any other bits in the covered bytes. Uses plain
   * arithmetic (not JS bitwise operators) throughout so it stays correct up
   * to the full 32-bit span without hitting signed Int32 wraparound.
   */
  bitfield(offset: number, bitOffset: number, bitLength: number, value: number): void {
    if (!Number.isInteger(bitLength) || bitLength <= 0 || bitLength > 32) {
      throw new BinaryWriteError(`Unsupported bitfield length (1-32): ${bitLength}`);
    }
    if (!Number.isInteger(bitOffset) || bitOffset < 0) {
      throw new BinaryWriteError(`Invalid bitfield bitOffset: ${bitOffset}`);
    }
    const byteLength = Math.ceil((bitOffset + bitLength) / 8);
    if (byteLength > 4) {
      throw new BinaryWriteError('Bitfield spans more than 4 bytes; unsupported');
    }
    this.assertRange(offset, byteLength);

    const range = Math.pow(2, bitLength);
    if (!Number.isInteger(value) || value < 0 || value >= range) {
      throw new BinaryWriteError(`Bitfield value ${value} out of range for a ${bitLength}-bit field (0-${range - 1})`);
    }

    let container = 0;
    for (let i = byteLength - 1; i >= 0; i--) {
      container = container * 256 + this.view.getUint8(offset + i);
    }

    const posMultiplier = Math.pow(2, bitOffset);
    const currentFieldValue = Math.floor(container / posMultiplier) % range;
    const updated = container + (value - currentFieldValue) * posMultiplier;

    let remaining = updated;
    for (let i = 0; i < byteLength; i++) {
      this.view.setUint8(offset + i, remaining % 256);
      remaining = Math.floor(remaining / 256);
    }
  }

  asciiString(offset: number, length: number, value: string, padding = 0x00): void {
    const out = new Uint8Array(length).fill(padding);
    const max = Math.min(value.length, length);
    for (let i = 0; i < max; i++) out[i] = value.charCodeAt(i) & 0xff;
    this.bytes(offset, out);
  }

  utf8String(offset: number, length: number, value: string, padding = 0x00): void {
    const out = new Uint8Array(length).fill(padding);
    const encoded = new TextEncoder().encode(value);
    out.set(encoded.subarray(0, length));
    this.bytes(offset, out);
  }

  utf16String(offset: number, length: number, value: string, little = true, padding = 0x0000): void {
    this.assertRange(offset, length);
    const unitCount = Math.floor(length / 2);
    for (let i = 0; i < unitCount; i++) {
      const code = i < value.length ? value.charCodeAt(i) : padding;
      this.view.setUint16(offset + i * 2, code, little);
    }
  }

  nullTerminatedString(offset: number, maxLength: number, value: string, encoding: 'ascii' | 'utf8' = 'utf8'): void {
    this.assertRange(offset, maxLength);
    const encoded = encoding === 'utf8' ? new TextEncoder().encode(value) : asciiBytes(value);
    const out = new Uint8Array(maxLength);
    out.set(encoded.subarray(0, Math.max(0, maxLength - 1)));
    this.bytes(offset, out);
  }
}

function asciiBytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}
