import {withDefaults} from '@studio/components/MotionLayer';
import {MOTION} from '@studio/motion/registry';
import type {MotionItem} from '@studio/types';
import {describe, expect, it} from 'vitest';

const item = (component: string, position: MotionItem['position']) => ({component, position, duration: 2, props: {}}) as unknown as MotionItem;

describe('withDefaults exit', () => {
  it('cards that own their exit get no default fade', () => {
    expect(MOTION.Ribbon.ownsExit).toBe(true);
    expect(withDefaults(item('Ribbon', 'bottom')).exit.type).toBe('none');
  });
  it('other banded cards get a 0.25s fade', () => {
    expect(MOTION.PriceTag.ownsExit).toBeFalsy();
    expect(withDefaults(item('PriceTag', 'bottom')).exit).toEqual({type: 'fade', duration: 0.25});
  });
  it('full-frame layers and explicit exits are untouched', () => {
    expect(withDefaults(item('PriceTag', 'full')).exit.type).toBe('none');
    const exit = {type: 'slide', duration: 1};
    expect(withDefaults({...item('Ribbon', 'bottom'), exit} as unknown as MotionItem).exit).toBe(exit);
  });
});
