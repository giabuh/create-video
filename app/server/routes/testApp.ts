import {vi} from 'vitest';
import {EventBus} from '../events.ts';
import {JobQueue} from '../jobs.ts';
import {ChatService} from '../chat/service.ts';
import {createApp} from '../app.ts';

export function setup() {
  const bus = new EventBus();
  const jobs = new JobQueue(bus);
  const worker = {request: vi.fn(async () => ({ok: true})), status: () => ({state: 'idle' as const, device: null, error: null}), start() {}, stop() {}};
  const chat = new ChatService(bus);
  const app = createApp({bus, jobs, worker, ports: [5316, 5317], chat});
  const req = (p: string, init: RequestInit & {json?: unknown} = {}) => {
    const {json, ...rest} = init;
    return app.request(`http://127.0.0.1:5317${p}`, {
      ...rest, headers: {Host: '127.0.0.1:5317', ...(json !== undefined && {'content-type': 'application/json'}), ...(rest.headers as object)},
      ...(json !== undefined && {body: JSON.stringify(json)}),
    });
  };
  return {app, req, jobs, worker, bus, chat};
}
export const settle = async (jobs: JobQueue, id: string) => { for (let i = 0; i < 200 && !['done', 'failed', 'cancelled'].includes(jobs.get(id)!.state); i++) await new Promise(r => setTimeout(r, 10)); return jobs.get(id)!; };
