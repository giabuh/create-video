import {useSfx} from '../../api/hooks.ts';
import {AudioPlayer, Field, Select} from '../../ui/index.ts';
import {GROUPS} from '../Library/Sfx.tsx';
import s from './Inspector.module.css';

const AUTO = '';
const groupOf = (name: string) => name.split('-')[0];

/** Display name of an SFX value (group label, file name, or none). */
export function sfxLabel(v: string | null | undefined): string {
  return !v || v === 'none' ? 'Không có âm' : GROUPS.find(([k]) => k === v)?.[1] ?? v;
}

/** value: field absent = auto, "none", a group name, or a file name. `auto` = the config default the field falls back to. */
export function SfxSelect({label, value, auto, onChange, hint}: {label: string; value: string | null | undefined; auto: string | null | undefined; onChange(v: string | undefined): void; hint?: string}): React.JSX.Element {
  const files = (useSfx().data ?? []).map((f) => f.name).sort();
  const groups = [...new Set(files.map(groupOf))];
  const cur = value == null ? AUTO : value;
  const known = (v: string) => v === 'none' || groups.includes(v) || files.includes(v);
  const options = [
    {value: AUTO, label: `Tự động (${sfxLabel(auto)})`}, {value: 'none', label: 'Không có âm'},
    ...groups.map((g) => ({value: g, label: sfxLabel(g)})),
    ...files.map((f) => ({value: f, label: f})),
    ...(cur !== AUTO && !known(cur) ? [{value: cur, label: `${cur} (thiếu)`}] : []),
  ];
  const eff = cur === AUTO ? auto : cur;
  const play = !eff || eff === 'none' ? null : files.includes(eff) ? eff : files.find((f) => groupOf(f) === eff);
  return (
    <Field label={label} hint={hint}>
      <>
      <Select aria-label={label} value={cur} options={options} onChange={(v) => onChange(v === AUTO ? undefined : v)} />
      {play && <AudioPlayer compact src={`/sfx/${encodeURIComponent(play)}`} label={play} />}
      </>
    </Field>
  );
}
