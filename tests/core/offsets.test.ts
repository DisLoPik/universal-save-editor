import { describe, expect, it } from 'vitest';
import { OffsetError, formatHexOffset, isValidOffsetSyntax, parseOffset } from '../../src/core/binary/offsets';

describe('parseOffset', () => {
  it('parses hex strings', () => {
    expect(parseOffset('0x120')).toBe(0x120);
    expect(parseOffset('0x0')).toBe(0);
    expect(parseOffset('0xFF')).toBe(255);
  });

  it('parses decimal strings', () => {
    expect(parseOffset('288')).toBe(288);
    expect(parseOffset('0')).toBe(0);
  });

  it('accepts plain numbers', () => {
    expect(parseOffset(42)).toBe(42);
  });

  it('rejects invalid syntax', () => {
    expect(() => parseOffset('0xZZ')).toThrow(OffsetError);
    expect(() => parseOffset('abc')).toThrow(OffsetError);
    expect(() => parseOffset('-5')).toThrow(OffsetError);
    expect(() => parseOffset('1.5')).toThrow(OffsetError);
  });

  it('rejects negative or non-integer numbers', () => {
    expect(() => parseOffset(-1)).toThrow(OffsetError);
    expect(() => parseOffset(1.5)).toThrow(OffsetError);
  });

  it('isValidOffsetSyntax mirrors parseOffset without throwing', () => {
    expect(isValidOffsetSyntax('0x10')).toBe(true);
    expect(isValidOffsetSyntax('nope')).toBe(false);
  });

  it('formatHexOffset produces an uppercase 0x-prefixed string', () => {
    expect(formatHexOffset(255)).toBe('0xFF');
  });
});
