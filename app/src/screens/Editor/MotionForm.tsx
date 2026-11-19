import {useState} from 'react';
import type {Json} from '../../../shared/types.ts';
import {Field, Input, NumberField, Textarea} from '../../ui/index.ts';
import {MOTION_SCHEMAS, validateMotionProps} from './motionSchemas.ts';
import s from './Inspector.module.css';

/** List field keeps its own text so a trailing newline survives while typing. */
function ListField({label, value, onChange}: {label: string; value: string[]; onChange(v: string[]): void}): React.JSX.Element {
  const [text, setText] = useState(value.join('\n'));
  return (
    <Field label={label}>
      <Textarea autosize rows={2} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)); }} />
    </Field>
  );
}

function JsonField({value, onChange}: {value: Json; onChange(v: Json): void}): React.JSX.Element {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <Field label="Props (JSON)" error={err ?? undefined} hint="Component này chưa có form riêng — sửa trực tiếp JSON.">
      <Textarea autosize rows={4} spellCheck={false} value={text} onChange={(e) => {
        setText(e.target.value);
        try {
          const v: unknown = JSON.parse(e.target.value);
          if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Phải là một object JSON');
          setErr(null); onChange(v as Json);
        } catch (x) { setErr(`JSON không hợp lệ: ${x instanceof Error ? x.message : String(x)}`); }
      }} />
    </Field>
  );
}

export function MotionForm({component, value, onChange}: {component: string; value: Json; onChange(v: Json): void}): React.JSX.Element {
  const schema = MOTION_SCHEMAS[component];
  if (!schema) return <JsonField value={value} onChange={onChange} />;
  const set = (key: string, v: unknown) => {
    const next = {...value};
    if (v === undefined || v === null || v === '') delete next[key]; else next[key] = v;
    onChange(next);
  };
  const errors = validateMotionProps(component, value);
  return (
    <div className={s.stack}>
      {schema.map((fd) => {
        const v = value[fd.key];
        const label = fd.optional ? `${fd.label} (tuỳ chọn)` : fd.label;
        if (fd.type === 'list') return <ListField key={fd.key} label={label} value={Array.isArray(v) ? (v as string[]) : []} onChange={(x) => set(fd.key, x.length ? x : undefined)} />;
        if (fd.type === 'number') return <Field key={fd.key} label={label}><NumberField value={typeof v === 'number' ? v : null} onChange={(x) => set(fd.key, x)} step={fd.key === 'decimals' ? 1 : 1} min={fd.key === 'decimals' ? 0 : undefined} /></Field>;
        return <Field key={fd.key} label={label}><Input value={typeof v === 'string' ? v : ''} onChange={(e) => set(fd.key, e.target.value)} /></Field>;
      })}
      {errors.length > 0 && <div className={s.warn} role="alert">{errors.join(' · ')}</div>}
    </div>
  );
}
