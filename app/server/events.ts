import type {Handler} from 'hono';
import {streamSSE} from 'hono/streaming';
import type {ServerEvent} from '../shared/types.ts';

export class EventBus {
  #subs = new Set<(e: ServerEvent) => void>();
  emit(e: ServerEvent): void { for (const fn of [...this.#subs]) { try { fn(e); } catch { /* a bad subscriber must not break others */ } } }
  subscribe(fn: (e: ServerEvent) => void): () => void { this.#subs.add(fn); return () => { this.#subs.delete(fn); }; }
}

export function sseRoute(bus: EventBus, snapshot: () => ServerEvent[]): Handler {
  return c => streamSSE(c, async stream => {
    const queue: ServerEvent[] = [];
    let wake: (() => void) | null = null;
    const unsubscribe = bus.subscribe(e => { queue.push(e); wake?.(); });
    stream.onAbort(unsubscribe);
    try {
      for (const e of snapshot()) await stream.writeSSE({data: JSON.stringify(e)});
      let lastPing = Date.now();
      while (!stream.aborted) {
        const e = queue.shift();
        if (e) { await stream.writeSSE({data: JSON.stringify(e)}); continue; }
        if (Date.now() - lastPing >= 15000) { await stream.write(': ping\n\n'); lastPing = Date.now(); }
        await new Promise<void>(r => { wake = r; setTimeout(r, 1000); });
        wake = null;
      }
    } finally { unsubscribe(); }
  });
}
