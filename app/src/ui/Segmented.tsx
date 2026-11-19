import {useLayoutEffect, useRef, useState} from 'react';
import {ToggleGroup} from 'radix-ui';
import type {Option} from './Select.tsx';
import s from './Segmented.module.css';

export function Segmented<T extends string>({value, onChange, options, size = 'md', className, ...aria}: {
  value: T; onChange(v: T): void; options: Option<T>[]; 'aria-label': string; size?: 'sm' | 'md'; className?: string;
}): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{x: number; w: number} | null>(null);
  useLayoutEffect(() => {
    const r = root.current;
    if (!r) return;
    const measure = () => {
      const el = r.querySelector<HTMLElement>('[data-state="on"]');
      if (el) setBox((b) => (b && b.x === el.offsetLeft && b.w === el.offsetWidth ? b : {x: el.offsetLeft, w: el.offsetWidth}));
    };
    measure();
    const ro = new ResizeObserver(measure); // text-size / font changes
    ro.observe(r);
    Array.from(r.children).forEach((c) => ro.observe(c)); // tab widths change with text size even when the list does not
    return () => ro.disconnect();
  }, [value, options, size]);
  return (
    <ToggleGroup.Root ref={root} type="single" value={value} aria-label={aria['aria-label']} className={`${s.root} ${s[size]} ${className ?? ''}`}
      onValueChange={(v) => { if (v) onChange(v as T); }}>
      {box && <span className={s.ind} style={{width: box.w, transform: `translateX(${box.x}px)`}} aria-hidden />}
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} disabled={o.disabled} className={s.item}>{o.icon}{o.label}</ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
