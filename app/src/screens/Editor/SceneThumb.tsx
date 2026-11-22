import {memo, useState} from 'react';
import {Film} from 'lucide-react';
import type {SceneSpec} from '../../../shared/types.ts';
import s from './SceneThumb.module.css';

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const url = (src: string) => `/library/${src.split('/').map(encodeURIComponent).join('/')}`;

export const Thumb = memo(function Thumb({scene, bg}: {scene: SceneSpec; bg: string | undefined}): React.JSX.Element {
  const src = scene.media?.[0]?.src;
  const [broken, setBroken] = useState<string | null>(null);
  if (src && broken !== src) {
    const onError = () => setBroken(src);
    if (IMAGE.test(src)) return <img className={s.thumb} src={url(src)} alt="" loading="lazy" decoding="async" onError={onError} />;
    return (
      <span className={`${s.thumb} ${s.sheet}`}>
        <img src={url(`thumbs/${src.replace(/\.[^./]+$/, '')}.jpg`)} alt="" loading="lazy" decoding="async" onError={onError}
          onLoad={({currentTarget: img}) => {
            // Ingest writes a 3×2 contact sheet. Crop to one tile at its original aspect ratio.
            img.style.setProperty('--tile-ratio', String((img.naturalWidth / 3) / (img.naturalHeight / 2)));
          }} />
      </span>
    );
  }
  return <div className={`${s.thumb} ${s.swatch}`} style={{background: bg}}>{scene.motion?.[0]?.component ?? <Film size={18} aria-hidden />}</div>;
});
