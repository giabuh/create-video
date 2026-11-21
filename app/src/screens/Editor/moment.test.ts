import {describe, expect, it} from 'vitest';
import type {RenderProps} from '@studio/types';
import {momentTag, sceneAtFrame} from './moment.ts';

const props = {
  fps: 30, totalSeconds: 13,
  scenes: [{id: 'a', start: 0, duration: 4}, {id: 'b', start: 4, duration: 6}],
  cta: {title: 'x', duration: 3},
} as unknown as RenderProps;

describe('sceneAtFrame', () => {
  it('first frame is the first scene', () => expect(sceneAtFrame(props, 0)).toBe('a'));
  it('a scene start belongs to that scene', () => expect(sceneAtFrame(props, 120)).toBe('b'));
  it('last frame before the boundary stays in the previous scene', () => expect(sceneAtFrame(props, 119)).toBe('a'));
  it('after the last scene is the CTA', () => expect(sceneAtFrame(props, 300)).toBe('cta'));
  it('past the end is the CTA', () => expect(sceneAtFrame(props, 9999)).toBe('cta'));
  it('without a CTA, past the end is the last scene', () => expect(sceneAtFrame({...props, cta: null}, 9999)).toBe('b'));
  it('no props or no scenes gives null', () => {
    expect(sceneAtFrame(null, 0)).toBeNull();
    expect(sceneAtFrame({...props, scenes: []}, 0)).toBeNull();
  });
});

describe('momentTag', () => {
  it('frame 0', () => expect(momentTag('mo-dau', 0, 30)).toBe('[cảnh mo-dau · 0:00.0 · khung 0] '));
  it('exact tenth', () => expect(momentTag('kem-1-1', 372, 30)).toBe('[cảnh kem-1-1 · 0:12.4 · khung 372] '));
  it('rounds down past a minute', () => expect(momentTag('b', 1859, 30)).toBe('[cảnh b · 1:01.9 · khung 1859] '));
  it('CTA form', () => expect(momentTag('cta', 780, 30)).toBe('[CTA · 0:26.0 · khung 780] '));
});
