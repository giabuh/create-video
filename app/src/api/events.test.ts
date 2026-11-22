import {describe, expect, it} from 'vitest';
import type {Job} from '../../shared/types.ts';
import {isLive, keysForPath, mergeJobs} from './events.ts';

const job = (id: string, state: Job['state']): Job => ({id, kind: 'render', lane: 'render', project: null, label: id, ref: null, state, progress: null, step: '', startedAt: 1, endedAt: null, etaSeconds: null, log: [], result: null, error: null, cancellable: true});

describe('mergeJobs', () => {
  it('server state wins and reports jobs that finished while offline', () => {
    const {next, finished} = mergeJobs(new Map([['a', job('a', 'running')], ['b', job('b', 'done')], ['c', job('c', 'running')]]), [job('a', 'done'), job('d', 'running')]);
    expect(next.get('a')?.state).toBe('done');
    expect(finished.map((f) => f.job.id)).toEqual(['a']);
    expect(next.has('b')).toBe(true); // finished local job kept
    expect(next.has('c')).toBe(false); // live local job the server no longer knows: dropped
    expect(next.get('d')?.state).toBe('running');
  });
});

describe('keysForPath', () => {
  it('skips render chunks, temp files and TTS audio, keeps real project files', () => {
    for (const f of ['reel-v3.tmp.mp4', 'reel-v3.tmp.mp4.part', 'a.aac', 'b.ts', 'audio/x.wav', 'audio/x.words.json']) expect(keysForPath(`projects/p/${f}`)).toEqual([]);
    for (const f of ['storyboard.json', 'reel-v3.mp4', 'timings.json']) expect(keysForPath(`projects/p/${f}`)).toHaveLength(2);
    expect(keysForPath('projects')).toHaveLength(1);
  });
});

describe('isLive', () => {
  it('is queued or running only', () => {
    expect((['queued', 'running', 'done', 'failed', 'cancelled'] as const).map((s) => isLive(job('a', s)))).toEqual([true, true, false, false, false]);
  });
});
