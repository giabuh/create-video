import {useEffect, useRef, useState} from 'react';
import {fmtSec} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {sceneRange} from './editorState.ts';
import {sceneAtFrame} from './moment.ts';
import {Thumb} from './SceneThumb.tsx';
import s from './SceneStrip.module.css';

export function SceneStrip(): React.JSX.Element | null {
  const {storyboard, renderProps, playerRef, seekToScene} = useEditor();
  const [frame, setFrame] = useState(0);
  const current = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!renderProps || !player) return;
    const sync = () => setFrame(player.getCurrentFrame());
    sync();
    player.addEventListener('frameupdate', sync);
    player.addEventListener('seeked', sync);
    return () => { player.removeEventListener('frameupdate', sync); player.removeEventListener('seeked', sync); };
  }, [renderProps, playerRef]);

  const now = sceneAtFrame(renderProps, frame);
  useEffect(() => { current.current?.scrollIntoView({block: 'nearest', inline: 'nearest'}); }, [now]);

  if (!renderProps) return null;
  const bg = renderProps.brand.colors.background;
  const chip = (id: string, label: string, aria: string, thumb: React.ReactNode) => {
    const range = sceneRange(renderProps, id);
    return (
      <button key={id} type="button" className={s.chip} ref={now === id ? current : undefined} aria-label={aria}
        aria-current={now === id ? 'true' : undefined} onClick={() => seekToScene(id)}>
        {thumb}
        <span className={s.info}><b>{label}</b><span className={s.dur}>{range ? fmtSec(range[1] - range[0]) : '—'}</span></span>
      </button>
    );
  };

  return (
    <div className={s.strip} aria-label="Các cảnh">
      {storyboard.scenes.map((sc) => chip(sc.id, sc.id, `Tới cảnh ${sc.id}`, <Thumb scene={sc} bg={bg} />))}
      {renderProps.cta && chip('cta', 'CTA', 'Tới CTA', null)}
    </div>
  );
}
