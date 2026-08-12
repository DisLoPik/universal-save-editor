/**
 * Offset values in schemas may be written as hex strings ("0x120"), plain
 * decimal strings ("288"), or JSON numbers. This is the single place that
 * parses them so every offset in the app is validated the same way.
 */

export class OffsetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OffsetError';
  }
}

const HEX_PATTERN = /^0x[0-9a-fA-F]+$/;
const DEC_PATTERN = /^\d+$/;

export function parseOffset(value: string | number): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || !Number.isSafeInteger(value)) {
      throw new OffsetError(`Invalid numeric offset: ${value}`);
    }
    return value;
  }

  const trimmed = value.trim();
  if (HEX_PATTERN.test(trimmed)) {
    const parsed = parseInt(trimmed, 16);
    if (!Number.isSafeInteger(parsed)) {
      throw new OffsetError(`Offset out of safe range: "${value}"`);
    }
    return parsed;
  }
  if (DEC_PATTERN.test(trimmed)) {
    const parsed = parseInt(trimmed, 10);
    if (!Number.isSafeInteger(parsed)) {
      throw new OffsetError(`Offset out of safe range: "${value}"`);
    }
    return parsed;
  }
  throw new OffsetError(`Invalid offset syntax: "${value}" (expected hex like "0x120" or a decimal integer)`);
}

export function isValidOffsetSyntax(value: string | number): boolean {
  try {
    parseOffset(value);
    return true;
  } catch {
    return false;
  }
}

export function formatHexOffset(offset: number): string {
  return `0x${offset.toString(16).toUpperCase().padStart(2, '0')}`;
}
