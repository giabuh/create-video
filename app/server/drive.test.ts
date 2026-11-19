import {beforeEach, describe, expect, it} from 'vitest';
import {DriveError, driveDelete, driveList, driveName, driveUpload, freeName, setRunner, withRetry, type Runner} from './drive.ts';
import {makeTestRoot} from './testRoot.ts';

const calls: string[][] = [];
function fake(res: {code: number; out?: string; err?: string}, lines: string[] = []): void {
  const r: Runner = async (args, onLine) => { calls.push(args); lines.forEach((l) => onLine?.(l)); return {code: res.code, out: res.out ?? '', err: res.err ?? ''}; };
  setRunner(r);
}

beforeEach(async () => { calls.length = 0; await makeTestRoot(); });

describe('names', () => {
  it('driveName', () => {
    expect(driveName('IELTS 7.5 Hè')).toBe('ielts-7-5-he.mp4');
    expect(driveName('a.MP4')).toBe('a.mp4');
    expect(() => driveName('!!!')).toThrow('bad name');
  });
  it('freeName', () => {
    expect(freeName('a.mp4', [])).toBe('a.mp4');
    expect(freeName('a.mp4', ['a.mp4', 'a-2.mp4'])).toBe('a-3.mp4');
  });
});

describe('rclone calls', () => {
  it('driveList', async () => {
    fake({code: 3});
    expect(await driveList()).toEqual([]);
    fake({code: 0, out: 'a.mp4\nb.mp4\n'});
    expect(await driveList()).toEqual(['a.mp4', 'b.mp4']);
    expect(calls[1].slice(0, 1)).toEqual(['lsf']);
  });
  it('driveUpload reports progress', async () => {
    fake({code: 0}, ['{"stats":{"bytes":5,"totalBytes":10}}', 'garbage']);
    const seen: (number | null)[] = [];
    await driveUpload('/tmp/l.mp4', 'x.mp4', (p) => seen.push(p));
    expect(seen).toEqual([0.5]);
    expect(calls[0][0]).toBe('copyto');
    expect(calls[0][1]).toBe('/tmp/l.mp4');
    expect(calls[0][2]).toMatch(/\/xuat-ban\/x\.mp4$/);
  });
  it('non-zero exit throws DriveError with last stderr line', async () => {
    fake({code: 1, err: 'x\nboom\n'});
    await expect(driveDelete('x.mp4')).rejects.toThrow(DriveError);
    await expect(driveDelete('x.mp4')).rejects.toThrow('boom');
    fake({code: 1, err: "Failed: didn't find section in config file"});
    await expect(driveList()).rejects.toThrow('rclone config');
  });
});

describe('withRetry', () => {
  it('retries then rethrows', async () => {
    let n = 0; const slept: number[] = [];
    await expect(withRetry(async () => { n++; throw new Error('no'); }, [10, 30, 90], async (ms) => { slept.push(ms); })).rejects.toThrow('no');
    expect(n).toBe(4);
    expect(slept).toEqual([10, 30, 90]);
  });
  it('stops on success', async () => {
    let n = 0;
    expect(await withRetry(async () => { if (++n < 2) throw new Error('x'); return 'ok'; }, [1, 1, 1], async () => {})).toBe('ok');
    expect(n).toBe(2);
  });
});
