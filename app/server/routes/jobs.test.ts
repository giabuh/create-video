import {describe, expect, it} from 'vitest';
import {makeTestRoot} from '../testRoot.ts';
import {setup, settle} from './testApp.ts';

describe('jobs routes', () => {
  it('lists, cancel 404/409, open validation', async () => {
    await makeTestRoot();
    const {req, jobs} = setup();
    const j = await (await req('/api/projects/p1/voice', {method: 'POST'})).json();
    await settle(jobs, j.id);
    expect((await (await req('/api/jobs')).json())[0].id).toBe(j.id);
    expect((await req(`/api/jobs/${j.id}/cancel`, {method: 'POST'})).status).toBe(409);
    expect((await req('/api/jobs/nope/cancel', {method: 'POST'})).status).toBe(404);
    expect((await req('/api/open', {method: 'POST', json: {path: 'inbox'}})).status).toBe(400);
    expect((await req('/api/open', {method: 'POST', json: {path: 'projects/../..'}})).status).toBe(400);
    expect((await req('/api/open', {method: 'POST', json: {path: 'projects/nope'}})).status).toBe(400);
  });
  it('health', async () => {
    await makeTestRoot();
    expect(await (await setup().req('/api/health')).json()).toEqual({ok: true, worker: {state: 'idle', device: null, error: null}});
  });
});
