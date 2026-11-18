import {execFile, spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import readline from 'node:readline';
import {promisify} from 'node:util';
import type {JobCtx} from './jobs.ts';
import {readJson} from './store.ts';
import {repoRoot, safeJoin, SLUG_RE} from './paths.ts';
import {withSlugLock} from './slugLock.ts';
import type {Json, PreviewResult, RenderProps} from '../shared/types.ts';

const execFileP = promisify(execFile);

export function parseLastJsonLine(stdout: string): Json {
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const v: unknown = JSON.parse(lines[i]);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Json;
    } catch { /* not JSON, keep looking */ }
  }
  throw new Error('no JSON object line in process output');
}

type Out = {code: number | null; stdout: string; stderr: string};
function collect(command: string, args: string[]): Promise<Out> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {cwd: repoRoot(), stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    p.stdout.on('data', d => { stdout += d; });
    p.stderr.on('data', d => { stderr += d; });
    p.on('error', reject);
    p.on('close', code => resolve({code, stdout, stderr}));
  });
}

async function preview(slug: string): Promise<PreviewResult> {
  const fail = (msg: string): PreviewResult => ({ok: false, errors: [msg], stale: [], renderProps: null});
  let out: Out;
  try { out = await collect('python3', ['tools/prepare.py', `projects/${slug}`, '--preview', '--json']); } catch (e) { return fail((e as Error).message); }
  let res: Json;
  try { res = parseLastJsonLine(out.stdout); } catch {
    return fail(out.stderr.trim().split('\n').filter(Boolean).pop() ?? `prepare exited with code ${out.code}`);
  }
  const ok = res.ok === true;
  const errors = Array.isArray(res.errors) ? res.errors.map(String) : [];
  const stale = Array.isArray(res.stale) ? res.stale.map(String) : [];
  let renderProps: RenderProps | null = null;
  if (ok) {
    try { renderProps = (await readJson<RenderProps>(safeJoin('projects', slug, 'render-props.json'))).data; } catch (e) { return fail((e as Error).message); }
  }
  return {ok, errors, stale, renderProps};
}

const waiting = new Map<string, Promise<PreviewResult>>();
export function runPreview(slug: string): Promise<PreviewResult> {
  if (!SLUG_RE.test(slug)) return Promise.resolve({ok: false, errors: ['bad project'], stale: [], renderProps: null});
  const w = waiting.get(slug);
  if (w) return w;
  const p = withSlugLock(slug, () => { waiting.delete(slug); return preview(slug); });
  waiting.set(slug, p);
  return p;
}

export async function runIngest(ctx: JobCtx): Promise<Json> {
  const total = (await readdir(safeJoin('inbox'), {withFileTypes: true}).catch(() => [])).filter(d => d.isFile()).length;
  const added: string[] = [], failed: string[] = [];
  const done = () => ctx.progress(total ? Math.min(1, (added.length + failed.length) / total) : null, `${added.length + failed.length}/${total}`);
  await new Promise<void>((resolve, reject) => {
    const p = spawn('python3', ['tools/ingest.py'], {cwd: repoRoot(), stdio: ['ignore', 'pipe', 'pipe']});
    p.on('error', reject);
    ctx.signal.addEventListener('abort', () => p.kill(), {once: true});
    let tail = '';
    p.stderr.on('data', d => { tail = (tail + d).slice(-2000); });
    readline.createInterface({input: p.stdout}).on('line', line => {
      ctx.log(line);
      const ok = /^ok: .+ -> library\/(.+)$/.exec(line);
      const bad = /^FAILED (.+?): /.exec(line);
      if (ok) added.push(ok[1]); else if (bad) failed.push(bad[1]); else return;
      done();
    });
    p.on('close', code => code === 0 || ctx.signal.aborted ? resolve() : reject(new Error(`ingest exited with code ${code}: ${tail.trim().split('\n').pop() ?? ''}`)));
  });
  return {added, failed};
}

export async function convertVoiceRef(src: string, dest: string): Promise<number> {
  await execFileP('ffmpeg', ['-y', '-i', src, '-ac', '1', '-ar', '48000', '-t', '10', dest]);
  const {stdout} = await execFileP('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest]);
  return Number(stdout.trim());
}

export function openFolder(absDir: string): void {
  const p = spawn('xdg-open', [absDir], {detached: true, stdio: 'ignore'});
  p.on('error', () => {});
  p.unref();
}
