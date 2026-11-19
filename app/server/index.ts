import {serve} from '@hono/node-server';
import {createApp} from './app.ts';
import {EventBus} from './events.ts';
import {JobQueue} from './jobs.ts';
import {openFolder} from './procs.ts';
import {startWatcher} from './watcher.ts';
import {VoiceWorker} from './voiceWorker.ts';

const API_PORT = Number(process.env.REEL_API_PORT ?? 5316);
const UI_PORT = Number(process.env.REEL_UI_PORT ?? 5317);
// extra UI ports allowed by the host guard, e.g. a second Vite for side-by-side comparison
const EXTRA_PORTS = (process.env.REEL_EXTRA_PORTS ?? '').split(',').filter(Boolean).map(Number);
const bus = new EventBus();
const jobs = new JobQueue(bus);
const worker = new VoiceWorker(bus);
worker.start();
const stopWatcher = startWatcher(bus);
const server = serve({fetch: createApp({bus, jobs, worker, ports: [API_PORT, UI_PORT, ...EXTRA_PORTS]}).fetch, hostname: '127.0.0.1', port: API_PORT});
console.log(`Reel Studio: http://127.0.0.1:${UI_PORT}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { stopWatcher(); worker.stop(); server.close(); process.exit(0); });

if (process.env.NO_OPEN !== '1' && process.env.REEL_DEV !== '1') {
  void (async () => {
    for (let i = 0; i < 60; i++) {
      if (await fetch(`http://127.0.0.1:${UI_PORT}`, {signal: AbortSignal.timeout(2000)}).then(() => true, () => false)) { openFolder(`http://127.0.0.1:${UI_PORT}`); return; } // xdg-open takes URLs too
      await new Promise(r => setTimeout(r, 500));
    }
  })();
}
