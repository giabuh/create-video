// Editor for one motion layer (scene layer or video-track layer): component + its schema form, then
// timing (seconds or a spoken word), placement (full / band / free box), enter/exit, keyframes, colors.
import {ArrowDown, ArrowUp, Move, Plus, Trash2, X} from 'lucide-react';
import type {AnimName, AnimSpec, BoxSpec, KeyframeSpec, MotionPosition, MotionSpec, SceneSpec, TrackTime, WordRef} from '../../../shared/types.ts';
import {Button, ColorField, Field, IconButton, Input, NumberField, Segmented, Select, Slider} from '../../ui/index.ts';
import {MotionForm} from './MotionForm.tsx';
import {motionDescription, motionNames, motionTitle} from './motionSchema.ts';
import s from './Inspector.module.css';

const ANIMS: {value: AnimName; label: string}[] = [
  {value: 'none', label: 'Không'}, {value: 'fade', label: 'Mờ dần'}, {value: 'slide-up', label: 'Trượt lên'}, {value: 'slide-down', label: 'Trượt xuống'},
  {value: 'slide-left', label: 'Trượt sang trái'}, {value: 'slide-right', label: 'Trượt sang phải'}, {value: 'pop', label: 'Bật nảy'},
  {value: 'zoom', label: 'Thu vào'}, {value: 'wipe', label: 'Quét'}, {value: 'blur', label: 'Hết nhoè'},
];
const POSITIONS: {value: MotionPosition; label: string}[] = [
  {value: 'full', label: 'Toàn khung'}, {value: 'top', label: 'Trên'}, {value: 'center', label: 'Giữa'}, {value: 'bottom', label: 'Dưới'}, {value: 'free', label: 'Tự do'},
];
// same numbers as studio/src/components/MotionLayer.tsx BANDS, in percent
const BAND_BOX: Record<'top' | 'center' | 'bottom', BoxSpec> = {top: {x: 0, y: 9, w: 100, h: 33}, center: {x: 0, y: 30, w: 100, h: 40}, bottom: {x: 0, y: 46, w: 100, h: 26}};
const COLOR_KEYS = [['text', 'Chữ'], ['accent', 'Nhấn'], ['primary', 'Chính'], ['background', 'Nền']] as const;

/** Copy with `patch` applied; undefined values remove keys so storyboard defaults apply. */
export function patchLayer(m: MotionSpec, patch: Partial<MotionSpec>): MotionSpec {
  const n: Record<string, unknown> = {...m, ...patch};
  for (const k of Object.keys(n)) if (n[k] === undefined) delete n[k];
  return n as MotionSpec;
}
/** The box a layer occupies on screen (percent), for handles and for switching a band to a free box. */
export function layerBox(m: MotionSpec): BoxSpec | null {
  const pos = m.position ?? (m.box ? 'free' : 'full');
  if (pos === 'free') return m.box ?? null;
  if (pos === 'full') return null;
  return BAND_BOX[pos];
}

const animType = (a?: AnimSpec): AnimName => (a === undefined ? 'none' : typeof a === 'string' ? a : a.type);
const animDur = (a?: AnimSpec): number | null => (a && typeof a === 'object' && a.duration !== undefined ? a.duration : null);
const word = (w?: WordRef) => (w === undefined ? '' : typeof w === 'string' ? w : w.word);
type WordObj = {word?: string; occurrence?: number; offset?: number};
const wordObj = (w?: WordRef): WordObj => (w === undefined ? {} : typeof w === 'string' ? {word: w} : w);
const mkWord = (base: WordRef | undefined, p: {word?: string; occurrence?: number | null; offset?: number | null}): WordRef | undefined => {
  const o = {...wordObj(base), ...p} as {word?: string; occurrence?: number | null; offset?: number | null};
  if (!o.word) return undefined;
  const occ = o.occurrence ?? 1, off = o.offset ?? 0;
  return occ === 1 && off === 0 ? o.word : {word: o.word, ...(occ !== 1 && {occurrence: occ}), ...(off !== 0 && {offset: off})};
};

function AnimField({label, value, noneIsDefault, onChange}: {label: string; value?: AnimSpec; noneIsDefault: boolean; onChange(v: AnimSpec | undefined): void}): React.JSX.Element {
  const t = animType(value), d = animDur(value);
  return (
    <div className={s.grid2}>
      <Field label={label}><Select value={t} options={ANIMS} onChange={(x) => onChange(x === 'none' && noneIsDefault ? undefined : d !== null ? {type: x, duration: d} : x)} /></Field>
      <Field label="Trong (giây)"><NumberField value={d} min={0.05} max={5} step={0.05} disabled={t === 'none'} onChange={(x) => onChange(x == null ? t : {type: t, duration: x})} /></Field>
    </div>
  );
}

function SceneTiming({m, set, spoken}: {m: MotionSpec; set(p: Partial<MotionSpec>): void; spoken: boolean}): React.JSX.Element {
  const byWord = m.at !== undefined;
  return (
    <div className={s.stack}>
      <Segmented<'sec' | 'word'> size="sm" aria-label="Cách chọn thời điểm" value={byWord ? 'word' : 'sec'}
        options={[{value: 'sec', label: 'Theo giây'}, {value: 'word', label: 'Theo lời đọc', disabled: !spoken}]}
        onChange={(v) => set(v === 'word' ? {at: '', start: undefined} : {at: undefined, until: undefined})} />
      {byWord ? (
        <>
          <div className={s.grid2}>
            <Field label="Bắt đầu ở từ" hint="Từ trong lời đọc hoặc caption, VD: 999K"><Input value={word(m.at)} onChange={(e) => set({at: mkWord(m.at, {word: e.target.value}) ?? ''})} /></Field>
            <Field label="Lần xuất hiện"><NumberField value={wordObj(m.at).occurrence ?? 1} min={1} step={1} onChange={(x) => set({at: mkWord(m.at, {occurrence: x})})} /></Field>
          </div>
          <div className={s.grid2}>
            <Field label="Lệch (giây, âm = sớm hơn)"><NumberField value={wordObj(m.at).offset ?? 0} min={-5} max={5} step={0.05} onChange={(x) => set({at: mkWord(m.at, {offset: x})})} /></Field>
            <Field label="Kết thúc ở từ (tuỳ chọn)"><Input value={word(m.until)} onChange={(e) => set({until: mkWord(m.until, {word: e.target.value})})} /></Field>
          </div>
          {m.until === undefined && <Field label="Dài (giây, trống = hết cảnh)"><NumberField value={m.duration ?? null} min={0.1} step={0.1} onChange={(v) => set({duration: v ?? undefined})} /></Field>}
        </>
      ) : (
        <div className={s.grid2}>
          <Field label="Bắt đầu (giây)"><NumberField value={typeof m.start === 'number' ? m.start : null} min={0} step={0.1} onChange={(v) => set({start: v ?? undefined})} /></Field>
          <Field label="Dài (giây)"><NumberField value={m.duration ?? null} min={0.1} step={0.1} onChange={(v) => set({duration: v ?? undefined})} /></Field>
        </div>
      )}
    </div>
  );
}

type TMode = 'sec' | 'scene' | 'auto' | 'video' | 'dur';
const tmode = (v: TrackTime | number | undefined, isEnd: boolean, m: MotionSpec): TMode =>
  v === undefined ? (isEnd ? (m.duration !== undefined ? 'dur' : 'auto') : 'sec') : v === 'video' ? 'video' : typeof v === 'number' ? 'sec' : 'scene';

function TrackTimeField({label, value, isEnd, m, scenes, onChange, onDuration}: {
  label: string; value: TrackTime | number | undefined; isEnd: boolean; m: MotionSpec; scenes: SceneSpec[];
  onChange(v: TrackTime | undefined): void; onDuration?(v: number | undefined): void;
}): React.JSX.Element {
  const mode = tmode(value, isEnd, m);
  const sc = typeof value === 'object' ? value : null;
  const modes: {value: TMode; label: string}[] = isEnd
    ? [{value: 'auto', label: 'Hết các cảnh'}, {value: 'video', label: 'Hết video (cả CTA)'}, {value: 'dur', label: 'Dài N giây'}, {value: 'sec', label: 'Tại giây'}, {value: 'scene', label: 'Theo cảnh / lời đọc'}]
    : [{value: 'sec', label: 'Tại giây'}, {value: 'scene', label: 'Theo cảnh / lời đọc'}];
  const first = scenes[0]?.id ?? '';
  return (
    <div className={s.stack}>
      <Field label={label}><Select value={mode} options={modes} onChange={(x) => {
        if (x === 'auto') { onChange(undefined); onDuration?.(undefined); }
        else if (x === 'video') { onChange('video'); onDuration?.(undefined); }
        else if (x === 'dur') { onChange(undefined); onDuration?.(3); }
        else if (x === 'sec') { onChange(0); onDuration?.(undefined); }
        else { onChange({scene: first, ...(isEnd && {edge: 'end' as const})}); onDuration?.(undefined); }
      }} /></Field>
      {mode === 'sec' && <NumberField aria-label={`${label} (giây)`} value={typeof value === 'number' ? value : 0} min={0} step={0.1} onChange={(v) => onChange(v ?? 0)} />}
      {mode === 'dur' && <NumberField aria-label="Dài (giây)" value={m.duration ?? 3} min={0.1} step={0.1} onChange={(v) => onDuration?.(v ?? undefined)} />}
      {mode === 'scene' && sc && (
        <>
          <div className={s.grid2}>
            <Field label="Cảnh"><Select value={sc.scene} options={scenes.map((x) => ({value: x.id, label: x.id}))} onChange={(v) => onChange({...sc, scene: v})} /></Field>
            <Field label="Từ trong cảnh (tuỳ chọn)"><Input value={word(sc.at)} onChange={(e) => { const {at: _, ...rest} = sc; onChange(e.target.value ? {...rest, at: e.target.value} : rest); }} /></Field>
          </div>
          <div className={s.grid2}>
            {!sc.at && <Field label="Mốc"><Select value={sc.edge ?? (isEnd ? 'end' : 'start')} options={[{value: 'start', label: 'Đầu cảnh'}, {value: 'end', label: 'Cuối cảnh'}]} onChange={(v) => onChange({...sc, edge: v as 'start' | 'end'})} /></Field>}
            <Field label="Lệch (giây)"><NumberField value={sc.offset ?? 0} min={-30} max={30} step={0.1} onChange={(v) => { const {offset: _, ...rest} = sc; onChange(v ? {...rest, offset: v} : rest); }} /></Field>
          </div>
        </>
      )}
    </div>
  );
}

function Keyframes({value, onChange}: {value: KeyframeSpec[]; onChange(v: KeyframeSpec[] | undefined): void}): React.JSX.Element {
  const keys = ['t', 'x', 'y', 'scale', 'rotate', 'opacity'] as const;
  const label = {t: 'Giây', x: 'X %', y: 'Y %', scale: 'Cỡ', rotate: 'Xoay°', opacity: 'Hiện'};
  const step = {t: 0.1, x: 1, y: 1, scale: 0.05, rotate: 1, opacity: 0.05};
  const put = (i: number, k: typeof keys[number], v: number | null) => onChange(value.map((kf, j) => {
    if (j !== i) return kf;
    const n: Record<string, number> = {...kf};
    if (v == null && k !== 't') delete n[k]; else n[k] = v ?? 0;
    return n as KeyframeSpec;
  }));
  return (
    <div className={s.stack}>
      {value.map((kf, i) => (
        <div key={i} className={s.card}>
          <div className={s.grid3}>
            {keys.map((k) => <Field key={k} label={label[k]}><NumberField value={kf[k] ?? null} step={step[k]} min={k === 't' ? 0 : undefined} onChange={(v) => put(i, k, v)} /></Field>)}
          </div>
          <Button size="sm" variant="ghost" icon={<X size={14} aria-hidden />} onClick={() => onChange(value.length > 1 ? value.filter((_, j) => j !== i) : undefined)}>Xoá keyframe</Button>
        </div>
      ))}
      <Button size="sm" icon={<Plus size={14} aria-hidden />} onClick={() => onChange([...value, value.length ? {t: (value[value.length - 1].t ?? 0) + 1} : {t: 0, x: 0, y: 0}])}>Thêm keyframe</Button>
      <p className={s.muted}>X, Y dịch theo % khung hình; Cỡ, Xoay, Hiện (0–1) nhân với giá trị của lớp. Giữa hai keyframe được nội suy mượt.</p>
    </div>
  );
}

export function MotionLayerEditor({m, onChange, onRemove, onMove, scope, spoken = false, scenes = [], editing, onEdit}: {
  m: MotionSpec; onChange(next: MotionSpec): void; onRemove(): void; onMove?(dir: -1 | 1): void;
  scope: 'scene' | 'track'; spoken?: boolean; scenes?: SceneSpec[]; editing: boolean; onEdit(): void;
}): React.JSX.Element {
  const set = (p: Partial<MotionSpec>) => onChange(patchLayer(m, p));
  const names = motionNames();
  const opts = [...new Set([...names, m.component])].map((n) => ({value: n, label: motionTitle(n)}));
  const pos = m.position ?? (m.box ? 'free' : 'full');
  const box = m.box ?? layerBox(m) ?? {x: 10, y: 30, w: 80, h: 25};
  const setBox = (k: keyof BoxSpec, v: number | null) => set({box: {...box, [k]: v ?? box[k]}});
  return (
    <div className={s.card} aria-current={editing || undefined} style={editing ? {borderColor: 'var(--accent)'} : undefined}>
      <div className={s.row}>
        <span className={s.grow}><Select aria-label="Component motion" value={m.component} options={opts} onChange={(c) => set({component: c, props: {}})} /></span>
        {onMove && <IconButton label="Đưa lớp xuống dưới" icon={<ArrowUp size={16} aria-hidden />} onClick={() => onMove(-1)} />}
        {onMove && <IconButton label="Đưa lớp lên trên" icon={<ArrowDown size={16} aria-hidden />} onClick={() => onMove(1)} />}
        <IconButton label="Chỉnh vị trí trên khung xem trước" icon={<Move size={16} aria-hidden />} onClick={onEdit} />
        <IconButton label="Xoá lớp motion" icon={<Trash2 size={18} aria-hidden />} onClick={onRemove} />
      </div>
      {motionDescription(m.component) && <p className={s.muted}>{motionDescription(m.component)}</p>}
      <MotionForm key={m.component} component={m.component} value={m.props ?? {}} onChange={(props) => set({props})} />

      <details className={s.advanced} open>
        <summary>Thời điểm</summary>
        <section className={s.stack}>
          {scope === 'scene'
            ? <SceneTiming m={m} set={set} spoken={spoken} />
            : <>
              <TrackTimeField label="Bắt đầu" value={m.start} isEnd={false} m={m} scenes={scenes} onChange={(v) => set({start: v})} />
              <TrackTimeField label="Kết thúc" value={m.end} isEnd m={m} scenes={scenes} onChange={(v) => set({end: v})} onDuration={(v) => set({duration: v})} />
            </>}
        </section>
      </details>

      <details className={s.advanced} open={pos !== 'full'}>
        <summary>Vị trí & kích thước</summary>
        <section className={s.stack}>
          <Segmented<MotionPosition> size="sm" aria-label="Vị trí lớp motion" value={pos} options={POSITIONS}
            onChange={(p) => set(p === 'free' ? {position: undefined, box} : {position: p === 'full' ? undefined : p, box: undefined})} />
          {pos === 'free' && (
            <div className={s.grid2}>
              {(['x', 'y', 'w', 'h'] as const).map((k) => (
                <Field key={k} label={{x: 'Trái (%)', y: 'Trên (%)', w: 'Rộng (%)', h: 'Cao (%)'}[k]}>
                  <NumberField value={box[k]} min={k === 'w' || k === 'h' ? 1 : -50} max={k === 'w' || k === 'h' ? 200 : 150} step={0.5} onChange={(v) => setBox(k, v)} />
                </Field>
              ))}
            </div>
          )}
          <div className={s.grid2}>
            <Field label="Cỡ (×)"><NumberField value={m.scale ?? 1} min={0.3} max={2} step={0.05} onChange={(v) => set({scale: v === 1 || v == null ? undefined : v})} /></Field>
            <Field label="Xoay (độ)"><NumberField value={m.rotate ?? 0} min={-360} max={360} step={1} onChange={(v) => set({rotate: v ? v : undefined})} /></Field>
          </div>
          <Field label="Độ hiện"><Slider aria-label="Độ hiện" min={0} max={1} step={0.05} value={m.opacity ?? 1} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({opacity: v === 1 ? undefined : v})} /></Field>
          <Field label="Nền sau lớp"><Select value={m.backdrop ?? 'auto'} onChange={(b) => set({backdrop: b === 'auto' ? undefined : b})}
            options={[{value: 'auto', label: 'Tự động (dải tối khi đè lên video)'}, {value: 'scrim', label: 'Dải tối'}, {value: 'none', label: 'Không'}]} /></Field>
        </section>
      </details>

      <details className={s.advanced}>
        <summary>Hiệu ứng vào / ra</summary>
        <section className={s.stack}>
          <AnimField label="Vào" noneIsDefault value={m.enter} onChange={(v) => set({enter: v})} />
          <AnimField label="Ra" noneIsDefault={false} value={m.exit} onChange={(v) => set({exit: v})} />
          <p className={s.muted}>Áp lên trên chuyển động riêng của component. Ra mặc định: mờ dần khi lớp đặt ở dải/tự do.</p>
        </section>
      </details>

      <details className={s.advanced} open={!!m.keyframes?.length}>
        <summary>Chuyển động theo keyframe</summary>
        <section className={s.stack}><Keyframes value={m.keyframes ?? []} onChange={(v) => set({keyframes: v})} /></section>
      </details>

      <details className={s.advanced} open={!!m.colors}>
        <summary>Màu riêng của lớp</summary>
        <section className={s.stack}>
          {COLOR_KEYS.map(([k, label]) => (
            <div key={k} className={s.row}>
              <span className={s.grow}><Field label={`${label}${m.colors?.[k] ? '' : ' (theo thương hiệu)'}`}>
                <ColorField optional label={label} value={m.colors?.[k] ?? ''} onChange={(v) => set({colors: {...m.colors, [k]: v}})} />
              </Field></span>
              {m.colors?.[k] && <IconButton label={`Bỏ màu ${label} riêng`} icon={<X size={14} aria-hidden />} onClick={() => {
                const {[k]: _, ...rest} = m.colors ?? {};
                set({colors: Object.keys(rest).length ? rest : undefined});
              }} />}
            </div>
          ))}
        </section>
      </details>
    </div>
  );
}
