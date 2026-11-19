// Handles over the Player for the selected motion layer: drag to move, corner to resize (free box).
// A band/full layer shows its area and a button to turn it into a free box. Commits on release (one save).
import {useRef, useState} from 'react';
import {X} from 'lucide-react';
import type {BoxSpec} from '../../../shared/types.ts';
import {IconButton} from '../../ui/index.ts';
import {layerAt, useEditor, withLayer} from './EditorContext.tsx';
import {layerBox, patchLayer} from './MotionLayerEditor.tsx';
import {motionTitle} from './motionSchema.ts';
import s from './BoxOverlay.module.css';

type Drag = {mode: 'move' | 'resize'; x0: number; y0: number; box: BoxSpec};
const snap = (v: number) => Math.round(v * 2) / 2; // 0.5 % steps

export function BoxOverlay(): React.JSX.Element | null {
  const {storyboard, setStoryboard, layer, selectLayer} = useEditor();
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<BoxSpec | null>(null);
  const m = layerAt(storyboard, layer);
  if (!layer || !m) return null;
  const pos = m.position ?? (m.box ? 'free' : 'full');
  const box = live ?? layerBox(m);
  const commit = (b: BoxSpec) => setStoryboard(withLayer(storyboard, layer, patchLayer(m, {position: undefined, box: b})));

  const down = (mode: Drag['mode']) => (e: React.PointerEvent) => {
    if (!box) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({mode, x0: e.clientX, y0: e.clientY, box});
  };
  const move = (e: React.PointerEvent) => {
    if (!drag || !root.current) return;
    const r = root.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.x0) / r.width) * 100, dy = ((e.clientY - drag.y0) / r.height) * 100;
    const b = drag.box;
    setLive(drag.mode === 'move'
      ? {...b, x: snap(b.x + dx), y: snap(b.y + dy)}
      : {...b, w: Math.max(3, snap(b.w + dx)), h: Math.max(3, snap(b.h + dy))});
  };
  const up = () => {
    if (drag && live) commit(live);
    setDrag(null); setLive(null);
  };
  const key = (e: React.KeyboardEvent) => { // arrows move 0.5 %, shift = 5 %; alt = resize
    if (!box || pos !== 'free' || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const d = e.shiftKey ? 5 : 0.5, dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    commit(e.altKey ? {...box, w: Math.max(3, box.w + dx), h: Math.max(3, box.h + dy)} : {...box, x: box.x + dx, y: box.y + dy});
  };

  return (
    <div ref={root} className={s.root} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className={s.tag}>
        <span>{motionTitle(m.component)}{pos === 'free' ? ` · ${box?.x}%, ${box?.y}% · ${box?.w}×${box?.h}%` : ''}</span>
        <IconButton className={s.close} label="Ẩn khung chỉnh" icon={<X size={14} aria-hidden />} onClick={() => selectLayer(null)} />
      </div>
      {box && (
        <div className={`${s.box} ${pos === 'free' ? s.free : s.band}`} tabIndex={0} role="group" onKeyDown={key}
          aria-label={pos === 'free' ? 'Lớp motion: kéo để di chuyển, phím mũi tên để dịch, Alt + mũi tên để đổi cỡ' : 'Vùng của lớp motion'}
          style={{left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`}}
          onPointerDown={down('move')}>
          {pos === 'free'
            ? <span className={s.handle} onPointerDown={down('resize')} aria-hidden />
            : <span className={s.note}>Kéo để chuyển sang vị trí tự do</span>}
        </div>
      )}
      {!box && <div className={s.full}>Lớp toàn khung — chọn “Tự do” hoặc một dải trong “Vị trí & kích thước” để kéo thả</div>}
    </div>
  );
}
