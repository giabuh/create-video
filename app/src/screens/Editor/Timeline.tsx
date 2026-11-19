import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Music} from 'lucide-react';
import {useWaveform} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {sceneKind} from './editorState.ts';
import {fmtSec, pxPerSecond, rulerTicks, timeFromX} from './timelineLayout.ts';
import s from './Timeline.module.css';

const BARS_PER_SEC = 12;

function Wave({src, seconds, pps}: {src: string; seconds: number; pps: number}): React.JSX.Element {
  const {peaks, error} = useWaveform(`/${src}`, Math.max(1, Math.round(seconds * BARS_PER_SEC)));
  return (
    <div className={s.wave} style={{width: seconds * pps}} title={error ? 'Không đọc được âm thanh' : undefined}>
      {peaks?.map((p, i) => <i key={i} style={{height: `${Math.max(6, p * 100)}%`}} />)}
      {!peaks && <span className={error ? s.waveErr : s.waveWait} />}
    </div>
  );
}

/** Playhead time in seconds, synced to the Player (frameupdate, smoothed with rAF). */
function usePlayhead(fps: number): number {
  const {playerRef, renderProps} = useEditor();
  const [t, setT] = useState(0);
  const target = useRef(0);
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    let raf = 0;
    const onFrame = (e: {detail: {frame: number}}) => {
      target.current = e.detail.frame / fps;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setT(target.current));
    };
    p.addEventListener('frameupdate', onFrame);
    setT(p.getCurrentFrame() / fps);
    return () => { p.removeEventListener('frameupdate', onFrame); cancelAnimationFrame(raf); };
  }, [playerRef, fps, renderProps !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  return t;
}

export function Timeline(): React.JSX.Element {
  const {storyboard, renderProps, stale, selectedId, select, seekToScene, playerRef} = useEditor();
  const outer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const fps = renderProps?.fps ?? 30;
  const t = usePlayhead(fps);

  const ready = renderProps !== null;
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ready]);

  if (!renderProps) return <div className={s.root}><p className={s.empty}>Chưa có bản xem trước để dựng timeline.</p></div>;

  const total = renderProps.totalSeconds;
  const pps = pxPerSecond(width, total);
  const kinds = new Map(storyboard.scenes.map((x) => [x.id, sceneKind(x)]));
  const last = renderProps.scenes.at(-1);
  const ctaStart = last ? last.start + last.duration : 0;
  const music = renderProps.music;
  const musicName = music?.src.split('/').pop() ?? '';

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    playerRef.current?.seekTo(Math.round(timeFromX(e.clientX - r.left, pps, total) * fps));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    playerRef.current?.seekTo(Math.max(0, Math.min(Math.round(total * fps) - 1, Math.round(t * fps) + d * fps / 2)));
  };

  return (
    <section className={s.root} aria-label="Timeline">
      <div className={s.title}><b>Timeline</b><span>{fmtSec(total)} giây</span></div>
      <div className={s.scroll} ref={outer}>
        <div className={s.canvas} style={{width: total * pps}}>
          <div className={s.ruler} role="slider" tabIndex={0} aria-label="Vị trí phát" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.round(t * 10) / 10}
            aria-valuetext={`${fmtSec(t)} giây`} onKeyDown={onKey}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e); }}
            onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e); }}>
            {rulerTicks(total).map(({t: tick, label}) => (
              <span key={tick} className={s.tick} data-label={label || undefined} style={{left: tick * pps}}>{label && <b>{tick}</b>}</span>
            ))}
            <span className={s.end} style={{left: total * pps}}>{fmtSec(total)} s</span>
          </div>

          <div className={s.row}>
            {renderProps.scenes.map((sc) => {
              const sel = selectedId === sc.id;
              return (
                <button key={sc.id} type="button" className={s.block} data-kind={kinds.get(sc.id) ?? 'other'} data-selected={sel || undefined} data-stale={stale.includes(sc.id) || undefined}
                  style={{left: sc.start * pps, width: sc.duration * pps}} aria-pressed={sel}
                  onClick={() => { select(sc.id); seekToScene(sc.id); }}>
                  <span>{sc.id} · {fmtSec(sc.duration)} s</span>
                </button>
              );
            })}
            {renderProps.cta && (
              <button type="button" className={s.block} data-kind="cta" data-selected={selectedId === 'cta' || undefined}
                style={{left: ctaStart * pps, width: renderProps.cta.duration * pps}} aria-pressed={selectedId === 'cta'}
                onClick={() => { select('cta'); seekToScene('cta'); }}>
                <span>CTA · {fmtSec(renderProps.cta.duration)} s</span>
              </button>
            )}
          </div>

          <div className={s.row} data-track="voice">
            {renderProps.scenes.map((sc) => sc.voice && (
              <div key={sc.id} className={s.voice} style={{left: sc.start * pps}}><Wave src={sc.voice.src} seconds={sc.voice.duration} pps={pps} /></div>
            ))}
          </div>

          <div className={s.row} data-track="music">
            {music
              ? <div className={s.music} style={{width: total * pps}}><Music size={14} aria-hidden /><span>{musicName} · âm lượng {Math.round(music.volume * 100)}% · hạ còn {Math.round(music.duckTo * 100)}% khi có giọng</span></div>
              : <div className={s.music} data-off style={{width: total * pps}}>Không có nhạc nền</div>}
          </div>

          <div className={s.head} style={{left: t * pps}} aria-hidden />
        </div>
      </div>
    </section>
  );
}
