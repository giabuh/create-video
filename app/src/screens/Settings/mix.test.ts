import {describe, expect, it} from 'vitest';
import {rescaleMix} from './mix.ts';

describe('rescaleMix', () => {
  it('keeps the sum at 100 and scales the others proportionally', () => {
    expect(rescaleMix([60, 30, 10], 0, 40)).toEqual([40, 45, 15]);
    expect(rescaleMix([60, 30, 10], 2, 100)).toEqual([0, 0, 100]);
  });
  it('splits evenly when both others are zero', () => {
    expect(rescaleMix([0, 0, 100], 2, 50)).toEqual([25, 25, 50]);
  });
  it('always sums to 100', () => {
    for (let v = 0; v <= 100; v += 7) expect(rescaleMix([33, 33, 34], 1, v).reduce((s, x) => s + x)).toBe(100);
  });
});
