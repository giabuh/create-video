import {useEffect, useRef} from 'react';
import {Megaphone} from 'lucide-react';
import {fmtClock, fmtSec} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {sceneRange} from './editorState.ts';
import {sceneAtFrame} from './moment.ts';
import {Thumb} from './SceneThumb.tsx';
import s from './SceneStrip.module.css';

export function SceneStrip({frame}: {frame: number | null}): React.JSX.Element | null {
  const {storyboard, renderProps, seekToScene} = useEditor();
  const now = frame === null ? null : sceneAtFrame(renderProps, frame);
  const current = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const chip = current.current;
    const strip = chip?.parentElement;
    if (!chip || !strip) return;
    const center = (behavior: ScrollBehavior) => {
      const clip = chip.getBoundingClientRect(), track = strip.getBoundingClientRect();
      strip.scrollTo({left: strip.scrollLeft + clip.left - track.left + (clip.width - track.width) / 2, behavior});
    };
    center(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth');
    let width = strip.clientWidth;
    const observer = new ResizeObserver(() => {
      if (strip.clientWidth === width) return;
      width = strip.clientWidth;
      center('instant');
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, [now]);

  if (!renderProps) return null;
  const bg = renderProps.brand.colors.background;
  const chip = (id: string, label: string, aria: string, thumb: React.ReactNode) => {
    const range = sceneRange(renderProps, id);
    const duration = range ? range[1] - range[0] : null;
    const progress = now === id && frame !== null && range && duration && duration > 0
      ? Math.max(0, Math.min(1, (frame / renderProps.fps - range[0]) / duration))
      : null;
    return (
      <button key={id} type="button" className={s.chip} ref={now === id ? current : undefined} aria-label={aria}
        style={duration === null ? undefined : {'--duration': duration} as React.CSSProperties}
        aria-current={now === id ? 'true' : undefined} onClick={() => seekToScene(id)}>
        <span className={s.start}>{range ? fmtClock(range[0]) : '—'}</span>
        <span className={s.thumbnail}>{thumb}</span>
        <span className={s.info}><b title={label}>{label}</b><span className={s.dur}>{duration === null ? '—' : fmtSec(duration)}</span></span>
        {progress !== null && <span className={s.playhead} data-testid="timeline-playhead" aria-hidden
          style={{'--position': progress} as React.CSSProperties} />}
      </button>
    );
  };

  return (
    <div className={s.strip} role="group" aria-label="Các cảnh">
      {storyboard.scenes.map((sc) => chip(sc.id, sc.id, `Tới cảnh ${sc.id}`, <Thumb scene={sc} bg={bg} />))}
      {renderProps.cta && chip('cta', 'CTA', 'Tới CTA', <Megaphone size={20} aria-hidden />)}
    </div>
  );
}
