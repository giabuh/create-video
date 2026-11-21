import {describe, expect, it} from 'vitest';
import {TEXT_FX, fxDuration, fxUnit, scrambleSlots, splitUnits, unitStyle} from '@studio/motion/fx/textFx';

const TEXT = 'Khóa học Quảng cáo Facebook';

describe('text effects', () => {
  it('splits lines, words and Vietnamese graphemes without breaking words', () => {
    expect(splitUnits('Khóa học\nỨng dụng')).toEqual([[['K', 'h', 'ó', 'a'], ['h', 'ọ', 'c']], [['Ứ', 'n', 'g'], ['d', 'ụ', 'n', 'g']]]);
    expect(splitUnits('a   b')).toEqual([[['a'], ['b']]]);
  });
  it('shows every unit fully at fxDuration', () => {
    for (const fx of TEXT_FX) {
      const words = splitUnits(TEXT).flat();
      const n = fxUnit(fx) === 'word' ? words.length : words.reduce((a, w) => a + w.length, 0);
      const end = fxDuration(fx, TEXT, 1);
      for (let i = 0; i < n; i++) {
        const s = unitStyle(fx, i, n, end + 1e-6, 1, 7);
        expect(s.opacity, `${fx} unit ${i}`).toBeCloseTo(1, 5);
        if (fx !== 'wave') expect(s.transform, `${fx} unit ${i}`).toBe('none');
        expect(s.filter ?? 'none').toBe('none');
      }
    }
  });
  it('hides units before they start (except none, which only fades)', () => {
    for (const fx of TEXT_FX.filter((f) => f !== 'none' && f !== 'mask')) expect(unitStyle(fx, 3, 10, -0.01, 1, 1).opacity).toBe(0);
    expect(unitStyle('mask', 0, 4, 0, 1, 1).transform).toBe('translateY(110%)');
  });
  it('scales durations linearly with pace', () => {
    for (const fx of TEXT_FX) expect(fxDuration(fx, TEXT, 1.4)).toBeCloseTo(fxDuration(fx, TEXT, 1) * 1.4, 6);
  });
  it('scramble is a deterministic permutation per seed', () => {
    const a = scrambleSlots(12, 3);
    expect(scrambleSlots(12, 3)).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual([...Array(12).keys()]);
    expect(scrambleSlots(12, 4)).not.toEqual(a);
  });
  it('blur-in starts heavily blurred and settles', () => {
    const a = unitStyle('blur-in', 0, 4, 0, 1, 1);
    expect(a.opacity).toBe(0);
    expect(parseFloat(a.filter!.match(/blur\(([\d.]+)px/)![1])).toBeGreaterThanOrEqual(12);
    for (let i = 0; i < 4; i++) expect(unitStyle('blur-in', i, 4, 2, 1, 1)).toEqual({opacity: 1, transform: 'none', filter: 'none'});
    expect(unitStyle('blur-in', 1, 4, 0.3, 1, 1)).toEqual(unitStyle('blur-in', 1, 4, 0.3, 1, 1));
  });
  it('glitch splits colours while revealing and settles', () => {
    const a = unitStyle('glitch', 0, 5, 0.1, 1, 1);
    expect(a.textShadow).toContain('#ff2a6d');
    expect(a.textShadow).toContain('#05d9e8');
    expect(a).toEqual(unitStyle('glitch', 0, 5, 0.1, 1, 1));
    for (let i = 0; i < 5; i++) {
      const s = unitStyle('glitch', i, 5, 2, 1, 1);
      expect(s).toMatchObject({opacity: 1, transform: 'none'});
      expect(s.textShadow).toBeUndefined();
    }
  });
});
