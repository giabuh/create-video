import {useLayoutEffect, useRef, useState} from 'react';
import {ToggleGroup} from 'radix-ui';
import type {Option} from './Select.tsx';
import s from './Segmented.module.css';

export function Segmented<T extends string>({value, onChange, options, size = 'md', ...aria}: {
  value: T; onChange(v: T): void; options: Option<T>[]; 'aria-label': string; size?: 'sm' | 'md';
}): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{x: number; w: number} | null>(null);
  useLayoutEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('[data-state="on"]');
    if (el) setBox({x: el.offsetLeft, w: el.offsetWidth});
  }, [value, options, size]);
  return (
    <ToggleGroup.Root ref={root} type="single" value={value} aria-label={aria['aria-label']} className={`${s.root} ${s[size]}`}
      onValueChange={(v) => { if (v) onChange(v as T); }}>
      {box && <span className={s.ind} style={{width: box.w, transform: `translateX(${box.x}px)`}} aria-hidden />}
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} disabled={o.disabled} className={s.item}>{o.icon}{o.label}</ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
