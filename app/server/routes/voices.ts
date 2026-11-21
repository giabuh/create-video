import {readdir, rm, stat} from 'node:fs/promises';
import {Hono} from 'hono';
import path from 'node:path';
import {AUDIO_REF_EXTS, repoRoot, safeJoin, sanitizeFilename, slugify} from '../paths.ts';
import {convertVoiceRef} from '../procs.ts';
import {readJson, readJsonOr, writeJsonAtomic} from '../store.ts';
import type {Config, Tries, VoiceInfo} from '../../shared/types.ts';
import {bodyOf, HttpError, isObj, readConfigV, slugParam} from './util.ts';
import type {Deps} from './util.ts';
import {saveUpload} from './uploads.ts';

export function voiceRoutes({jobs, worker}: Deps): Hono {
  const app = new Hono();
  const pending = new Set<string>(); // voice names with an upload/voice-add job in flight

  app.get('/voices', async c => {
    const {data: config} = await readConfigV();
    const files = await readdir(safeJoin('voices')).catch(() => [] as string[]);
    const out: VoiceInfo[] = Object.entries(config.voices).map(([name, v]) => ({
      name, ref: v.ref, isDefault: config.defaults.voice === name, seconds: null,
      refs: files.filter(f => f.startsWith(`${name}-`) && f.endsWith('.wav')).sort().map(f => `voices/${f}`),
    }));
    return c.json(out);
  });

  app.get('/voices/tries', async c => c.json((await readJsonOr<Tries | null>(safeJoin('voices', 'tries', 'tries.json'), null)).data));

  app.post('/voices/try', async c => {
    const b = await bodyOf(c);
    const {data: config} = await readConfigV();
    if (typeof b.voice !== 'string' || !Object.hasOwn(config.voices, b.voice)) throw new HttpError(400, 'unknown voice');
    if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 5000) throw new HttpError(400, 'bad text');
    if (!Array.isArray(b.variants) || b.variants.length > 8 || !b.variants.every(isObj)) throw new HttpError(400, 'variants must be an array of up to 8 objects');
    const payload = {voice: b.voice, text: b.text, variants: b.variants};
    return c.json(jobs.enqueue({
      kind: 'try', lane: 'gpu', label: `Thử giọng ${b.voice}`, project: null, cancellable: false,
      run: async ctx => {
        const r = await worker.request('try', payload, (d, t, l) => ctx.progress(t ? d / t : null, l ? `Thử ${l}` : 'Thử giọng'));
        if (!r.ok) throw new Error((r.errors ?? []).join('\n') || 'try failed');
        return r;
      },
    }), 202);
  });

  app.put('/upload-voice/:name/:filename', async c => {
    if (!/[\p{L}\p{N}]/u.test(c.req.param('name'))) throw new HttpError(400, 'bad voice name'); // '!!!' would slugify to the 'media' fallback
    const name = slugParam(slugify(c.req.param('name')), 'voice name');
    const fname = sanitizeFilename(c.req.param('filename'), AUDIO_REF_EXTS);
    const dest = safeJoin('voices', `${name}-short.wav`);
    if (Object.hasOwn((await readConfigV()).data.voices, name) || await stat(dest).then(() => true, () => false)) throw new HttpError(400, 'voice exists');
    if (pending.has(name)) throw new HttpError(400, 'voice exists');
    pending.add(name); // no await between check and add
    const upDir = safeJoin('voices', '_uploads');
    let src: string;
    try { src = path.join(upDir, await saveUpload(c, upDir, `${name}${path.extname(fname)}`)); } catch (e) { pending.delete(name); throw e; }
    return c.json(jobs.enqueue({
      kind: 'voice-add', lane: 'io', label: `Thêm giọng ${name}`, project: null, cancellable: false,
      run: async ctx => {
        let ours = false; // only remove dest if this job produced it
        try {
          ctx.progress(null, 'Chuyển định dạng');
          await convertVoiceRef(src, dest);
          ours = true;
          const file = path.join(repoRoot(), 'config.json');
          const cur = await readJson<Config>(file);
          if (Object.hasOwn(cur.data.voices, name)) { ours = false; throw new Error('voice exists'); }
          await writeJsonAtomic(file, {...cur.data, voices: {...cur.data.voices, [name]: {ref: `voices/${name}-short.wav`}}}, cur.mtime);
          return {name};
        } catch (e) { if (ours) await rm(dest, {force: true}); throw e; } finally { pending.delete(name); await rm(src, {force: true}); }
      },
    }), 202);
  });
  return app;
}
