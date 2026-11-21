import {useState} from 'react';
import type {SceneSpec} from '../../../shared/types.ts';
import {VideoThumb} from '../../ui/index.ts';
import s from './SceneThumb.module.css';

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const url = (src: string) => `/library/${src.split('/').map(encodeURIComponent).join('/')}`;

export function Thumb({scene, bg}: {scene: SceneSpec; bg: string | undefined}): React.JSX.Element {
  const src = scene.media?.[0]?.src;
  const [broken, setBroken] = useState<string | null>(null);
  if (src && IMAGE.test(src) && broken !== src) return <img className={s.thumb} src={url(src)} alt="" loading="lazy" onError={() => setBroken(src)} />;
  if (src && !IMAGE.test(src)) return <div className={s.thumb}><VideoThumb src={url(src)} label={src} /></div>;
  return <div className={`${s.thumb} ${s.swatch}`} style={{background: bg}}>{scene.motion?.[0]?.component ?? (src ? 'ảnh' : '—')}</div>;
}
