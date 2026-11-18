import {Children, cloneElement, useId, useLayoutEffect, useRef, useState} from 'react';
import {Minus, Plus} from 'lucide-react';
import {fmtNum, normalizeNum, parseNum} from './format.ts';
import s from './Field.module.css';

export function Field({label, hint, error, children}: {label: string; hint?: string; error?: string; children: React.ReactElement}): React.JSX.Element {
  const auto = useId();
  const child = Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const id = (child.props.id as string | undefined) ?? auto;
  const noteId = `${id}-note`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {cloneElement(child, {
        id,
        'aria-describedby': error || hint ? noteId : undefined,
        'aria-invalid': error ? true : undefined,
        ...(error ? {invalid: true} : {}),
      })}
      {error
        ? <div id={noteId} className={s.error} role="alert">{error}</div>
        : hint && <div id={noteId} className={s.hint}>{hint}</div>}
    </div>
  );
}

export function Input({invalid, className, ...rest}: React.InputHTMLAttributes<HTMLInputElement> & {invalid?: boolean}): React.JSX.Element {
  return <input {...rest} className={[s.control, s.input, invalid && s.invalid, className].filter(Boolean).join(' ')} aria-invalid={invalid || rest['aria-invalid']} />;
}

export function Textarea({autosize, invalid, className, onInput, ...rest}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {autosize?: boolean; invalid?: boolean}): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!autosize || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit); // also covers controlled value changes
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rest.rows ?? 3}
      className={[s.control, s.textarea, autosize && s.autosize, invalid && s.invalid, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || rest['aria-invalid']}
      onInput={(e) => { fit(); onInput?.(e); }}
    />
  );
}

type NumberFieldProps = {
  value: number | null; onChange(v: number | null): void;
  min?: number; max?: number; step?: number; decimals?: number; suffix?: string;
  id?: string; 'aria-label'?: string; 'aria-describedby'?: string; disabled?: boolean; invalid?: boolean;
};

export function NumberField({value, onChange, min, max, step = 1, decimals, suffix, id, disabled, invalid, ...aria}: NumberFieldProps): React.JSX.Element {
  const dec = decimals ?? (String(step).split('.')[1]?.length ?? 0);
  const fmt = (v: number | null) => (v == null ? '' : fmtNum(v, dec));
  const [draft, setDraft] = useState<string | null>(null); // text while typing, so "1," is not clobbered
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const round = (v: number) => Number(v.toFixed(dec));
  const bump = (dir: 1 | -1) => { setDraft(null); onChange(clamp(round((value ?? 0) + dir * step))); };
  const commit = () => { setDraft(null); if (value != null) { const n = normalizeNum(value, {min, max, decimals: dec}); if (n !== value) onChange(n); } };

  return (
    <div className={`${s.num} ${invalid ? s.invalid : ''}`} aria-invalid={invalid || undefined}>
      <button type="button" className={s.step} aria-label="Giảm" disabled={disabled || (min != null && value != null && value <= min)} onClick={() => bump(-1)}><Minus size={16} aria-hidden /></button>
      <input
        id={id}
        className={s.numInput}
        inputMode="decimal"
        disabled={disabled}
        aria-label={aria['aria-label']}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={invalid || undefined}
        value={draft ?? fmt(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const t = e.target.value.trim();
          if (t === '') onChange(null);
          else { const n = parseNum(t); if (n != null) onChange(n); }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
        }}
      />
      {suffix && <span className={s.suffix}>{suffix}</span>}
      <button type="button" className={s.step} aria-label="Tăng" disabled={disabled || (max != null && value != null && value >= max)} onClick={() => bump(1)}><Plus size={16} aria-hidden /></button>
    </div>
  );
}
