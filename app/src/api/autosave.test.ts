import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AutosaveController} from './autosave.ts';
import {HttpError} from './client.ts';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const deferred = <T>() => { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const p = new Promise<T>((a, b) => { resolve = a; reject = b; }); return {p, resolve, reject}; };

describe('AutosaveController', () => {
  it('collapses rapid changes into one save', async () => {
    const save = vi.fn(async () => 2);
    const c = new AutosaveController('a', 1, {save});
    c.change('b'); c.change('c'); c.change('d');
    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('d', 1);
    expect(c.getSnapshot().state).toBe('saved');
  });

  it('saves the latest value once after an in-flight save, with the new baseMtime', async () => {
    const d1 = deferred<number>();
    const save = vi.fn().mockReturnValueOnce(d1.p).mockResolvedValue(30);
    const c = new AutosaveController('a', 10, {save});
    c.change('b');
    await vi.advanceTimersByTimeAsync(500);
    c.change('c'); c.change('d');
    await vi.advanceTimersByTimeAsync(500); // debounce fires while in flight: must not start a second save
    expect(save).toHaveBeenCalledTimes(1);
    d1.resolve(20);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('d', 20);
    expect(c.baseMtime).toBe(30);
    expect(c.getSnapshot().dirty).toBe(false);
  });

  it('409 calls onConflict and stops saving that value', async () => {
    const current = {data: 'x', mtime: 9};
    const save = vi.fn().mockRejectedValue(new HttpError(409, {error: 'conflict', details: current}));
    const onConflict = vi.fn();
    const c = new AutosaveController('a', 1, {save, onConflict});
    c.change('b');
    await vi.advanceTimersByTimeAsync(500);
    expect(onConflict).toHaveBeenCalledWith(current);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(c.getSnapshot().dirty).toBe(false);
  });

  it('error sets state and retry saves again', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(2);
    const c = new AutosaveController('a', 1, {save});
    c.change('b');
    await vi.advanceTimersByTimeAsync(500);
    expect(c.getSnapshot()).toMatchObject({state: 'error', error: 'boom', dirty: true});
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    await c.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(c.getSnapshot()).toMatchObject({state: 'saved', error: null, dirty: false});
  });
});
