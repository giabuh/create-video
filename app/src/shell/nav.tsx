import {useLayoutEffect, useRef, useState} from 'react';
import {NavLink, useLocation} from 'react-router';
import {FolderOpen, Images, Mic, Settings2} from 'lucide-react';
import {Tooltip} from '../ui/index.ts';
import s from './nav.module.css';

const ITEMS = [
  {to: '/', label: 'Dự án', Icon: FolderOpen},
  {to: '/library', label: 'Thư viện', Icon: Images},
  {to: '/voices', label: 'Giọng đọc', Icon: Mic},
  {to: '/settings', label: 'Brand & cài đặt', Icon: Settings2},
] as const;

/** Project routes (/p/*) belong to the "Dự án" item. */
const isActive = (to: string, path: string) => (to === '/' ? path === '/' || path.startsWith('/p/') : path.startsWith(to));

export function NavList({compact}: {compact?: boolean}): React.JSX.Element {
  const {pathname} = useLocation();
  const root = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{y: number; h: number} | null>(null);
  useLayoutEffect(() => {
    const r = root.current;
    if (!r) return;
    const measure = () => {
      const el = r.querySelector<HTMLElement>('[data-active="true"]');
      setBox(el ? (b) => (b && b.y === el.offsetTop && b.h === el.offsetHeight ? b : {y: el.offsetTop, h: el.offsetHeight}) : null);
    };
    measure();
    const ro = new ResizeObserver(measure); // text size changes row heights
    ro.observe(r);
    return () => ro.disconnect();
  }, [pathname, compact]);
  return (
    <nav ref={root} className={`${s.nav} ${compact ? s.compact : ''}`} aria-label="Điều hướng">
      {box && <span className={s.ind} style={{height: box.h, transform: `translateY(${box.y}px)`}} aria-hidden />}
      {ITEMS.map(({to, label, Icon}) => {
        const active = isActive(to, pathname);
        const link = (
          <NavLink key={to} to={to} viewTransition className={s.item} data-active={active} aria-current={active ? 'page' : undefined} aria-label={compact ? label : undefined}>
            <Icon size={compact ? 22 : 20} aria-hidden />
            {!compact && label}
          </NavLink>
        );
        return compact ? <Tooltip key={to} content={label} side="right">{link}</Tooltip> : link;
      })}
    </nav>
  );
}
