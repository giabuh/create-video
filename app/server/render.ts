import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readdir, readFile, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {bundle} from '@remotion/bundler';
import {combineChunks, makeCancelSignal, renderMedia, selectComposition, type RenderMediaOptions} from '@remotion/renderer';
import type {JobCtx} from './jobs.ts';
import {readJson} from './store.ts';
import {repoRoot, safeJoin} from './paths.ts';
import {withSlugLock} from './slugLock.ts';
import {nextVersion, recordRender} from './versions.ts';
import type {VoiceWorker} from './voiceWorker.ts';
import type {Json, RenderProps} from '../shared/types.ts';

// NVENC (GPU) encode when an NVIDIA driver is loaded: at 12 Mbps even the worst frame of the busiest stretch beats
// x264 veryfast/CRF 16 (8 Mbps did not), same speed, and it frees the CPU for Chrome. Remotion only checks that its
// bundled ffmpeg lists h264_nvenc (it always does), so check the driver here.
const NVENC = existsSync('/dev/nvidiactl');
const ENCODE = NVENC
  ? {hardwareAcceleration: 'required', videoBitrate: '12M'} as const
  : {x264Preset: 'veryfast', crf: 16} as const; // same SSIM as medium/CRF 18, ~26% faster
// One browser serializes its tabs through its shared GPU/browser processes: 3 browsers x 2 tabs render a 3-min reel
// ~30% faster than 1 x 4. Measured with NVENC; with x264 the CPU is already saturated, so x264 stays single.
const CHUNKS = NVENC ? 3 : 1;
const execFileP = promisify(execFile);
// 3 render browsers take ~2.6 GB of VRAM (4 GB GTX 1650; peak 3.5 GB with the TTS model resident): split only with room.
const vramFreeMiB = () => execFileP('nvidia-smi', ['--query-gpu=memory.free', '--format=csv,noheader,nounits'])
  .then(r => Number.parseInt(r.stdout, 10) || 0, () => 0);

let cached: {key: string; serveUrl: string} | null = null;
let bundleChain: Promise<unknown> = Promise.resolve();

async function bundleKey(): Promise<string> {
  const studio = path.join(repoRoot(), 'studio');
  const files = (await readdir(path.join(studio, 'src'), {recursive: true, withFileTypes: true})).filter(d => d.isFile()).map(d => path.join(d.parentPath, d.name));
  files.push(path.join(studio, 'remotion.config.ts'));
  const max = Math.max(0, ...await Promise.all(files.map(async f => (await stat(f).catch(() => null))?.mtimeMs ?? 0)));
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
    // GPU (Vulkan) raster: ~4x faster than the default CPU SwiftShader on the full-frame blurs, same pixels (PSNR >36dB)
    const chromiumOptions = {gl: 'vulkan'} as const;
    const composition = await selectComposition({serveUrl, id: 'Reel', inputProps, onBrowserDownload, chromiumOptions});
    tmp = safeJoin('projects', slug, `${name}.tmp.mp4`);
    const opts: Chunkable = {composition, serveUrl, codec: 'h264', inputProps, onBrowserDownload, cancelSignal, chromiumOptions, ...ENCODE};
    if (CHUNKS > 1 && composition.durationInFrames >= 300 && await vramFreeMiB() >= 3000) await renderChunked(opts, tmp, cancel, ctx);
    else await renderMedia({
      ...opts, outputLocation: tmp,
      onProgress: ({progress, renderedFrames, stitchStage}) =>
        ctx.progress(0.25 + 0.75 * progress, stitchStage === 'muxing' ? 'Ghép âm thanh' : `Khung ${renderedFrames}/${composition.durationInFrames}`),
    });
    ctx.signal.throwIfAborted();
    ctx.progress(0.99, 'Giới hạn đỉnh âm thanh');
    const limited = safeJoin('projects', slug, `${name}.lim.mp4`);
    try { await execFileP('ffmpeg', limiterArgs(tmp, limited), {signal: ctx.signal}); }
    catch (e) { await rm(limited, {force: true}); throw e; }
    await rename(limited, tmp);
    await rename(tmp, safeJoin('projects', slug, `${name}.mp4`));
    tmp = null; snapshot = null; // mp4 is final; keep its snapshot even if the meta write fails
    await recordRender(slug, name);
    return {version: name, file: `projects/${slug}/${name}.mp4`};
  } catch (e) {
    await Promise.all([tmp as string | null, snapshot as string | null].map(f => f && rm(f, {force: true})));
    throw e;
  }
}

const PEAK_DBFS = -1.5; // platform spec is <= -1 dBTP; alimiter works on sample peaks, so keep 0.5 dB margin
/** ffmpeg args: video stream copied, audio through a peak limiter (integrated loudness unchanged). */
export const limiterArgs = (src: string, dst: string): string[] => [
  '-v', 'error', '-y', '-i', src, '-map', '0', '-c:v', 'copy',
  '-af', `alimiter=limit=${(10 ** (PEAK_DBFS / 20)).toFixed(3)}:level=disabled:attack=1:release=50`,
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', dst,
];

type Chunkable = Omit<RenderMediaOptions, 'outputLocation'>;

/** Contiguous [first, last] frame ranges covering 0..total-1: chunks of ceil(total/n) frames, the last may be shorter. */
export const chunkRanges = (total: number, n: number): [number, number][] => {
  const per = Math.ceil(total / n);
  return Array.from({length: Math.ceil(total / per)}, (_, i) => [i * per, Math.min(total, (i + 1) * per) - 1]);
};

async function renderChunked(opts: Chunkable, out: string, cancel: () => void, ctx: JobCtx): Promise<void> {
  const total = opts.composition.durationInFrames, ranges = chunkRanges(total, CHUNKS), per = ranges[0][1] + 1;
  const parts = ranges.map((frameRange, i) => ({frameRange, video: `${out}.${i}.mp4`, audio: `${out}.${i}.aac`, done: 0}));
  const report = () => {
    const n = Math.min(total, parts.reduce((sum, p) => sum + p.done, 0));
    ctx.progress(0.25 + 0.7 * n / total, `Khung ${n}/${total}`);
  };
  try {
    const results = await Promise.allSettled(parts.map(p => renderMedia({
      ...opts, concurrency: 2, frameRange: p.frameRange, outputLocation: p.video, separateAudioTo: p.audio, forSeamlessAacConcatenation: true,
      onProgress: ({renderedFrames}) => { p.done = renderedFrames; report(); },
    }).catch((e: unknown) => { cancel(); throw e; }))); // one failed chunk stops the others
    const failed = results.find(r => r.status === 'rejected');
    if (failed) throw failed.reason;
    ctx.progress(0.96, 'Ghép âm thanh');
    // combineChunks byte-concatenates h264 chunks, which only works on MPEG-TS; codec h264-ts can't use NVENC -> remux
    for (const p of parts) await execFileP('ffmpeg', ['-v', 'error', '-y', '-i', p.video, '-c', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts', `${p.video}.ts`]);
    await combineChunks({
      outputLocation: out, codec: 'h264', fps: opts.composition.fps, framesPerChunk: per, preferLossless: false, compositionDurationInFrames: total,
      videoFiles: parts.map(p => `${p.video}.ts`), audioFiles: parts.map(p => p.audio), cancelSignal: opts.cancelSignal,
    });
  } finally {
    await Promise.all(parts.flatMap(p => [p.video, `${p.video}.ts`, p.audio]).map(f => rm(f, {force: true})));
  }
}
