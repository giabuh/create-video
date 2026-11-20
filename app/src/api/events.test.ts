import {describe, expect, it} from 'vitest';
import type {Job} from '../../shared/types.ts';
import {mergeJobs} from './events.ts';

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
