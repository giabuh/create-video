import {mkdirSync, readdirSync, statSync, watch, type FSWatcher} from 'node:fs';
import path from 'node:path';
import type {EventBus} from './events.ts';
import {rel, repoRoot} from './paths.ts';

const IGNORE_SUFFIX = ['.tmp', '.part', '.raw.wav', '.tmp.wav', '.tmp.mp4'];
const WATCH_DIRS = ['projects', 'library', 'music', 'sfx', 'brands', 'voices', 'studio/src'];

function ignored(relPath: string): boolean {
  if (IGNORE_SUFFIX.some(s => relPath.endsWith(s))) return true;
  return /^projects\/[^/]+\/preview(\/|$)/.test(relPath) || /^voices\/_uploads(\/|$)/.test(relPath);
}

export function startWatcher(bus: EventBus): () => void {
  const root = repoRoot();
  const watchers = new Map<string, FSWatcher>();
  const timers = new Map<string, NodeJS.Timeout>();
  const fire = (abs: string) => {
    const p = rel(abs);
    if (ignored(p)) return;
    clearTimeout(timers.get(p));
    timers.set(p, setTimeout(() => { timers.delete(p); bus.emit({type: 'changed', path: p}); }, 120));
  };
  // One non-recursive watcher per directory: Node's recursive watch on Linux tracks file inodes and goes deaf to a file
  // after it is replaced by rename (writeJsonAtomic), so project.json edits were missed until a page reload.
  const watchDir = (dir: string, isNew: boolean) => {
    if (watchers.has(dir) || ignored(rel(dir))) return;
    let w: FSWatcher;
    try {
      w = watch(dir, (_ev, name) => {
        if (!name) return;
        const abs = path.join(dir, name.toString());
        fire(abs);
        const st = statSync(abs, {throwIfNoEntry: false});
        if (st?.isDirectory()) watchDir(abs, true);
        else if (!st) for (const d of [...watchers.keys()]) if (d === abs || d.startsWith(abs + path.sep)) { watchers.get(d)?.close(); watchers.delete(d); }
      });
    } catch { return; } // removed before we got to it
    // a removed dir or inotify limit must not crash the server
    w.on('error', err => { console.error('watcher error:', err.message); w.close(); watchers.delete(dir); });
    watchers.set(dir, w);
    for (const e of readdirSync(dir, {withFileTypes: true})) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) watchDir(abs, isNew);
      else if (isNew) fire(abs); // files written before this new dir's watcher existed
    }
  };
  for (const d of WATCH_DIRS) {
    const dir = path.join(root, d);
    mkdirSync(dir, {recursive: true});
    watchDir(dir, false);
  }
  const rootW = watch(root, (_ev, name) => { if (name?.toString() === 'config.json') fire(path.join(root, 'config.json')); });
  rootW.on('error', err => { console.error('watcher error:', err.message); rootW.close(); });
  return () => { watchers.forEach(w => w.close()); watchers.clear(); rootW.close(); timers.forEach(clearTimeout); timers.clear(); };
}
