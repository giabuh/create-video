import {useEffect, useState} from 'react';
import s from './Skeleton.module.css';

export function Skeleton({width = '100%', height = 16, radius = 8, delay = 150, style}: {width?: string | number; height?: string | number; radius?: string | number; delay?: number; style?: React.CSSProperties}): React.JSX.Element | null {
  const [shown, setShown] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!shown) return null;
  return <div className={s.skeleton} aria-hidden style={{width, height, borderRadius: radius, ...style}} />;
}
