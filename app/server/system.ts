import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import {promisify} from 'node:util';
import type {SystemStats} from '../shared/types.ts';

const execFileP = promisify(execFile);
const cpuTimes = () => os.cpus().reduce((a, c) => {
  const t = c.times;
  return {idle: a.idle + t.idle, total: a.total + t.idle + t.user + t.nice + t.sys + t.irq};
}, {idle: 0, total: 0});
let prev = cpuTimes();

/** % busy between two cumulative CPU samples. */
export const cpuPercent = (a: {idle: number; total: number}, b: {idle: number; total: number}): number => {
  const total = b.total - a.total;
  return total > 0 ? Math.round(100 * (1 - (b.idle - a.idle) / total)) : 0;
};

/** MemAvailable counts reclaimable page cache as free; os.freemem() would show Linux as ~always full. */
export const parseMeminfo = (txt: string): {usedMiB: number; totalMiB: number} | null => {
  const kb = (k: string) => Number(new RegExp(`^${k}:\\s+(\\d+)`, 'm').exec(txt)?.[1]);
  const total = kb('MemTotal'), avail = kb('MemAvailable');
  return total && avail >= 0 ? {usedMiB: Math.round((total - avail) / 1024), totalMiB: Math.round(total / 1024)} : null;
};

/** nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,name --format=csv,noheader,nounits (first GPU). */
export const parseNvidia = (out: string): SystemStats['gpu'] => {
  const [util, used, total, ...name] = out.split('\n')[0]?.split(',').map((x) => x.trim()) ?? [];
  return total ? {percent: Number(util), usedMiB: Number(used), totalMiB: Number(total), name: name.join(',')} : null;
};

export async function systemStats(): Promise<SystemStats> {
  const cur = cpuTimes();
  const cpu = cpuPercent(prev, cur);
  prev = cur;
  const mem = parseMeminfo(await readFile('/proc/meminfo', 'utf8').catch(() => ''))
    ?? {usedMiB: Math.round((os.totalmem() - os.freemem()) / 2 ** 20), totalMiB: Math.round(os.totalmem() / 2 ** 20)};
  const gpu = await execFileP('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,memory.total,name', '--format=csv,noheader,nounits'], {timeout: 3000})
    .then((r) => parseNvidia(r.stdout), () => null);
  return {cpu, ram: mem, gpu};
}
