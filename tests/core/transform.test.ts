import { describe, expect, it } from 'vitest';
import { applyTransformsForward, applyTransformsReverse } from '../../src/core/transform/transformation-engine';
import type { TransformStep } from '../../src/core/transform/transformation-engine';

describe('transformation engine', () => {
  it('returns the input unchanged with no steps', () => {
    expect(applyTransformsForward(42, undefined)).toBe(42);
    expect(applyTransformsReverse(42, [])).toBe(42);
  });

  it('scale: raw stored as percent*100, displayed as a decimal', () => {
    const steps: TransformStep[] = [{ type: 'scale', divisor: 100 }];
    expect(applyTransformsForward(4250, steps)).toBeCloseTo(42.5);
    expect(applyTransformsReverse(42.5, steps)).toBe(4250);
  });

  it('multiply/divide is a self-consistent forward/reverse pair', () => {
    const steps: TransformStep[] = [{ type: 'divide', factor: 10 }];
    expect(applyTransformsForward(100, steps)).toBe(10);
    expect(applyTransformsReverse(10, steps)).toBe(100);
  });

  it('add/subtract round-trips', () => {
    const steps: TransformStep[] = [{ type: 'add', value: 1000 }];
    expect(applyTransformsForward(0, steps)).toBe(1000);
    expect(applyTransformsReverse(1000, steps)).toBe(0);
  });

  it('fixedPoint: raw integer / 2^fractionalBits', () => {
    const steps: TransformStep[] = [{ type: 'fixedPoint', fractionalBits: 8 }];
    expect(applyTransformsForward(256, steps)).toBe(1);
    expect(applyTransformsReverse(1, steps)).toBe(256);
  });

  it('xor is self-inverse', () => {
    const steps: TransformStep[] = [{ type: 'xor', mask: 0xff }];
    expect(applyTransformsForward(0x0f, steps)).toBe(0xf0);
    expect(applyTransformsReverse(0xf0, steps)).toBe(0x0f);
  });

  it('toSigned/toUnsigned round-trips an 8-bit twos-complement value', () => {
    const forwardSteps: TransformStep[] = [{ type: 'toSigned', bits: 8 }];
    expect(applyTransformsForward(255, forwardSteps)).toBe(-1);
    expect(applyTransformsForward(128, forwardSteps)).toBe(-128);
    expect(applyTransformsForward(127, forwardSteps)).toBe(127);
    expect(applyTransformsReverse(-1, forwardSteps)).toBe(255);
  });

  it('chains multiple steps in order, and reverses in reverse order', () => {
    const steps: TransformStep[] = [
      { type: 'add', value: 10 },
      { type: 'multiply', factor: 2 },
    ];
    // forward: (5 + 10) * 2 = 30
    expect(applyTransformsForward(5, steps)).toBe(30);
    // reverse: (30 / 2) - 10 = 5
    expect(applyTransformsReverse(30, steps)).toBe(5);
  });

  it('shiftLeft/shiftRight approximate inverses for values with no dropped bits', () => {
    const steps: TransformStep[] = [{ type: 'shiftLeft', bits: 4 }];
    expect(applyTransformsForward(0x0f, steps)).toBe(0xf0);
    expect(applyTransformsReverse(0xf0, steps)).toBe(0x0f);
  });
});
