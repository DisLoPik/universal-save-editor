/**
 * Declarative, data-only value transformations. Schemas describe a pipeline
 * of steps applied when turning a raw stored value into the number shown in
 * the UI ("forward"), and the exact inverse pipeline when turning an edited
 * display value back into the raw value to store ("reverse").
 *
 * Deliberately NOT a scripting language: no eval, no arbitrary expressions.
 * Every step is a fixed, whitelisted operation with fully-typed parameters,
 * per the project's security requirements.
 */

export type TransformStep =
  | { type: 'multiply'; factor: number }
  | { type: 'divide'; factor: number }
  | { type: 'add'; value: number }
  | { type: 'subtract'; value: number }
  | { type: 'xor'; mask: number }
  | { type: 'bitmaskAnd'; mask: number }
  | { type: 'shiftLeft'; bits: number }
  | { type: 'shiftRight'; bits: number }
  | { type: 'toSigned'; bits: number }
  | { type: 'toUnsigned'; bits: number }
  | { type: 'fixedPoint'; fractionalBits: number }
  | { type: 'scale'; divisor: number };

export class TransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransformError';
  }
}

function wrapUnsigned(v: number, bits: number): number {
  const range = Math.pow(2, bits);
  return ((v % range) + range) % range;
}

function toSigned(v: number, bits: number): number {
  const range = Math.pow(2, bits);
  const unsigned = wrapUnsigned(v, bits);
  const half = range / 2;
  return unsigned >= half ? unsigned - range : unsigned;
}

function stepForward(v: number, step: TransformStep): number {
  switch (step.type) {
    case 'multiply':
      return v * step.factor;
    case 'divide':
      if (step.factor === 0) throw new TransformError('divide transform: factor is 0');
      return v / step.factor;
    case 'add':
      return v + step.value;
    case 'subtract':
      return v - step.value;
    case 'xor':
      return v ^ step.mask;
    case 'bitmaskAnd':
      return v & step.mask;
    case 'shiftLeft':
      return v * Math.pow(2, step.bits);
    case 'shiftRight':
      return Math.floor(v / Math.pow(2, step.bits));
    case 'toSigned':
      return toSigned(v, step.bits);
    case 'toUnsigned':
      return wrapUnsigned(v, step.bits);
    case 'fixedPoint':
      return v / Math.pow(2, step.fractionalBits);
    case 'scale':
      if (step.divisor === 0) throw new TransformError('scale transform: divisor is 0');
      return v / step.divisor;
    default:
      throw new TransformError(`Unknown transform step: ${(step as { type: string }).type}`);
  }
}

function stepReverse(v: number, step: TransformStep): number {
  switch (step.type) {
    case 'multiply':
      if (step.factor === 0) throw new TransformError('multiply transform: factor is 0');
      return v / step.factor;
    case 'divide':
      return v * step.factor;
    case 'add':
      return v - step.value;
    case 'subtract':
      return v + step.value;
    case 'xor':
      return v ^ step.mask;
    case 'bitmaskAnd':
      // Not perfectly invertible — only safe as a display-only/final step.
      return v;
    case 'shiftLeft':
      return Math.floor(v / Math.pow(2, step.bits));
    case 'shiftRight':
      return v * Math.pow(2, step.bits);
    case 'toSigned':
      return wrapUnsigned(v, step.bits);
    case 'toUnsigned':
      return toSigned(v, step.bits);
    case 'fixedPoint':
      return Math.round(v * Math.pow(2, step.fractionalBits));
    case 'scale':
      return Math.round(v * step.divisor);
    default:
      throw new TransformError(`Unknown transform step: ${(step as { type: string }).type}`);
  }
}

/** raw stored value -> display value */
export function applyTransformsForward(raw: number, steps: TransformStep[] | undefined): number {
  if (!steps || steps.length === 0) return raw;
  return steps.reduce(stepForward, raw);
}

/** display value -> raw stored value (exact inverse pipeline, reverse order) */
export function applyTransformsReverse(display: number, steps: TransformStep[] | undefined): number {
  if (!steps || steps.length === 0) return display;
  const reversed = [...steps].reverse();
  return reversed.reduce(stepReverse, display);
}
