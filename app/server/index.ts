import {serve} from '@hono/node-server';
import {createApp} from './app.ts';
import {EventBus} from './events.ts';
import {JobQueue} from './jobs.ts';
import {openFolder} from './procs.ts';
import {startWatcher} from './watcher.ts';
import {VoiceWorker} from './voiceWorker.ts';

const API_PORT = 5316, UI_PORT = 5317;
const bus = new EventBus();
const jobs = new JobQueue(bus);
const worker = new VoiceWorker(bus);
worker.start();
const stopWatcher = startWatcher(bus);
const server = serve({fetch: createApp({bus, jobs, worker, ports: [API_PORT, UI_PORT]}).fetch, hostname: '127.0.0.1', port: API_PORT});
console.log(`Reel Studio: http://127.0.0.1:${UI_PORT}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { stopWatcher(); worker.stop(); server.close(); process.exit(0); });

if (process.env.NO_OPEN !== '1' && process.env.REEL_DEV !== '1') {
  void (async () => {
    for (let i = 0; i < 60; i++) {
      if (await fetch(`http://127.0.0.1:${UI_PORT}`).then(() => true, () => false)) { openFolder(`http://127.0.0.1:${UI_PORT}`); return; } // xdg-open takes URLs too
      await new Promise(r => setTimeout(r, 500));
    }
  })();
}
