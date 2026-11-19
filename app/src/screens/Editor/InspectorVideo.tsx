import type {Storyboard} from '../../../shared/types.ts';
import {useBrands, useConfig, useMusic, useTemplates, useVoices} from '../../api/hooks.ts';
import {Button, Field, NumberField, Select, Slider} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import s from './Inspector.module.css';

const NONE = '__none';

export function InspectorVideo(): React.JSX.Element {
  const {storyboard: sb, setStoryboard} = useEditor();
  const brands = useBrands();
  const templates = useTemplates();
  const voices = useVoices();
  const music = useMusic();
  const cfg = useConfig().data?.data;
  const def = cfg?.defaults;
  // undefined removes the key so config defaults apply
  const set = (p: Partial<Storyboard>) => {
    const n: Record<string, unknown> = {...sb, ...p};
    for (const k of Object.keys(n)) if (n[k] === undefined) delete n[k];
    setStoryboard(n as Storyboard);
  };
  const opts = (names: string[], d?: string) => [{value: '', label: d ? `Mặc định (${d})` : 'Mặc định'}, ...names.map((n) => ({value: n, label: n}))];
  const speedDef = Number(cfg?.tts.speed ?? 1);
  const speed = Number(sb.tts?.speed ?? speedDef);
  const m = sb.music;
  const musicVal = m === null ? NONE : m ? m.file : '';
  const musicOpts = [{value: '', label: 'Mặc định'}, {value: NONE, label: 'Không nhạc'}, ...(music.data ?? []).map((f) => ({value: f.name, label: f.name})), ...(m && !(music.data ?? []).some((f) => f.name === m.file) ? [{value: m.file, label: `${m.file} (thiếu file)`}] : [])];
  const volDef = Number(cfg?.music.volume ?? 0.2);

  return (
    <div className={s.stack}>
      <Field label="Thương hiệu"><Select value={sb.brand ?? ''} onChange={(v) => set({brand: v || undefined})} options={opts((brands.data ?? []).map((b) => b.id), def?.brand)} /></Field>
      <Field label="Mẫu video"><Select value={sb.template ?? ''} onChange={(v) => set({template: v || undefined})} options={opts(templates.data ?? [], def?.template)} /></Field>
      <Field label="Giọng đọc"><Select value={sb.voice ?? ''} onChange={(v) => set({voice: v || undefined})} options={opts((voices.data ?? []).map((v) => v.name), def?.voice)} /></Field>
      <Field label={`Tốc độ chung (${sb.tts?.speed == null ? 'mặc định' : 'riêng video'})`}>
        <Slider aria-label="Tốc độ chung" min={0.5} max={2} step={0.05} value={speed} format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => set({tts: {...sb.tts, speed: v}})} />
      </Field>
      {sb.tts?.speed != null && <Button size="sm" variant="ghost" onClick={() => { const {speed: _, ...rest} = sb.tts ?? {}; set({tts: Object.keys(rest).length ? rest : undefined}); }}>Dùng tốc độ mặc định ({speedDef.toFixed(2)}×)</Button>}
      <Field label="Độ dài mục tiêu (giây)"><NumberField value={sb.targetSeconds ?? null} min={5} step={1} onChange={(v) => set({targetSeconds: v ?? undefined})} /></Field>
      <Field label="Nhạc nền"><Select value={musicVal} options={musicOpts}
        onChange={(v) => set({music: v === '' ? undefined : v === NONE ? null : {file: v, ...(m?.volume != null ? {volume: m.volume} : {})}})} /></Field>
      <Field label={`Âm lượng nhạc (${m?.volume == null ? 'mặc định' : 'riêng video'})`} hint={m ? undefined : 'Chọn một file nhạc để chỉnh âm lượng.'}>
        <Slider aria-label="Âm lượng nhạc" min={0} max={1} step={0.01} disabled={!m} value={m?.volume ?? volDef} format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => m && set({music: {...m, volume: v}})} />
      </Field>
    </div>
  );
}
