import {describe, expect, it} from 'vitest';
import {MOTION_SCHEMAS, validateMotionProps} from './motionSchemas.ts';

describe('validateMotionProps', () => {
  it('accepts valid props and ignores unknown components', () => {
    expect(validateMotionProps('PriceTag', {price: '[GIÁ]'})).toEqual([]);
    expect(validateMotionProps('Whatever', {})).toEqual([]);
  });
  it('flags required fields that are missing or empty', () => {
    expect(validateMotionProps('PriceTag', {})).toHaveLength(1);
    expect(validateMotionProps('Checklist', {items: []})).toHaveLength(1);
    expect(validateMotionProps('CountUp', {to: 5})).toHaveLength(1);
  });
  it('flags wrong types', () => {
    expect(validateMotionProps('CountUp', {from: '0', to: 5})).toHaveLength(1);
    expect(validateMotionProps('KineticText', {lines: 'x'})).toHaveLength(1);
    expect(validateMotionProps('PriceTag', {price: '1', old: 3})).toHaveLength(1);
  });
  it('has the six built-in schemas', () => expect(Object.keys(MOTION_SCHEMAS)).toHaveLength(6));
});
