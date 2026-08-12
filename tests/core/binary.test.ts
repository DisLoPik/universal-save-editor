import { describe, expect, it } from 'vitest';
import { BinaryReader, BinaryReadError } from '../../src/core/binary/binary-reader';
import { BinaryWriter, BinaryWriteError } from '../../src/core/binary/binary-writer';

function makeBuffer(bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

describe('BinaryReader', () => {
  it('reads unsigned and signed integers with correct endianness', () => {
    const reader = new BinaryReader(makeBuffer([0x01, 0x02, 0x03, 0x04]).buffer);
    expect(reader.uint32(0, true)).toBe(0x04030201);
    expect(reader.uint32(0, false)).toBe(0x01020304);
    expect(reader.uint16(0, true)).toBe(0x0201);
  });

  it('reads negative signed integers correctly', () => {
    const reader = new BinaryReader(makeBuffer([0xff, 0xff, 0xff, 0xff]).buffer);
    expect(reader.int8(0)).toBe(-1);
    expect(reader.int16(0, true)).toBe(-1);
    expect(reader.int32(0, true)).toBe(-1);
  });

  it('reads 64-bit integers as bigint', () => {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, 1234567890123n, true);
    const reader = new BinaryReader(buf.buffer);
    expect(reader.uint64(0, true)).toBe(1234567890123n);
  });

  it('reads floats', () => {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setFloat32(0, 3.5, true);
    const reader = new BinaryReader(buf.buffer);
    expect(reader.float32(0, true)).toBeCloseTo(3.5);
  });

  it('reads a single bit', () => {
    const reader = new BinaryReader(makeBuffer([0b0000_1010]).buffer);
    expect(reader.bit(0, 1)).toBe(true);
    expect(reader.bit(0, 0)).toBe(false);
    expect(reader.bit(0, 3)).toBe(true);
  });

  it('reads a bitfield spanning part of a byte', () => {
    // 0b1101_0110 -> bits 1..3 (value 011 = 3), bits 4..7 (value 1101 = 13)
    const reader = new BinaryReader(makeBuffer([0b1101_0110]).buffer);
    expect(reader.bitfield(0, 1, 3)).toBe(3);
    expect(reader.bitfield(0, 4, 4)).toBe(13);
  });

  it('reads a bitfield spanning two bytes', () => {
    // little-endian composed 16-bit value: 0x1234 -> bits 4..11 (a full byte shifted by nibble)
    const buf = makeBuffer([0x34, 0x12]);
    const reader = new BinaryReader(buf.buffer);
    expect(reader.bitfield(0, 4, 8)).toBe(0x23);
  });

  it('reads fixed and null-terminated ascii strings', () => {
    const bytes = [72, 101, 108, 108, 111, 0, 0, 0]; // "Hello\0\0\0"
    const reader = new BinaryReader(makeBuffer(bytes).buffer);
    expect(reader.asciiString(0, 8)).toBe('Hello');
    expect(reader.nullTerminatedString(0, 8, 'ascii')).toBe('Hello');
  });

  it('reads utf16 strings', () => {
    const buf = new Uint8Array(10);
    const view = new DataView(buf.buffer);
    const str = 'Hi!';
    for (let i = 0; i < str.length; i++) view.setUint16(i * 2, str.charCodeAt(i), true);
    const reader = new BinaryReader(buf.buffer);
    expect(reader.utf16String(0, 10, true)).toBe('Hi!');
  });

  it('throws BinaryReadError on out-of-bounds reads', () => {
    const reader = new BinaryReader(makeBuffer([1, 2, 3]).buffer);
    expect(() => reader.uint32(0)).toThrow(BinaryReadError);
    expect(() => reader.uint8(10)).toThrow(BinaryReadError);
    expect(() => reader.bytes(2, 5)).toThrow(BinaryReadError);
  });

  it('inBounds reports without throwing', () => {
    const reader = new BinaryReader(makeBuffer([1, 2, 3]).buffer);
    expect(reader.inBounds(0, 3)).toBe(true);
    expect(reader.inBounds(1, 3)).toBe(false);
    expect(reader.inBounds(-1, 1)).toBe(false);
  });
});

describe('BinaryWriter', () => {
  it('writes integers and preserves surrounding bytes', () => {
    const buf = new Uint8Array([0xaa, 0xaa, 0xaa, 0xaa, 0xaa]);
    const writer = new BinaryWriter(buf);
    writer.uint16(1, 0x1234, true);
    expect([...buf]).toEqual([0xaa, 0x34, 0x12, 0xaa, 0xaa]);
  });

  it('writes 64-bit integers', () => {
    const buf = new Uint8Array(8);
    const writer = new BinaryWriter(buf);
    writer.uint64(0, 1234567890123n, true);
    expect(new DataView(buf.buffer).getBigUint64(0, true)).toBe(1234567890123n);
  });

  it('round-trips a single bit without disturbing others', () => {
    const buf = new Uint8Array([0b0000_0000]);
    const writer = new BinaryWriter(buf);
    writer.bit(0, 2, true);
    expect(buf[0]).toBe(0b0000_0100);
    writer.bit(0, 2, false);
    expect(buf[0]).toBe(0);
  });

  it('round-trips a bitfield without disturbing surrounding bits', () => {
    const buf = new Uint8Array([0b1111_0000]);
    const writer = new BinaryWriter(buf);
    writer.bitfield(0, 0, 4, 0b1010);
    expect(buf[0]).toBe(0b1111_1010);
  });

  it('rejects bitfield values that do not fit', () => {
    const buf = new Uint8Array([0]);
    const writer = new BinaryWriter(buf);
    expect(() => writer.bitfield(0, 0, 3, 8)).toThrow(BinaryWriteError);
  });

  it('writes fixed-length ascii strings with padding', () => {
    const buf = new Uint8Array(8).fill(0xff);
    const writer = new BinaryWriter(buf);
    writer.asciiString(0, 8, 'Hi');
    expect([...buf]).toEqual([72, 105, 0, 0, 0, 0, 0, 0]);
  });

  it('writes null-terminated strings truncated to maxLength - 1', () => {
    const buf = new Uint8Array(4).fill(0xff);
    const writer = new BinaryWriter(buf);
    writer.nullTerminatedString(0, 4, 'Hello', 'ascii');
    expect([...buf]).toEqual([72, 101, 108, 0]);
  });

  it('throws BinaryWriteError on out-of-bounds writes', () => {
    const buf = new Uint8Array(2);
    const writer = new BinaryWriter(buf);
    expect(() => writer.uint32(0, 1)).toThrow(BinaryWriteError);
  });
});
