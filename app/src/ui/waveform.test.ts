import {describe, expect, it} from 'vitest';
import {peaksFromSamples} from './waveform.ts';

describe('peaksFromSamples', () => {
  it('takes max |x| per bucket, normalized', () => {
    expect(peaksFromSamples(new Float32Array([0, 0.5, -1, 0.25]), 2)).toEqual([0.5, 1]);
  });
  it('returns zeros for empty input', () => {
    expect(peaksFromSamples(new Float32Array(0), 3)).toEqual([0, 0, 0]);
  });
  it('returns zeros (no NaN) for silence', () => {
    expect(peaksFromSamples(new Float32Array(8), 4)).toEqual([0, 0, 0, 0]);
  });
});
