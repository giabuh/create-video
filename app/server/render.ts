import {readdir, readFile, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {makeCancelSignal, renderMedia, selectComposition} from '@remotion/renderer';
import type {JobCtx} from './jobs.ts';
import {readJson} from './store.ts';
import {repoRoot, safeJoin} from './paths.ts';
import {withSlugLock} from './slugLock.ts';
import {nextVersion, recordRender} from './versions.ts';
import type {VoiceWorker} from './voiceWorker.ts';
import type {Json, RenderProps} from '../shared/types.ts';

let cached: {key: string; serveUrl: string} | null = null;
let bundleChain: Promise<unknown> = Promise.resolve();

async function bundleKey(): Promise<string> {
  const studio = path.join(repoRoot(), 'studio');
  const files = (await readdir(path.join(studio, 'src'), {recursive: true, withFileTypes: true})).filter(d => d.isFile()).map(d => path.join(d.parentPath, d.name));
  files.push(path.join(studio, 'remotion.config.ts'));
  let max = 0;
  for (const f of files) max = Math.max(max, (await stat(f).catch(() => null))?.mtimeMs ?? 0);
  return `${files.length}:${max}`;
}

function getServeUrl(ctx: JobCtx): Promise<string> {
  const run = async () => {
    const key = await bundleKey();
    if (cached?.key === key) return cached.serveUrl;
    const studio = path.join(repoRoot(), 'studio');
    const serveUrl = await bundle({
      entryPoint: path.join(studio, 'src/index.ts'), publicDir: path.join(studio, 'public'), onSymlinkDetected: () => {},
      onProgress: p => ctx.progress(0.15 + 0.1 * p / 100, 'Đóng gói'),
    });
    const old = cached?.serveUrl;
    cached = {key, serveUrl};
    if (old) await rm(old, {recursive: true, force: true});
    return serveUrl;
  };
  const p = bundleChain.then(run, run);
  bundleChain = p.catch(() => {});
  return p;
}

export async function renderVersion(slug: string, ctx: JobCtx, worker: VoiceWorker): Promise<Json> {
  const sbPath = safeJoin('projects', slug, 'storyboard.json');
  let snapshot: string | null = null, tmp: string | null = null;
  try {
    ctx.signal.throwIfAborted();
    const {props, name} = await withSlugLock(slug, async () => {
      let sbBytes = await readFile(sbPath);
      const voice = async () => {
        ctx.progress(null, 'Kiểm tra giọng');
        const r = await worker.request('prepare', {project: slug}, (d, t, l) => ctx.progress(t ? 0.15 * d / t : null, l ? `Tạo giọng ${l}` : 'Tạo giọng'));
        if (!r.ok) throw new Error((r.errors ?? []).join('\n'));
      };
      await voice();
      const again = await readFile(sbPath);
      if (!again.equals(sbBytes)) {
        sbBytes = again;
        await voice();
        if (!(await readFile(sbPath)).equals(sbBytes)) throw new Error('Storyboard thay đổi trong lúc tạo giọng — hãy bấm Render lại');
      }
      ctx.signal.throwIfAborted();
      const props = (await readJson<RenderProps>(safeJoin('projects', slug, 'render-props.json'))).data;
      const {name} = await nextVersion(slug);
      snapshot = safeJoin('projects', slug, `${name}.storyboard.json`);
      await writeFile(snapshot, sbBytes);
      return {props, name};
    });
    const serveUrl = await getServeUrl(ctx);
    ctx.signal.throwIfAborted();
    const {cancelSignal, cancel} = makeCancelSignal();
    ctx.signal.addEventListener('abort', cancel, {once: true});
    if (ctx.signal.aborted) cancel();
    const inputProps = props as unknown as Record<string, unknown>;
    const onBrowserDownload = () => { ctx.progress(null, 'Đang tải trình duyệt render'); return {version: null, onProgress: () => {}}; };
    const composition = await selectComposition({serveUrl, id: 'Reel', inputProps, onBrowserDownload});
    tmp = safeJoin('projects', slug, `${name}.tmp.mp4`);
    await renderMedia({
      composition, serveUrl, codec: 'h264', outputLocation: tmp, inputProps, onBrowserDownload, cancelSignal,
      onProgress: ({progress, renderedFrames, stitchStage}) =>
        ctx.progress(0.25 + 0.75 * progress, stitchStage === 'muxing' ? 'Ghép âm thanh' : `Khung ${renderedFrames}/${composition.durationInFrames}`),
    });
    ctx.signal.throwIfAborted();
    await rename(tmp, safeJoin('projects', slug, `${name}.mp4`));
    tmp = null; snapshot = null; // mp4 is final; keep its snapshot even if the meta write fails
    await recordRender(slug, name);
    return {version: name, file: `projects/${slug}/${name}.mp4`};
  } catch (e) {
    await Promise.all([tmp as string | null, snapshot as string | null].map(f => f && rm(f, {force: true})));
    throw e;
  }
}
