import {useEffect, useRef, useState} from 'react';
import {Megaphone} from 'lucide-react';
import {fmtClock, fmtSec} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {sceneRange} from './editorState.ts';
import {sceneAtFrame} from './moment.ts';
import {Thumb} from './SceneThumb.tsx';
import s from './SceneStrip.module.css';

export function SceneStrip(): React.JSX.Element | null {
  const {storyboard, renderProps, previewOk, playerRef, seekToScene} = useEditor();
  const [now, setNow] = useState<string | null>(null);
  const current = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!renderProps || !previewOk || !player) return;
    const sync = () => setNow(sceneAtFrame(renderProps, player.getCurrentFrame()));
    sync();
    player.addEventListener('frameupdate', sync);
    player.addEventListener('seeked', sync);
    return () => { player.removeEventListener('frameupdate', sync); player.removeEventListener('seeked', sync); };
  }, [renderProps, previewOk, playerRef]); // previewOk: the Player unmounts and remounts with it

  useEffect(() => { current.current?.scrollIntoView({block: 'nearest', inline: 'nearest'}); }, [now]);

  if (!renderProps) return null;
  const bg = renderProps.brand.colors.background;
  const chip = (id: string, label: string, aria: string, thumb: React.ReactNode) => {
    const range = sceneRange(renderProps, id);
    const duration = range ? range[1] - range[0] : null;
    return (
      <button key={id} type="button" className={s.chip} ref={now === id ? current : undefined} aria-label={aria}
        style={duration === null ? undefined : {'--duration': duration} as React.CSSProperties}
        aria-current={now === id ? 'true' : undefined} onClick={() => seekToScene(id)}>
        <span className={s.start}>{range ? fmtClock(range[0]) : '—'}</span>
        <span className={s.thumbnail}>{thumb}</span>
        <span className={s.info}><b title={label}>{label}</b><span className={s.dur}>{duration === null ? '—' : fmtSec(duration)}</span></span>
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
