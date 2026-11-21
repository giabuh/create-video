import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTestRoot} from '../testRoot.ts';
import {setup, settle} from './testApp.ts';

vi.mock('../procs.ts', async orig => ({...(await orig<typeof import('../procs.ts')>()), convertVoiceRef: vi.fn(async (_s: string, dest: string) => { await writeFile(dest, 'wav'); return 3; })}));

describe('voice routes', () => {
  it('lists voices, try job, validation', async () => {
    const root = await makeTestRoot();
    for (const f of ['phuong-short.wav', 'phuong-full.wav', 'vy-short.wav']) await writeFile(path.join(root, 'voices', f), 'x');
    const {req, jobs, worker} = setup();
    const list = await (await req('/api/voices')).json();
    expect(list.map((v: {name: string}) => v.name)).toEqual(expect.arrayContaining(['phuong', 'vy'])); // config.json may list more voices
    expect(list[0]).toMatchObject({isDefault: true, refs: ['voices/phuong-full.wav', 'voices/phuong-short.wav']});
    expect(list[1].isDefault).toBe(false);
    expect(await (await req('/api/voices/tries')).json()).toBeNull();
    expect((await req('/api/voices/try', {method: 'POST', json: {voice: 'zzz', text: 'a', variants: []}})).status).toBe(400);
    const t = await req('/api/voices/try', {method: 'POST', json: {voice: 'vy', text: 'chào', variants: [{speed: 1.1}]}});
    expect(t.status).toBe(202);
    expect((await settle(jobs, (await t.json()).id)).state).toBe('done');
    expect(worker.request).toHaveBeenCalledWith('try', {voice: 'vy', text: 'chào', variants: [{speed: 1.1}]}, expect.any(Function));
  });
  it('upload-voice', async () => {
    const root = await makeTestRoot();
    const {req, jobs} = setup();
    expect((await req('/api/upload-voice/thu/x.exe', {method: 'PUT', body: 'x'})).status).toBe(400);
    expect((await req('/api/upload-voice/!!!/mau.wav', {method: 'PUT', body: 'x'})).status).toBe(400);
    expect((await req('/api/upload-voice/phuong/x.wav', {method: 'PUT', body: 'x'})).status).toBe(400);
    expect((await req('/api/upload-voice/thu/Thu%2Fmau.wav', {method: 'PUT', body: 'x'})).status).toBe(400); // slash in filename
    const ok = await req('/api/upload-voice/Thu/mau.wav', {method: 'PUT', body: 'audio'});
    expect(ok.status).toBe(202);
    expect((await req('/api/upload-voice/thu/mau.wav', {method: 'PUT', body: 'again'})).status).toBe(400); // pending job
    const job = await ok.json();
    expect(job.kind).toBe('voice-add');
    expect((await settle(jobs, job.id)).state).toBe('done');
    expect(JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8')).voices.thu.ref).toBe('voices/thu-short.wav');
    await expect(stat(path.join(root, 'voices/_uploads/thu.wav'))).rejects.toThrow();
  });
});
