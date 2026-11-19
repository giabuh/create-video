import {useMemo, useState} from 'react';
import {GripVertical, Plus, Trash2, TriangleAlert} from 'lucide-react';
import type {Effect, MediaSpec, MotionSpec, SceneSpec, TransitionName} from '../../../shared/types.ts';
import {useConfig, useLibrary, useVoices} from '../../api/hooks.ts';
import {AudioPlayer, Button, Field, IconButton, Input, NumberField, Segmented, Select, Slider, SortableList, Switch, TagInput, Textarea, Tooltip} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {updateScene} from './editorState.ts';
import {MediaPicker} from './MediaPicker.tsx';
import {MotionLayerEditor} from './MotionLayerEditor.tsx';
import {motionNames} from './motionSchema.ts';
import {useVoiceAction} from './TopBar.tsx';
import s from './Inspector.module.css';

type Section = 'content' | 'media' | 'transition';

const EFFECTS = [{value: 'zoom-in', label: 'Zoom vào'}, {value: 'zoom-out', label: 'Zoom ra'}, {value: 'pan-left', label: 'Lia trái'}, {value: 'pan-right', label: 'Lia phải'}, {value: 'none', label: 'Không'}] as const;
const stem = (n: string) => n.replace(/\.[^.]+$/, '');

function MediaRow({m, onChange, onRemove, handle, missing}: {m: MediaSpec; onChange(p: Partial<MediaSpec>): void; onRemove(): void; handle: React.HTMLAttributes<HTMLElement>; missing: boolean}): React.JSX.Element {
  const [bad, setBad] = useState(false);
  return (
    <div className={s.card}>
      <div className={s.row}>
        <IconButton label="Kéo để đổi thứ tự" icon={<GripVertical size={18} aria-hidden />} {...handle} />
        {bad ? <span className={s.thumb} /> : <img className={s.thumb} src={`/library/thumbs/${encodeURIComponent(stem(m.src))}.jpg`} alt="" onError={() => setBad(true)} />}
        <span className={s.grow} title={m.src}>
          <span className={s.name}>{m.src}</span>
          {missing && <span className={s.warn}>Không có trong thư viện</span>}
        </span>
        <IconButton label={`Bỏ ${m.src}`} icon={<Trash2 size={18} aria-hidden />} onClick={onRemove} />
      </div>
      <div className={s.grid3}>
        <Field label="Từ (giây)"><NumberField value={m.from ?? 0} min={0} step={0.5} onChange={(v) => onChange({from: v ?? undefined})} /></Field>
        <Field label="Dài (giây)"><NumberField value={m.duration ?? null} min={0} step={0.5} onChange={(v) => onChange({duration: v ?? undefined})} /></Field>
        <Field label="Hiệu ứng"><Select<Effect> value={m.effect ?? 'none'} onChange={(effect) => onChange({effect})} options={[...EFFECTS]} /></Field>
      </div>
    </div>
  );
}

export function InspectorScene(): React.JSX.Element {
  const {storyboard: sb, setStoryboard, selectedId, renderProps, stale, layer, selectLayer} = useEditor();
  const voices = useVoices();
  const cfg = useConfig();
  const lib = useLibrary();
  const voiceAction = useVoiceAction();
  const [section, setSection] = useState<Section>('content');
  const [picker, setPicker] = useState(false);
  const [stash, setStash] = useState<Record<string, string>>({}); // say text kept while the switch is off
  const scene = sb.scenes.find((x) => x.id === selectedId);
  const words = useMemo(() => [...new Set((scene?.caption ?? '').split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean))], [scene?.caption]);
  if (!scene) return <p className={s.muted}>Chưa chọn cảnh nào.</p>;

  const up = (p: Partial<SceneSpec>) => setStoryboard(updateScene(sb, scene.id, p));
  const hasSay = scene.say !== undefined;
  const audio = renderProps?.scenes.find((x) => x.id === scene.id)?.voice?.src;
  const media = scene.media ?? [];
  const motion = scene.motion ?? [];
  const setMedia = (next: MediaSpec[]) => up({media: next.length ? next : undefined});
  const setMotion = (next: MotionSpec[]) => up({motion: next.length ? next : undefined});
  const names = motionNames();
  const speedDefault = Number(sb.tts?.speed ?? cfg.data?.data.tts.speed ?? 1);
  const speed = Number(scene.tts?.speed ?? speedDefault);
  const voiceOpts = [{value: '', label: 'Theo video'}, ...(voices.data ?? []).map((v) => ({value: v.name, label: v.name}))];
  const items = media.map((m, i) => ({m, i}));

  return (
    <div className={s.stack}>
      <Segmented<Section> className={s.groups} aria-label="Nhóm chỉnh cảnh" value={section} onChange={setSection} options={[
        {value: 'content', label: 'Nội dung'}, {value: 'media', label: 'Media & Motion'}, {value: 'transition', label: 'Chuyển cảnh'},
      ]} />
      <section className={s.stack} hidden={section !== 'content'} aria-label="Nội dung cảnh">
        {stale.includes(scene.id) && (
          <div className={s.banner} role="status">
            <TriangleAlert size={18} aria-hidden />
            <span className={s.grow}>Lời đọc đã đổi — đang phát giọng cũ.</span>
            <Button size="sm" loading={voiceAction.loading} loadingText={voiceAction.label} disabled={voiceAction.disabled} onClick={voiceAction.start}>Tạo lại giọng</Button>
          </div>
        )}

        <Field label="Caption (hiển thị trên màn hình)"><Textarea autosize rows={2} value={scene.caption ?? ''} onChange={(e) => up({caption: e.target.value})} /></Field>
        <Switch checked={hasSay} onChange={(on) => (on ? up({say: stash[scene.id] ?? '', duration: undefined}) : (setStash({...stash, [scene.id]: scene.say ?? ''}), up({say: undefined, duration: scene.duration ?? 3})))} label="Cảnh có lời đọc" />
        {hasSay
          ? <Field label="Lời đọc (đọc theo cách phát âm)" hint="Viết số, giá, số điện thoại, từ tiếng Anh đúng như cần đọc."><Textarea autosize value={scene.say ?? ''} onChange={(e) => up({say: e.target.value})} /></Field>
          : <Field label="Thời lượng (giây)"><NumberField value={scene.duration ?? null} min={0.5} step={0.5} onChange={(v) => up({duration: v ?? undefined})} /></Field>}
        <details className={s.advanced}>
          <summary>Giọng và từ nổi bật</summary>
          <section className={s.stack}>
            <Field label="Từ nổi bật"><TagInput tone="accent" value={scene.highlight ?? []} suggestions={words} placeholder="Gõ từ trong caption…" onChange={(v) => up({highlight: v.length ? v : undefined})} /></Field>

            {hasSay && (
              <section className={s.stack} aria-label="Giọng">
                <Field label="Giọng"><Select value={scene.voice ?? ''} onChange={(v) => up({voice: v || undefined})} options={voiceOpts} /></Field>
                <Field label={`Tốc độ (${scene.tts?.speed == null ? 'theo video' : 'riêng cảnh'})`}>
                  <Slider aria-label="Tốc độ đọc" min={0.5} max={2} step={0.05} value={speed} format={(v) => `${v.toFixed(2)}×`}
                    onChange={(v) => up({tts: {...scene.tts, speed: v}})} />
                </Field>
                {scene.tts?.speed != null && <Button size="sm" variant="ghost" onClick={() => { const {speed: _, ...rest} = scene.tts ?? {}; up({tts: Object.keys(rest).length ? rest : undefined}); }}>Theo tốc độ video</Button>}
                {audio ? <AudioPlayer src={`/${audio}`} label="Nghe câu này" />
                  : <Tooltip content="Chưa có giọng"><span><Button size="sm" disabled>Nghe câu này</Button></span></Tooltip>}
              </section>
            )}
          </section>
        </details>
      </section>

      <section className={s.stack} hidden={section !== 'media'} aria-label="Media và motion">
        <section className={s.stack} aria-label="Media">
          <h3 className={s.h}>Media</h3>
          {items.length > 0 && (
            <SortableList aria-label="Danh sách media" items={items} getId={(x) => `${x.i}-${x.m.src}`} onReorder={(n) => setMedia(n.map((x) => x.m))}
              renderItem={({m, i}, h) => <MediaRow m={m} handle={h.handleProps} missing={!!lib.data && !(m.src in lib.data.data)}
                onChange={(p) => setMedia(media.map((x, j) => (j === i ? {...x, ...p} : x)))} onRemove={() => setMedia(media.filter((_, j) => j !== i))} />} />
          )}
          <Button icon={<Plus size={16} aria-hidden />} onClick={() => setPicker(true)}>Chọn từ thư viện</Button>
          <MediaPicker open={picker} onOpenChange={setPicker} onAdd={(ns) => setMedia([...media, ...ns.map((src) => ({src}))])} />
        </section>

        <section className={s.stack} aria-label="Lớp motion">
          <h3 className={s.h}>Lớp motion</h3>
          {motion.map((m, i) => (
            <MotionLayerEditor key={i} m={m} scope="scene" spoken={hasSay}
              editing={layer?.scope === 'scene' && layer.sceneId === scene.id && layer.index === i}
              onEdit={() => selectLayer({scope: 'scene', sceneId: scene.id, index: i})}
              onChange={(next) => setMotion(motion.map((x, j) => (j === i ? next : x)))}
              onRemove={() => { setMotion(motion.filter((_, j) => j !== i)); selectLayer(null); }}
              onMove={(d) => { const j = i + d; if (j < 0 || j >= motion.length) return; const n = [...motion]; [n[i], n[j]] = [n[j], n[i]]; setMotion(n); }} />
          ))}
          <p className={s.muted}>Lớp sau vẽ đè lên lớp trước. Bấm biểu tượng ✥ để kéo thả lớp ngay trên khung xem trước.</p>
          <Button icon={<Plus size={16} aria-hidden />} disabled={!names.length} onClick={() => setMotion([...motion, {component: names.includes('Text') ? 'Text' : names[0], props: {}, ...(media.length ? {position: 'center' as const} : {})}])}>Lớp motion</Button>
        </section>

      </section>
      <section className={s.stack} hidden={section !== 'transition'} aria-label="Chữ phủ và chuyển cảnh">
        <Field label="Chữ phủ (tuỳ chọn)"><Input placeholder="VD: [ƯU ĐÃI]" value={scene.overlay?.text ?? ''}
          onChange={(e) => up({overlay: e.target.value ? {text: e.target.value, position: scene.overlay?.position ?? 'bottom'} : undefined})} /></Field>
        <Segmented aria-label="Vị trí chữ phủ" value={scene.overlay?.position ?? 'bottom'} options={[{value: 'top', label: 'Trên', disabled: !scene.overlay}, {value: 'center', label: 'Giữa', disabled: !scene.overlay}, {value: 'bottom', label: 'Dưới', disabled: !scene.overlay}]}
          onChange={(position) => scene.overlay && up({overlay: {...scene.overlay, position}})} />
        <Field label="Chuyển cảnh"><Segmented<TransitionName> aria-label="Chuyển cảnh" value={scene.transition ?? 'cut'} onChange={(t) => up({transition: t === 'cut' ? undefined : t})}
          options={[{value: 'cut', label: 'Cắt'}, {value: 'fade', label: 'Mờ dần'}, {value: 'slide', label: 'Trượt'}]} /></Field>
        <Field label="Nghỉ sau (giây)"><NumberField value={scene.pauseAfter ?? null} min={0} step={0.1} onChange={(v) => up({pauseAfter: v ?? undefined})} /></Field>
      </section>
    </div>
  );
}
