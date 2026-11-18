import {useLayoutEffect, useRef, useState} from 'react';
import {Tabs as RTabs} from 'radix-ui';
import s from './Tabs.module.css';

export function Tabs<T extends string>({value, onChange, tabs, ...aria}: {
  value: T; onChange(v: T): void; tabs: {value: T; label: string; badge?: React.ReactNode}[]; 'aria-label': string;
}): React.JSX.Element {
  const list = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{x: number; w: number} | null>(null);
  useLayoutEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[data-state="active"]');
    if (el) setBox({x: el.offsetLeft, w: el.offsetWidth});
  }, [value, tabs]);
  return (
    <RTabs.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <RTabs.List ref={list} className={s.list} aria-label={aria['aria-label']}>
        {tabs.map((t) => <RTabs.Trigger key={t.value} value={t.value} className={s.tab}>{t.label}{t.badge}</RTabs.Trigger>)}
        {box && <span className={s.ind} style={{width: box.w, transform: `translateX(${box.x}px)`}} aria-hidden />}
      </RTabs.List>
    </RTabs.Root>
  );
}
