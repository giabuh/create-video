import {describe, expect, it} from 'vitest';
import type {RenderProps, SceneSpec, Storyboard} from '../../../shared/types.ts';
import {addScene, duplicateScene, errorsByScene, mixOf, newSceneId, removeScene, sceneKind, sceneStart, shouldAdopt, updateScene} from './editorState.ts';

const sb: Storyboard = {scenes: [
  {id: 's1', say: 'a', caption: 'A', media: [{src: 'x.mp4'}], highlight: ['A']},
  {id: 's3m', motion: [{component: 'Checklist'}]},
  {id: 's2', say: 'b'},
]};

describe('editorState', () => {
  it('newSceneId uses max numeric suffix + 1', () => {
    expect(newSceneId([])).toBe('s1');
    expect(newSceneId(sb.scenes)).toBe('s4');
  });
  it('addScene inserts after the index, or at the end for null', () => {
    const a = addScene(sb, 0);
    expect(a.sb.scenes.map((s) => s.id)).toEqual(['s1', 's4', 's3m', 's2']);
    expect(a.sb.scenes[1]).toEqual({id: 's4', say: '', caption: ''});
    expect(addScene(sb, null).sb.scenes.at(-1)?.id).toBe('s4');
    expect(addScene({scenes: []}, null).id).toBe('s1');
  });
  it('duplicateScene copies every field deeply with a new id, inserted after', () => {
    const d = duplicateScene(sb, 's1');
    expect(d.id).toBe('s4');
    expect(d.sb.scenes[1]).toEqual({...sb.scenes[0], id: 's4'});
    expect(d.sb.scenes[1].media).not.toBe(sb.scenes[0].media);
    expect(sb.scenes).toHaveLength(3);
  });
  it('removeScene drops the scene', () => {
    expect(removeScene(sb, 's3m').scenes.map((s) => s.id)).toEqual(['s1', 's2']);
  });
  it('updateScene patches and deletes keys whose value is undefined', () => {
    const u = updateScene(sb, 's1', {caption: undefined, say: 'z'});
    expect('caption' in u.scenes[0]).toBe(false);
    expect(u.scenes[0].say).toBe('z');
    expect(u.scenes[1]).toBe(sb.scenes[1]);
  });
  it('sceneKind', () => {
    expect(sceneKind(sb.scenes[0])).toBe('real');
    expect(sceneKind(sb.scenes[1])).toBe('motion');
    expect(sceneKind(sb.scenes[2])).toBe('other');
    expect(sceneKind({id: 'x', media: [{src: 'a'}], motion: [{component: 'K'}]} as SceneSpec)).toBe('real');
  });
  const props = {scenes: [{id: 's1', start: 0, duration: 4, media: [1]}, {id: 's2', start: 4, duration: 2, media: []}], cta: {duration: 2}} as unknown as RenderProps;
  it('sceneStart / mixOf', () => {
    expect(sceneStart(props, 's2')).toBe(4);
    expect(sceneStart(props, 'cta')).toBe(6);
    expect(sceneStart(props, 'nope')).toBeNull();
    expect(sceneStart(null, 's1')).toBeNull();
    expect(mixOf(props)).toEqual({real: 0.5, motion: 0.25, other: 0.25});
  });
  it('an older server copy is ignored', () => {
    const ok = {baseMtime: 200, dirty: false, saving: false};
    expect(shouldAdopt({...ok, serverMtime: 100})).toBe(false);
    expect(shouldAdopt({...ok, serverMtime: 200})).toBe(false);
    expect(shouldAdopt({...ok, serverMtime: 300})).toBe(true);
    expect(shouldAdopt({...ok, serverMtime: 300, dirty: true})).toBe(false);
    expect(shouldAdopt({...ok, serverMtime: 300, saving: true})).toBe(false);
  });
  it('errorsByScene keeps only known scene ids', () => {
    const m = errorsByScene(['s2: thiếu media', 'zz: x', 'general error'], ['s1', 's2']);
    expect([...m.keys()]).toEqual(['s2']);
  });
});
