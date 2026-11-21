import {readFileSync} from 'node:fs';
import {MOTION} from '@studio/motion/registry';
import {parseBars} from '@studio/motion/BarChart';
import {parseSeries} from '@studio/motion/LineChart';
import {describe, expect, it} from 'vitest';
import {motionErrors, motionFields, motionNames, motionTitle} from './motionSchema.ts';

describe('motion forms from zod schemas', () => {
  it('lists every registered component with a title', () => {
    expect(motionNames()).toEqual(expect.arrayContaining(['Text', 'KineticText', 'CountUp', 'Checklist', 'PriceTag', 'DateBadge', 'LowerThird', 'Annotate', 'Picture', 'ProgressBar']));
    expect(motionTitle('PriceTag')).toBe('Thẻ giá');
    expect(motionTitle('Whatever')).toBe('Whatever');
  });
  it('registers the new cards and keeps props.py OWNS_EXIT in sync with ownsExit', () => {
    expect(motionNames()).toEqual(expect.arrayContaining(['Ribbon', 'TwoTier', 'Callout', 'PinLabel', 'GlossyPill', 'GiantText']));
    const py = readFileSync(new URL('../../../../tools/reel/props.py', import.meta.url), 'utf8');
    const m = /OWNS_EXIT = \{([^}]*)\}/.exec(py);
    if (!m) throw new Error('tools/reel/props.py: no line matching `OWNS_EXIT = {"A", "B"}` (was it reformatted?)');
    const set = m[1].match(/"(\w+)"/g)!.map((s) => s.slice(1, -1)).sort();
    expect(set).toEqual(Object.entries(MOTION).filter(([, d]) => d.ownsExit).map(([n]) => n).sort());
  });
  it('BarChart and LineChart require a source and parse rows leniently', () => {
    expect(motionNames()).toEqual(expect.arrayContaining(['BarChart', 'LineChart']));
    expect(motionErrors('BarChart', {bars: ['A | 1'], source: 'GSO'})).toEqual({});
    expect(Object.keys(motionErrors('BarChart', {bars: ['A | 1']}))).toEqual(['source']);
    expect(motionErrors('LineChart', {labels: ['2023', '2024'], series: ['A | 1, 2'], source: 'GSO'})).toEqual({});
    expect(Object.keys(motionErrors('LineChart', {labels: ['x'], series: ['A | 1']}))).toEqual(['source']);
    expect(parseBars(['A | 12,5 | a.png', 'bad', ' | 3', 'B | x', 'C | 4'])).toEqual([{label: 'A', value: 12.5, img: 'a.png'}, {label: 'C', value: 4}]);
    expect(parseSeries(['A | 1, 2.5 3', 'B | x', '| 1'])).toEqual([{name: 'A', values: [1, 2.5, 3]}]);
  });
  it('derives widgets, bounds, defaults and labels', () => {
    const f = Object.fromEntries((motionFields('Text') ?? []).map((x) => [x.key, x]));
    expect(f.text).toMatchObject({kind: 'textarea', required: true, title: 'Chữ'});
    expect(f.size).toMatchObject({kind: 'number', required: false, min: 20, max: 300, step: 2, default: 80});
    expect(f.color).toMatchObject({kind: 'color', required: false});
    expect(f.reveal.options).toContainEqual({value: 'typewriter', label: 'Gõ phím'});
    expect(f.reveal.options).toHaveLength(9);
    expect(f.uppercase).toMatchObject({kind: 'bool'});
    expect(Object.fromEntries((motionFields('KineticText') ?? []).map((x) => [x.key, x.kind])).lines).toBe('lines');
    expect(Object.fromEntries((motionFields('Picture') ?? []).map((x) => [x.key, x.kind])).src).toBe('media');
    expect(motionFields('Nope')).toBeNull();
  });
  it.each(['KineticText', 'LowerThird', 'PriceTag', 'DateBadge', 'Checklist'])('%s has an fx choice defaulting to none', (name) => {
    expect(Object.fromEntries((motionFields(name) ?? []).map((x) => [x.key, x])).fx).toMatchObject({kind: 'choice', default: 'none'});
  });
  it('validates with the same schema the renderer uses', () => {
    expect(motionErrors('PriceTag', {price: '999K'})).toEqual({});
    expect(Object.keys(motionErrors('PriceTag', {}))).toEqual(['price']);
    expect(Object.keys(motionErrors('CountUp', {from: '0', to: 5}))).toEqual(['from']);
    expect(motionErrors('Whatever', {})).toEqual({});
  });
});
