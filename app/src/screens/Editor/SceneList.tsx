import {useState} from 'react';
import {ArrowDown, ArrowUp, Copy, GripVertical, MoreHorizontal, Plus, Trash2} from 'lucide-react';
import type {SceneSpec} from '../../../shared/types.ts';
import {useConfig} from '../../api/hooks.ts';
import {Button, Chip, ConfirmDialog, DropdownMenu, IconButton, SortableList, Tooltip, VideoThumb, fmtSec} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {duplicateScene, errorsByScene, removeScene, sceneKind} from './editorState.ts';
import s from './SceneList.module.css';

const KIND = {real: ['Cảnh thật', 'info'], motion: ['Motion', 'accent'], other: ['Khác', 'neutral']} as const;
const TRANSITION = {cut: 'Cắt', fade: 'Mờ dần', slide: 'Trượt'} as const;
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const url = (src: string) => `/library/${src.split('/').map(encodeURIComponent).join('/')}`;

function Thumb({scene, bg}: {scene: SceneSpec; bg: string | undefined}): React.JSX.Element {
  const src = scene.media?.[0]?.src;
  const [broken, setBroken] = useState<string | null>(null);
  if (src && IMAGE.test(src) && broken !== src) return <img className={s.thumb} src={url(src)} alt="" loading="lazy" onError={() => setBroken(src)} />;
  if (src && !IMAGE.test(src)) return <div className={s.thumb}><VideoThumb src={url(src)} label={src} /></div>;
  return <div className={`${s.thumb} ${s.swatch}`} style={{background: bg}}>{scene.motion?.[0]?.component ?? (src ? 'ảnh' : '—')}</div>;
}

export function SceneList(): React.JSX.Element {
  const {storyboard: sb, setStoryboard, selectedId, select, seekToScene, renderProps, stale, errors, addSceneAt} = useEditor();
  const defTransition = useConfig().data?.data.transition?.scene ?? 'cut';
  const [del, setDel] = useState<string | null>(null);
  const errs = errorsByScene(errors, sb.scenes.map((x) => x.id));
  const bg = renderProps?.brand.colors.background;
  const pick = (id: string) => { select(id); seekToScene(id); };
  const moveScene = (from: number, to: number) => {
    const scenes = [...sb.scenes];
    [scenes[from], scenes[to]] = [scenes[to], scenes[from]];
    setStoryboard({...sb, scenes});
  };
  const durOf = (id: string) => renderProps?.scenes.find((x) => x.id === id)?.duration;

  return (
    <section className={s.col} aria-label="Danh sách cảnh">
      <div className={s.head}><b>Cảnh · {sb.scenes.length} + CTA</b><span className={s.hint}>kéo để đổi thứ tự</span></div>
      <div className={s.scroll}>
        <SortableList aria-label="Danh sách cảnh" items={sb.scenes} getId={(x) => x.id} onReorder={(scenes) => setStoryboard({...sb, scenes})}
          renderItem={(sc, h) => {
            const kind = KIND[sceneKind(sc)];
            const dur = durOf(sc.id);
            const err = errs.get(sc.id);
            const i = sb.scenes.indexOf(sc);
            return (
              <div className={s.card} data-selected={selectedId === sc.id || undefined}>
                <button type="button" className={s.grip} aria-label={`Kéo cảnh ${sc.id} để đổi thứ tự`} {...h.handleProps}><GripVertical size={16} aria-hidden /></button>
                <button type="button" className={s.body} aria-current={selectedId === sc.id} onClick={() => pick(sc.id)}>
                  <Thumb scene={sc} bg={bg} />
                  <span className={s.info}>
                    <span className={s.row}>
                      <b>{sc.id}</b>
                      {stale.includes(sc.id) && <Tooltip content="Chưa có giọng"><span className={s.dot} role="img" aria-label="Chưa có giọng" /></Tooltip>}
                      <span className={s.dur}>{dur === undefined ? '—' : fmtSec(dur)}</span>
                    </span>
                    <span className={s.caption}>{sc.caption || sc.say || <i>Chưa có nội dung</i>}</span>
                    <span className={s.row}>
                      <Chip tone={kind[1]}>{kind[0]}</Chip>
                      <span className={s.sceneMeta} title={`${sc.voice ?? sb.voice ?? 'Giọng mặc định'} · ${TRANSITION[sc.transition ?? defTransition]}`}>
                        {sc.voice ?? sb.voice ?? 'Giọng mặc định'} · {TRANSITION[sc.transition ?? defTransition]}
                      </span>
                      {err && <Tooltip content={err.join('\n')}><span><Chip tone="danger">Lỗi</Chip></span></Tooltip>}
                    </span>
                  </span>
                </button>
                <DropdownMenu align="end" trigger={<IconButton label={`Tuỳ chọn cảnh ${sc.id}`} icon={<MoreHorizontal size={18} aria-hidden />} size="sm" />}
                  items={[
                    {label: 'Nhân bản', icon: <Copy size={16} aria-hidden />, onSelect: () => { const r = duplicateScene(sb, sc.id); setStoryboard(r.sb); select(r.id); }},
                    {label: 'Thêm cảnh phía dưới', icon: <Plus size={16} aria-hidden />, onSelect: () => addSceneAt(i)},
                    {label: 'Đưa lên trước', icon: <ArrowUp size={16} aria-hidden />, disabled: i === 0, onSelect: () => moveScene(i, i - 1)},
                    {label: 'Đưa xuống sau', icon: <ArrowDown size={16} aria-hidden />, disabled: i === sb.scenes.length - 1, onSelect: () => moveScene(i, i + 1)},
                    'separator',
                    {label: 'Xoá', icon: <Trash2 size={16} aria-hidden />, danger: true, onSelect: () => setDel(sc.id)},
                  ]} />
              </div>
            );
          }} />
        <button type="button" className={`${s.card} ${s.cta}`} data-selected={selectedId === 'cta' || undefined} aria-current={selectedId === 'cta'} onClick={() => pick('cta')}>
          <span className={s.info}>
            <span className={s.row}><b>CTA</b><Chip>Kết video</Chip><span className={s.dur}>{renderProps?.cta ? fmtSec(renderProps.cta.duration) : sb.cta?.duration ? fmtSec(sb.cta.duration) : '—'}</span></span>
            <span className={s.caption}>{sb.cta?.title ?? <i>Chưa có CTA</i>}</span>
          </span>
        </button>
      </div>
      <Button className={s.add} icon={<Plus size={16} aria-hidden />} onClick={() => addSceneAt(null)}>Thêm cảnh</Button>
      <ConfirmDialog open={del !== null} onOpenChange={(o) => { if (!o) setDel(null); }} danger title={`Xoá cảnh ${del ?? ''}?`}
        description="Cảnh này sẽ bị xoá khỏi storyboard." confirmLabel="Xoá"
        onConfirm={() => { if (del) setStoryboard(removeScene(sb, del)); setDel(null); }} />
    </section>
  );
}
