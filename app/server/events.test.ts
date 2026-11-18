import {Hono} from 'hono';
import {describe, expect, it} from 'vitest';
import {EventBus, sseRoute} from './events.ts';
import type {ServerEvent} from '../shared/types.ts';

describe('events', () => {
  it('subscribe / unsubscribe', () => {
    const bus = new EventBus(); const got: ServerEvent[] = [];
    const off = bus.subscribe(e => got.push(e));
    bus.emit({type: 'changed', path: 'a'}); off(); bus.emit({type: 'changed', path: 'b'});
    expect(got).toEqual([{type: 'changed', path: 'a'}]);
  });
  it('sseRoute sends snapshot first, then live', async () => {
    const bus = new EventBus();
    const snap: ServerEvent = {type: 'worker', status: {state: 'idle', device: null, error: null}};
    const app = new Hono().get('/events', sseRoute(bus, () => [snap]));
    const res = await app.request('/events');
    const reader = res.body!.getReader(); const dec = new TextDecoder();
    let text = '';
    while (!text.includes('\n\n')) text += dec.decode((await reader.read()).value);
    expect(text).toBe(`data: ${JSON.stringify(snap)}\n\n`);
    bus.emit({type: 'changed', path: 'x'});
    text = '';
    while (!text.includes('\n\n')) text += dec.decode((await reader.read()).value);
    expect(text).toContain('"path":"x"');
    await reader.cancel();
  });
});
