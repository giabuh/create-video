import {memo, useEffect, useImperativeHandle, useRef} from 'react';
import {Megaphone} from 'lucide-react';
import {fmtClock, fmtSec} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {sceneRange} from './editorState.ts';
import {sceneAtFrame} from './moment.ts';
import {Thumb} from './SceneThumb.tsx';
import s from './SceneStrip.module.css';

export type SceneStripHandle = {showFrame(frame: number | null): void};

/** Keep the playhead mid-strip: the film scrolls with playback instead of jumping at each cut (edges clamp it). */
function follow(chip: HTMLButtonElement, progress: number): void {
  const strip = chip.parentElement;
  if (!strip) return;
  const clip = chip.getBoundingClientRect(), track = strip.getBoundingClientRect();
  strip.scrollLeft += clip.left - track.left + 4 + (clip.width - 8) * progress - track.width / 2; // .playhead: left 4px, inset 8px
}

export const SceneStrip = memo(function SceneStrip({ref}: {ref: React.Ref<SceneStripHandle>}): React.JSX.Element | null {
  const {storyboard, renderProps, seekToScene} = useEditor();
  const stripRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const current = useRef<HTMLButtonElement | null>(null);
  const currentRange = useRef<[number, number] | null>(null);
  const position = useRef(0);

  // Playback updates only the selected button. The filmstrip itself renders when the storyboard changes.
  useImperativeHandle(ref, () => ({
    showFrame(frame) {
      const id = frame === null ? null : sceneAtFrame(renderProps, frame);
      const chip = id === null ? null : buttons.current.get(id) ?? null;
      if (chip !== current.current) {
        current.current?.removeAttribute('aria-current');
        current.current = chip;
        currentRange.current = id === null ? null : sceneRange(renderProps, id);
        chip?.setAttribute('aria-current', 'true');
      }
      if (!chip || !renderProps || frame === null) return;
      const [start, end] = currentRange.current ?? [0, 0];
      const progress = end > start ? Math.max(0, Math.min(1, (frame - Math.round(start * renderProps.fps)) / ((end - start) * renderProps.fps))) : 0;
      chip.style.setProperty('--position', String(progress));
      position.current = progress;
      follow(chip, progress);
    },
  }), [renderProps]);

  useEffect(() => {
    // The same scene can have new bounds after a storyboard edit.
    currentRange.current = sceneRange(renderProps, current.current?.dataset.scene ?? '');
    if (current.current) follow(current.current, position.current);
  }, [renderProps]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    let width = strip.clientWidth;
    const observer = new ResizeObserver(() => {
      if (strip.clientWidth === width) return;
      width = strip.clientWidth;
      if (current.current) follow(current.current, position.current);
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, [!!renderProps]);

  if (!renderProps) return null;
  const bg = renderProps.brand.colors.background;
  const chip = (id: string, label: string, aria: string, thumb: React.ReactNode) => {
    const range = sceneRange(renderProps, id);
    const duration = range ? range[1] - range[0] : null;
    return (
      <button key={id} type="button" className={s.chip} data-scene={id} aria-label={aria}
        ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id); }}
        style={duration === null ? undefined : {'--duration': duration} as React.CSSProperties}
        onClick={() => seekToScene(id)}>
        <span className={s.start}>{range ? fmtClock(range[0]) : '—'}</span>
        <span className={s.thumbnail}>{thumb}</span>
        <span className={s.info}><b title={label}>{label}</b><span className={s.dur}>{duration === null ? '—' : fmtSec(duration)}</span></span>
        {duration !== null && duration > 0 && <span className={s.playhead} data-testid="timeline-playhead" aria-hidden />}
      </button>
    );
  };

  return (
    <div ref={stripRef} className={s.strip} role="group" aria-label="Các cảnh">
      {storyboard.scenes.map((sc) => chip(sc.id, sc.id, `Tới cảnh ${sc.id}`, <Thumb scene={sc} bg={bg} />))}
      {renderProps.cta && chip('cta', 'CTA', 'Tới CTA', <Megaphone size={20} aria-hidden />)}
    </div>
  );
});
