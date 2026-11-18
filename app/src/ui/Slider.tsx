import {useState} from 'react';
import {Slider as RSlider} from 'radix-ui';
import s from './Slider.module.css';

type Common = {min: number; max: number; step: number; format?(v: number): string; disabled?: boolean};

function Base({value, onChange, min, max, step, format = String, disabled, id, label}: Common & {value: number[]; onChange(v: number[]): void; id?: string; label?: string}): React.JSX.Element {
  const [drag, setDrag] = useState(false);
  return (
    <RSlider.Root className={s.root} value={value} min={min} max={max} step={step} disabled={disabled}
      onValueChange={onChange} onPointerDown={() => setDrag(true)} onValueCommit={() => setDrag(false)}
      onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}>
      <RSlider.Track className={s.track}><RSlider.Range className={s.range} /></RSlider.Track>
      {value.map((v, i) => (
        <RSlider.Thumb key={i} id={i === 0 ? id : undefined} className={s.thumb} data-active={drag || undefined}
          aria-label={label ? (value.length > 1 ? `${label} ${i === 0 ? '(từ)' : '(đến)'}` : label) : undefined}>
          <span className={s.bubble} aria-hidden>{format(v)}</span>
        </RSlider.Thumb>
      ))}
    </RSlider.Root>
  );
}

export function Slider({value, onChange, id, ...p}: Common & {value: number; onChange(v: number): void; id?: string; 'aria-label'?: string}): React.JSX.Element {
  return <Base {...p} id={id} label={p['aria-label']} value={[value]} onChange={(v) => onChange(v[0])} />;
}

export function RangeSlider({value, onChange, ...p}: Common & {value: [number, number]; onChange(v: [number, number]): void; 'aria-label'?: string}): React.JSX.Element {
  return <Base {...p} label={p['aria-label']} value={value} onChange={(v) => onChange([v[0], v[1]])} />;
}
