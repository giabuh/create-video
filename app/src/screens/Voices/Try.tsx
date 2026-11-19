import {useEffect, useRef, useState} from 'react';
import {Plus, Trash2, AudioLines} from 'lucide-react';
import type {Json, TryVariant, VoiceInfo} from '../../../shared/types.ts';
import {useJobs} from '../../api/events.ts';
import {useStartTry, useTries} from '../../api/hooks.ts';
import {AudioPlayer, Button, ConfirmDialog, EmptyState, Field, fmtNum, IconButton, Input, NumberField, ProgressBar, Select, toast} from '../../ui/index.ts';
import {useConfigEdit} from './useConfigEdit.ts';
import s from './Voices.module.css';

type Row = {speed: number | null; temperature: number | null; top_k: number | null; ref: string};
const LETTERS = 'ABCDEF';
const MAX = 6;
const base = (r: string) => r.split('/').pop() ?? r;
const refLabel = (name: string, r: string) => base(r).replace(new RegExp(`^${name}-`), '').replace(/\.\w+$/, '');
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);

export function TryPanel({voices}: {voices: VoiceInfo[]}): React.JSX.Element {
  const {cfg, saving, run} = useConfigEdit();
  const tries = useTries();
  const start = useStartTry();
  const jobs = useJobs();
  const [text, setText] = useState('Lớp học sôi động mỗi ngày, đăng ký ngay hôm nay.');
  const [voice, setVoice] = useState<string | null>(null);
  const cur = voices.find((v) => v.name === (voice ?? voices.find((x) => x.isDefault)?.name ?? voices[0]?.name));
  const tts = (cfg.data?.data.tts ?? {}) as Record<string, unknown>;
  const mk = (patch: Partial<Row> = {}): Row => ({speed: num(tts.speed, 1), temperature: num(tts.temperature, 0.8), top_k: num(tts.top_k, 25), ref: cur?.ref ?? '', ...patch});
  const [rows, setRows] = useState<Row[] | null>(null);
  const list = rows ?? [mk(), mk({speed: Math.min(2, num(tts.speed, 1) + 0.05)}), mk({temperature: 0.6})];
  const setRow = (i: number, p: Partial<Row>) => setRows(list.map((r, j) => (j === i ? {...r, ...p} : r)));
  const [pick, setPick] = useState<{k: string; v: TryVariant} | null>(null);
  const total = useRef(0);

  const running = jobs.find((j) => j.kind === 'try' && (j.state === 'queued' || j.state === 'running'));
  const wasRunning = useRef(false);
  useEffect(() => { // refetch when a try job ends: don't rely only on the file-watcher event
    if (wasRunning.current && !running) void tries.refetch();
    wasRunning.current = !!running;
  }, [running, tries]);
  const letter = running?.step.match(/\b([A-F])\b/)?.[1];
  const label = !running ? '' : running.state === 'queued' ? 'Đang chờ lượt…'
    : letter ? `Đang tạo bản ${letter}… ${LETTERS.indexOf(letter) + 1}/${total.current || list.length}` : running.step || 'Đang nạp model giọng… (~10 giây)';
  const bad = !text.trim() || !cur || list.some((r) => r.speed == null || r.temperature == null || r.top_k == null);

  const submit = () => {
    if (!cur) return;
    total.current = list.length;
    start.mutate({voice: cur.name, text, variants: list.map((r): Json => ({speed: r.speed, temperature: r.temperature, top_k: r.top_k, ref: r.ref}))},
      {onError: (e) => toast({title: 'Không tạo được bản thử', description: e.message, tone: 'error'})});
  };
  const t = tries.data;
  const stamp = tries.dataUpdatedAt;
  const apply = () => {
    if (!pick || !t) return;
    run((c) => ({...c, tts: {...c.tts, ...pick.v.tts}, voices: {...c.voices, [t.voice]: {...c.voices[t.voice], ref: pick.v.ref}}}),
      {ok: `Đã lưu bản ${pick.k} làm mặc định`, onDone: () => setPick(null), onConflict: () => setPick(null)});
  };

  return (
    <section className={`${s.card} ${s.try}`} aria-label="Nghe thử">
      <h2 className={s.h2}>Nghe thử</h2>
      <div className={s.row}>
        <div style={{flex: '3 1 320px'}}><Field label="Câu thử (viết theo cách đọc)"><Input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} /></Field></div>
        <div style={{flex: '1 1 160px'}}>
          <Field label="Giọng"><Select value={cur?.name ?? null} options={voices.map((v) => ({value: v.name, label: v.name}))}
            onChange={(v) => { setVoice(v); setRows(null); }} /></Field>
        </div>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <colgroup><col style={{width: 56}} /><col /><col /><col /><col style={{width: 140}} /><col style={{width: 52}} /></colgroup>
          <thead><tr><th>Bản</th><th>Tốc độ</th><th>Temperature</th><th>top_k</th><th>Mẫu</th><th><span className="sr-only">Xoá</span></th></tr></thead>
          <tbody>
            {list.map((r, i) => {
              const L = LETTERS[i];
              return (
                <tr key={i}>
                  <td><span className={s.letter}>{L}</span></td>
                  <td><NumberField value={r.speed} min={0.5} max={2} step={0.05} decimals={2} aria-label={`Tốc độ ${L}`} onChange={(v) => setRow(i, {speed: v})} /></td>
                  <td><NumberField value={r.temperature} min={0.1} max={1.5} step={0.05} decimals={2} aria-label={`Temperature ${L}`} onChange={(v) => setRow(i, {temperature: v})} /></td>
                  <td><NumberField value={r.top_k} min={1} max={100} step={1} decimals={0} aria-label={`top_k ${L}`} onChange={(v) => setRow(i, {top_k: v})} /></td>
                  <td><Select size="sm" aria-label={`Mẫu ${L}`} value={r.ref || null} options={(cur?.refs ?? []).map((x) => ({value: x, label: refLabel(cur?.name ?? '', x)}))} onChange={(v) => setRow(i, {ref: v})} /></td>
                  <td>{list.length > 1 && <IconButton label={`Xoá bản ${L}`} icon={<Trash2 size={18} />} size="sm" onClick={() => setRows(list.filter((_, j) => j !== i))} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={s.actions}>
        <Button size="sm" icon={<Plus size={16} />} disabled={list.length >= MAX} onClick={() => setRows([...list, mk()])}>Thêm bản</Button>
        <Button className={s.spacer} variant="primary" icon={<AudioLines size={16} />} loading={!!running || start.isPending} loadingText={label || 'Đang gửi…'}
          disabled={bad} onClick={submit}>{`Tạo ${list.length} bản · ~${list.length * 2} giây`}</Button>
      </div>
      {running && <ProgressBar value={running.progress} size="sm" label="Tiến độ tạo bản thử" />}
      {tries.isError ? <p className={s.warn} role="alert">Không tải được kết quả thử. <Button size="sm" onClick={() => void tries.refetch()}>Thử lại</Button></p>
        : !t || !Object.keys(t.variants).length ? (tries.isLoading ? null : <EmptyState icon={<AudioLines size={28} />} title="Chưa có bản thử nào" description="Chỉnh thông số rồi bấm “Tạo bản” để nghe thử." />)
        : (
          <div className={s.results} aria-label="Kết quả">
            <p className={s.note}>Giọng {t.voice} · “{t.text}”</p>
            {Object.entries(t.variants).map(([k, v]) => (
              <div className={s.res} key={k}>
                <span className={s.letter}>{k}</span>
                <div className={s.player}><AudioPlayer src={`/${v.file}?v=${stamp}`} label={`Bản ${k}`} compact accent="voice" /></div>
                <span className={s.sec}>{fmtNum(v.seconds, 2)} s</span>
                <Button onClick={() => setPick({k, v})}>Lưu làm mặc định</Button>
              </div>
            ))}
          </div>
        )}
      <ConfirmDialog open={!!pick} onOpenChange={(o) => { if (!o) setPick(null); }} loading={saving} confirmLabel="Lưu làm mặc định"
        title={`Lưu bản ${pick?.k ?? ''} làm mặc định?`}
        description={pick ? `Ghi vào config.json: ${Object.entries(pick.v.tts).filter(([k]) => ['speed', 'temperature', 'top_k', 'top_p', 'repetition_penalty'].includes(k)).map(([k, v]) => `${k} = ${typeof v === 'number' ? fmtNum(v, 2) : String(v)}`).join(', ')}; mẫu của giọng ${t?.voice} = ${base(pick.v.ref)}. Thông số nghỉ (pauseAfter) được giữ nguyên.` : ''}
        onConfirm={apply} />
    </section>
  );
}
