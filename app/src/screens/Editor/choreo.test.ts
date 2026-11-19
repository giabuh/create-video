import {BACK, eraseOut} from '@studio/motion/fx/choreo';
import {describe, expect, it} from 'vitest';

// useChoreo (hook), FxText and Decor are render/hook-only with no exported pure logic, so they are not unit-tested here.
describe('choreo pure helpers', () => {
  it('eraseOut is undefined until the exit starts, then wipes left to right', () => {
    expect(eraseOut(0)).toBeUndefined();
    expect(eraseOut(-1)).toBeUndefined();
    expect(eraseOut(0.5)).toBe('inset(-20% -20% -20% 50%)');
    expect(eraseOut(1)).toBe('inset(-20% -20% -20% 105%)');
  });
  it('BACK eases 0 to 1 and overshoots in between', () => {
    expect(BACK(0)).toBeCloseTo(0);
    expect(BACK(1)).toBeCloseTo(1);
    expect(Math.max(...[0.5, 0.7, 0.8, 0.9].map(BACK))).toBeGreaterThan(1);
  });
});
