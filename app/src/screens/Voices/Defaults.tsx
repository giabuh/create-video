import {useState} from 'react';
import {Button, fmtNum, Slider} from '../../ui/index.ts';
import {useConfigEdit} from './useConfigEdit.ts';
import s from './Voices.module.css';

const PARAMS = [
  {k: 'speed', label: 'Tốc độ', min: 0.5, max: 2, step: 0.05, show: (v: number) => `${fmtNum(v, 2)}×`},
  {k: 'temperature', label: 'Temperature', min: 0.1, max: 1.5, step: 0.05, show: (v: number) => fmtNum(v, 2)},
  {k: 'top_k', label: 'top_k', min: 1, max: 100, step: 1, show: (v: number) => fmtNum(v)},
  {k: 'top_p', label: 'top_p', min: 0.5, max: 1, step: 0.01, show: (v: number) => fmtNum(v, 2)},
  {k: 'repetition_penalty', label: 'Chống lặp từ', min: 1, max: 2, step: 0.05, show: (v: number) => fmtNum(v, 2)},
  {k: 'pauseAfter', label: 'Nghỉ sau mỗi câu', min: 0, max: 1.5, step: 0.05, show: (v: number) => `${fmtNum(v, 2)} s`},
] as const;
type Key = typeof PARAMS[number]['k'];

export function DefaultsCard(): React.JSX.Element {
  const {cfg, saving, run} = useConfigEdit();
  const [edited, setEdited] = useState<Partial<Record<Key, number>>>({});
  const [conflict, setConflict] = useState(false);
  const tts = (cfg.data?.data.tts ?? {}) as Record<string, unknown>;
  const val = (k: Key, fallback: number) => edited[k] ?? (typeof tts[k] === 'number' ? tts[k] as number : fallback);
  const dirty = PARAMS.some((p) => edited[p.k] != null && edited[p.k] !== tts[p.k]);
  const save = () => run((c) => ({...c, tts: {...c.tts, ...edited}}), {ok: 'Đã lưu thông số mặc định', onDone: () => { setEdited({}); setConflict(false); }, onConflict: () => setConflict(true)});
  return (
    <aside className={`${s.card} ${s.side}`} aria-label="Thông số mặc định">
      <h2 className={s.h2}>Thông số mặc định</h2>
      <p className={s.note}>Áp cho mọi video mới (config.json). Từng video vẫn chỉnh riêng được.</p>
      {conflict && <div className={s.warn} role="alert">config.json đã đổi ở nơi khác. Giá trị mới đã được tải lại — bấm "Lưu mặc định" để ghi đè bằng thay đổi của bạn, hoặc "Khôi phục".</div>}
      {PARAMS.map((p) => {
        const v = val(p.k, p.min);
        return (
          <div className={s.prm} key={p.k}>
            <span>{p.label}</span>
            <Slider value={v} min={p.min} max={p.max} step={p.step} format={p.show} aria-label={p.label} disabled={!cfg.data}
              onChange={(n) => setEdited((e) => ({...e, [p.k]: Number(n.toFixed(2))}))} />
            <b>{p.show(v)}</b>
          </div>
        );
      })}
      <div className={s.actions}>
        <Button variant="primary" size="sm" loading={saving} loadingText="Đang lưu…" disabled={!dirty || !cfg.data} onClick={save}>Lưu mặc định</Button>
        <Button size="sm" disabled={!dirty && !conflict} onClick={() => { setEdited({}); setConflict(false); }}>Khôi phục</Button>
      </div>
    </aside>
  );
}
