import {describe, expect, it} from 'vitest';
import {motionErrors, motionFields, motionNames, motionTitle} from './motionSchema.ts';

describe('motion forms from zod schemas', () => {
  it('lists every registered component with a title', () => {
    expect(motionNames()).toEqual(expect.arrayContaining(['Text', 'KineticText', 'CountUp', 'Checklist', 'PriceTag', 'DateBadge', 'LowerThird', 'Annotate', 'Picture', 'ProgressBar']));
    expect(motionTitle('PriceTag')).toBe('Thẻ giá');
    expect(motionTitle('Whatever')).toBe('Whatever');
  });
  it('derives widgets, bounds, defaults and labels', () => {
    const f = Object.fromEntries((motionFields('Text') ?? []).map((x) => [x.key, x]));
    expect(f.text).toMatchObject({kind: 'textarea', required: true, title: 'Chữ'});
    expect(f.size).toMatchObject({kind: 'number', required: false, min: 20, max: 300, step: 2, default: 80});
    expect(f.color).toMatchObject({kind: 'color', required: false});
    expect(f.reveal.options).toContainEqual({value: 'typewriter', label: 'Gõ từng ký tự'});
    expect(f.uppercase).toMatchObject({kind: 'bool'});
    expect(Object.fromEntries((motionFields('KineticText') ?? []).map((x) => [x.key, x.kind])).lines).toBe('lines');
    expect(Object.fromEntries((motionFields('Picture') ?? []).map((x) => [x.key, x.kind])).src).toBe('media');
    expect(motionFields('Nope')).toBeNull();
  });
  it('validates with the same schema the renderer uses', () => {
    expect(motionErrors('PriceTag', {price: '999K'})).toEqual({});
    expect(Object.keys(motionErrors('PriceTag', {}))).toEqual(['price']);
    expect(Object.keys(motionErrors('CountUp', {from: '0', to: 5}))).toEqual(['from']);
    expect(motionErrors('Whatever', {})).toEqual({});
  });
});
