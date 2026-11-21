import {describe, expect, it} from 'vitest';
import {cpuPercent, parseMeminfo, parseNvidia} from './system.ts';

describe('system stats', () => {
  it('cpu % from two samples', () => {
    expect(cpuPercent({idle: 100, total: 200}, {idle: 130, total: 300})).toBe(70);
    expect(cpuPercent({idle: 1, total: 1}, {idle: 1, total: 1})).toBe(0);
  });
  it('ram used = total - available', () => {
    expect(parseMeminfo('MemTotal:       16384000 kB\nMemFree:  100 kB\nMemAvailable:    8192000 kB\n')).toEqual({usedMiB: 8000, totalMiB: 16000});
    expect(parseMeminfo('')).toBeNull();
  });
  it('first nvidia-smi line', () => {
    expect(parseNvidia('16, 3356, 4096, NVIDIA GeForce GTX 1650\n')).toEqual({percent: 16, usedMiB: 3356, totalMiB: 4096, name: 'NVIDIA GeForce GTX 1650'});
    expect(parseNvidia('')).toBeNull();
  });
});
