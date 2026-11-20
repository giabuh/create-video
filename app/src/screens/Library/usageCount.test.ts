import {describe, expect, it} from 'vitest';
import {byUsage, projectCounts, usageLabel} from './usageCount.ts';

describe('usageCount', () => {
  it('counts distinct projects, not scenes', () => {
    expect(projectCounts({'a.mp4': ['p1 · s1', 'p1 · s2', 'p2 · s1'], 'b.jpg': ['p1 · s3']})).toEqual({'a.mp4': 2, 'b.jpg': 1});
  });
  it('sorts least-used first, unused first of all', () => {
    const rows: [string, null][] = [['a', null], ['b', null], ['c', null]];
    expect(rows.sort(byUsage({a: 2, b: 1})).map(([n]) => n)).toEqual(['c', 'b', 'a']);
  });
  it('labels', () => {
    expect(usageLabel(0)).toBe('Mới');
    expect(usageLabel(3)).toBe('Dùng 3');
  });
});
