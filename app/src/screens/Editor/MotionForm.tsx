import {useState} from 'react';
import type {Json} from '../../../shared/types.ts';
import {useLibrary} from '../../api/hooks.ts';
import {Button, ColorField, Field, Input, NumberField, Select, Switch, Textarea} from '../../ui/index.ts';
import {motionErrors, motionFields, type FieldSpec} from './motionSchema.ts';
import s from './Inspector.module.css';

/** List field keeps its own text so a trailing newline survives while typing. */
function ListField({label, value, error, onChange}: {label: string; value: string[]; error?: string; onChange(v: string[]): void}): React.JSX.Element {
  const [text, setText] = useState(value.join('\n'));
  return (
    <Field label={label} error={error}>
      <Textarea autosize rows={2} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)); }} />
    </Field>
  );
}

function JsonField({label, value, onChange}: {label: string; value: unknown; onChange(v: unknown): void}): React.JSX.Element {
  const [text, setText] = useState(JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <Field label={label} error={err ?? undefined}>
      <Textarea autosize rows={3} spellCheck={false} value={text} onChange={(e) => {
        setText(e.target.value);
        try { onChange(JSON.parse(e.target.value)); setErr(null); } catch (x) { setErr(`JSON không hợp lệ: ${x instanceof Error ? x.message : String(x)}`); }
      }} />
    </Field>
  );
}

function MediaField({fd, value, error, onChange}: {fd: FieldSpec; value: unknown; error?: string; onChange(v: unknown): void}): React.JSX.Element {
  const lib = useLibrary();
  const names = Object.keys(lib.data?.data ?? {}).sort();
  const cur = typeof value === 'string' ? value : null;
  const options = [...new Set([...(cur ? [cur] : []), ...names])].map((n) => ({value: n, label: n}));
  return <Field label={fd.title} error={error}><Select value={cur} placeholder="Chọn file trong thư viện" options={options} onChange={onChange} /></Field>;
}

const hint = (fd: FieldSpec) => [fd.default !== undefined && `Mặc định: ${String(fd.default)}`, fd.min !== undefined && fd.max !== undefined && `${fd.min}–${fd.max}`].filter(Boolean).join(' · ') || undefined;

/** A form generated from the component's zod schema (studio/src/motion/<Name>.tsx `<Name>Schema`). */
export function MotionForm({component, value, onChange}: {component: string; value: Json; onChange(v: Json): void}): React.JSX.Element {
  const fields = motionFields(component);
  if (!fields) return <JsonField label="Props (JSON) — component chưa có trong registry" value={value} onChange={(v) => v && typeof v === 'object' && !Array.isArray(v) && onChange(v as Json)} />;
  const set = (key: string, v: unknown) => {
    const next = {...value};
    if (v === undefined || v === null || v === '') delete next[key]; else next[key] = v;
    onChange(next);
  };
  const errors = motionErrors(component, value);
  return (
    <div className={s.stack}>
      {fields.map((fd) => {
        const v = value[fd.key];
        const label = fd.required ? fd.title : `${fd.title} (tuỳ chọn)`;
        const error = errors[fd.key];
        switch (fd.kind) {
          case 'lines': return <ListField key={fd.key} label={label} error={error} value={Array.isArray(v) ? (v as string[]) : []} onChange={(x) => set(fd.key, x.length ? x : undefined)} />;
          case 'number': return <Field key={fd.key} label={label} error={error} hint={hint(fd)}><NumberField value={typeof v === 'number' ? v : null} min={fd.min} max={fd.max} step={fd.step ?? 1} onChange={(x) => set(fd.key, x)} /></Field>;
          case 'bool': return <Switch key={fd.key} label={fd.title} checked={typeof v === 'boolean' ? v : Boolean(fd.default)} onChange={(x) => set(fd.key, x === fd.default ? undefined : x)} />;
          case 'choice': return <Field key={fd.key} label={fd.title} error={error}><Select value={typeof v === 'string' ? v : String(fd.default ?? '')} options={fd.options ?? []} onChange={(x) => set(fd.key, x === fd.default ? undefined : x)} /></Field>;
          case 'color': return (
            <div key={fd.key} className={s.stack}>
              <Field label={label} error={error}><ColorField optional label={fd.title} value={typeof v === 'string' ? v : ''} onChange={(x) => set(fd.key, x)} /></Field>
              {typeof v === 'string' && <Button size="sm" variant="ghost" onClick={() => set(fd.key, undefined)}>Bỏ màu riêng</Button>}
            </div>
          );
          case 'media': return <MediaField key={fd.key} fd={{...fd, title: label}} value={v} error={error} onChange={(x) => set(fd.key, x)} />;
          case 'textarea': return <Field key={fd.key} label={label} error={error}><Textarea autosize rows={2} value={typeof v === 'string' ? v : ''} onChange={(e) => set(fd.key, e.target.value)} /></Field>;
          case 'json': return <JsonField key={fd.key} label={`${label} (JSON)`} value={v} onChange={(x) => set(fd.key, x)} />;
          default: return <Field key={fd.key} label={label} error={error}><Input value={typeof v === 'string' ? v : ''} onChange={(e) => set(fd.key, e.target.value)} /></Field>;
        }
      })}
      {errors[''] && <div className={s.warn} role="alert">{errors['']}</div>}
    </div>
  );
}
