import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import type {Config} from '../../../shared/types.ts';
import {qk, useBrands, useConfig, useSaveConfig, useTemplates, useVoices} from '../../api/hooks.ts';
import {Button, ColorField, ErrorState, fmtNum, Segmented, Select, Skeleton, Slider, Tooltip, toast, useTheme} from '../../ui/index.ts';
import type {TextSize, ThemeChoice} from '../../ui/index.ts';
import {rescaleMix, type MixPct} from './mix.ts';
import s from './Settings.module.css';

const MIX_LABELS = ['Cảnh thật', 'Motion', 'Khác (CTA…)'] as const;
const MIX_COLORS = ['var(--mix-real)', 'var(--mix-motion)', 'var(--mix-other)'] as const;
const pct = (f: number) => Math.round(f * 100);
export type SettingsGroup = 'brand' | 'defaults' | 'av' | 'appearance';
type Draft = {
  defaults?: Partial<Config['defaults']>;
  mix?: Config['mix'];
  captions?: Partial<Config['captions']>;
  music?: Partial<Config['music']>;
};

function Prm({label, value, ...p}: {label: string; value: string; min: number; max: number; step: number; n: number; onChange(v: number): void}): React.JSX.Element {
  return (
    <div className={s.prm}>
      <span>{label}</span>
      <Slider aria-label={label} min={p.min} max={p.max} step={p.step} value={p.n} onChange={p.onChange} />
      <b>{value}</b>
    </div>
  );
}

export function SettingsForm({group}: {group: SettingsGroup}): React.JSX.Element | null {
  const q = useConfig();
  const voices = useVoices();
  const templates = useTemplates();
  const brands = useBrands();
  const save = useSaveConfig();
  const qc = useQueryClient();
  const {theme, setTheme, textSize, setTextSize} = useTheme();
  const [draft, setDraft] = useState<Draft>({});
  if (group === 'brand') return null;
  if (group === 'appearance') return (
    <section className={s.card} aria-label="Giao diện">
      <h2>Giao diện</h2>
      <div><span className={s.label}>Chủ đề</span><Segmented<ThemeChoice> aria-label="Chủ đề" value={theme} onChange={setTheme} options={[{value: 'system', label: 'Theo hệ thống'}, {value: 'light', label: 'Sáng'}, {value: 'dark', label: 'Tối'}]} /></div>
      <div><span className={s.label}>Cỡ chữ giao diện</span><Segmented<TextSize> aria-label="Cỡ chữ giao diện" value={textSize} onChange={setTextSize} options={[{value: 'md', label: 'Vừa'}, {value: 'lg', label: 'Lớn'}, {value: 'xl', label: 'Rất lớn'}]} /></div>
      <span className={s.muted}>Áp dụng ngay, chỉ lưu trên trình duyệt này.</span>
    </section>
  );

  if (q.isLoading) return <div className={s.cards} aria-busy>{[0, 1].map((i) => <div key={i} className={s.card}><Skeleton height={24} width="40%" /><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div>)}</div>;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const server = q.data.data;
  const cfg = {
    ...server,
    defaults: {...server.defaults, ...draft.defaults},
    mix: draft.mix ?? server.mix,
    captions: {...server.captions, ...draft.captions},
    music: {...server.music, ...draft.music},
  };
  const keys = group === 'defaults' ? ['defaults', 'mix'] as const : ['captions', 'music'] as const;
  const dirty = keys.some((key) => JSON.stringify(cfg[key]) !== JSON.stringify(server[key]));
  const clear = (saved?: Draft) => setDraft((cur) => {
    const next = {...cur};
    for (const key of keys) if (!saved || cur[key] === saved[key]) delete next[key];
    return next;
  });
  const mix: MixPct = [pct(cfg.mix.real), pct(cfg.mix.motion), pct(cfg.mix.other)];
  const setMix = (i: 0 | 1 | 2, v: number) => {
    const m = rescaleMix(mix, i, v);
    setDraft((d) => ({...d, mix: {real: m[0] / 100, motion: m[1] / 100, other: m[2] / 100}}));
  };
  const opt = (list: string[] | undefined, cur: string) => Array.from(new Set([...(list ?? []), cur])).filter(Boolean).map((v) => ({value: v, label: v}));
  const onSave = () => {
    const config = group === 'defaults' ? {...server, defaults: cfg.defaults, mix: cfg.mix} : {...server, captions: cfg.captions, music: cfg.music};
    save.mutate({config, baseMtime: q.data.mtime}, {
      onSuccess: () => { clear(draft); toast({title: 'Đã lưu cài đặt', tone: 'success'}); },
      onError: (e) => {
        if (e.status === 409) {
          void qc.invalidateQueries({queryKey: qk.config});
          toast({title: 'Cài đặt vừa thay đổi', description: 'Đã tải bản mới. Kiểm tra lại mục đang chỉnh rồi lưu lại.', tone: 'info'});
        } else toast({title: 'Không lưu được cài đặt', description: e.message, tone: 'error'});
      },
    });
  };
  const {captions: cap, music, video} = cfg;
  const setCap = (p: Partial<Config['captions']>) => setDraft((d) => ({...d, captions: {...d.captions, ...p}}));
  const setMusic = (p: Partial<Config['music']>) => setDraft((d) => ({...d, music: {...d.music, ...p}}));
  const setDef = (p: Partial<Config['defaults']>) => setDraft((d) => ({...d, defaults: {...d.defaults, ...p}}));

  return (
    <>
      <div className={s.cards}>
        {group === 'defaults' ? <section className={s.card} aria-label="Mặc định">
          <h2>Mặc định cho video mới</h2>
          <div className={s.grid2}>
            <div><span className={s.label}>Giọng</span><Select aria-label="Giọng mặc định" value={cfg.defaults.voice} onChange={(v) => setDef({voice: v})} options={opt(voices.data?.map((v) => v.name), cfg.defaults.voice)} /></div>
            <div><span className={s.label}>Mẫu (template)</span><Select aria-label="Mẫu mặc định" value={cfg.defaults.template} onChange={(v) => setDef({template: v})} options={opt(templates.data, cfg.defaults.template)} /></div>
            <div><span className={s.label}>Brand</span><Select aria-label="Brand mặc định" value={cfg.defaults.brand} onChange={(v) => setDef({brand: v})} options={opt(brands.data?.map((b) => b.id), cfg.defaults.brand).map((o) => ({...o, label: brands.data?.find((b) => b.id === o.value)?.brand.name ?? o.label}))} /></div>
            <div>
              <span className={s.label}>Nhạc nền</span>
              <Tooltip content="Chọn nhạc trong từng video"><span tabIndex={0} style={{display: 'block'}}><Select aria-label="Nhạc nền mặc định" disabled value="video" onChange={() => {}} options={[{value: 'video', label: 'Chọn theo video'}]} /></span></Tooltip>
            </div>
          </div>
          <h3>Tỉ lệ nội dung mục tiêu</h3>
          <div className={s.bar} role="img" aria-label={MIX_LABELS.map((l, i) => `${l} ${mix[i]}%`).join(', ')}>
            {mix.map((v, i) => <i key={i} style={{width: `${v}%`, background: MIX_COLORS[i]}} />)}
          </div>
          {MIX_LABELS.map((l, i) => <Prm key={l} label={l} n={mix[i]} min={0} max={100} step={1} value={`${mix[i]}%`} onChange={(v) => setMix(i as 0 | 1 | 2, v)} />)}
        </section> : <section className={s.card} aria-label="Phụ đề, nhạc và video">
          <h2>Phụ đề</h2>
          <Prm label="Cỡ chữ" n={cap.size} min={40} max={96} step={1} value={String(cap.size)} onChange={(v) => setCap({size: v})} />
          <Prm label="Số từ mỗi dòng" n={cap.maxWords} min={2} max={10} step={1} value={String(cap.maxWords)} onChange={(v) => setCap({maxWords: v})} />
          <div className={s.grid2}>
            <div><span className={s.label}>Màu chữ</span><ColorField label="Màu chữ" value={cap.color} onChange={(v) => setCap({color: v})} /></div>
            <div><span className={s.label}>Màu nổi bật</span><ColorField label="Màu nổi bật" value={cap.highlightColor} onChange={(v) => setCap({highlightColor: v})} /></div>
          </div>
          <h2>Nhạc &amp; xuất video</h2>
          <Prm label="Âm lượng nhạc" n={pct(music.volume)} min={0} max={100} step={1} value={`${pct(music.volume)}%`} onChange={(v) => setMusic({volume: v / 100})} />
          <Prm label="Khi có giọng hạ còn" n={pct(music.duckTo)} min={0} max={50} step={1} value={`${pct(music.duckTo)}%`} onChange={(v) => setMusic({duckTo: v / 100})} />
          <Prm label="Fade cuối" n={music.fadeOut} min={0} max={5} step={0.5} value={`${fmtNum(music.fadeOut, 1)} s`} onChange={(v) => setMusic({fadeOut: v})} />
          <div className={s.muted}>Video: {video.width}×{video.height} · {video.fps} fps</div>
        </section>}
      </div>
      <div className={s.saveBar}>
        <Button variant="primary" disabled={!dirty} loading={save.isPending} loadingText="Đang lưu…" onClick={onSave}>{group === 'defaults' ? 'Lưu mặc định' : 'Lưu phụ đề và âm thanh'}</Button>
        {dirty ? <><span className={s.dirty} role="status">Có thay đổi chưa lưu</span><Button variant="ghost" disabled={save.isPending} onClick={() => clear()}>Hoàn tác</Button></> : <span className={s.muted}>Đã lưu</span>}
      </div>
    </>
  );
}
