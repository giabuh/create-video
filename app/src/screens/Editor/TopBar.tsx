import {useState} from 'react';
import {Link, useNavigate} from 'react-router';
import {ChartPie, Clapperboard, MessageSquare, Mic, Upload} from 'lucide-react';
import type {Job} from '../../../shared/types.ts';
import {useJobs, useWorkerStatus} from '../../api/events.ts';
import {useStartRender, useStartVoice} from '../../api/hooks.ts';
import {setChatOpen} from '../../api/chat.ts';
import {Button, ConfirmDialog, DropdownMenu, IconButton, Popover, ProgressBar, Spinner, fmtPct, toast} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {mixOf} from './editorState.ts';
import {MixMeter} from './MixMeter.tsx';
import s from './TopBar.module.css';

const ACTIVE = (j: Job) => j.state === 'queued' || j.state === 'running';

/** "Tạo giọng" state shared by the top bar and the stale banner. */
export function useVoiceAction(): {loading: boolean; label: string; start(): void; disabled: boolean} {
  const {slug, save} = useEditor();
  const jobs = useJobs();
  const worker = useWorkerStatus();
  const mut = useStartVoice(slug);
  const job = jobs.find((j) => j.kind === 'voice' && j.project === slug && ACTIVE(j));
  const busyRender = jobs.some((j) => j.kind === 'render' && j.project === slug && ACTIVE(j));
  const loading = mut.isPending || !!job;
  const warm = worker.state !== 'ready' && (job?.progress ?? null) === null;
  const count = /\d+\s*\/\s*\d+/.exec(job?.step ?? '')?.[0].replace(/\s/g, '');
  const label = warm ? 'Đang nạp model giọng…' : `Đang tạo giọng…${count ? ` ${count}` : ''}`;
  const start = () => {
    void save.flush().then(() => mut.mutateAsync()).catch((e: unknown) => toast({title: 'Không tạo được giọng', description: e instanceof Error ? e.message : String(e), tone: 'error'}));
  };
  return {loading, label, start, disabled: busyRender};
}

function SavePill(): React.JSX.Element {
  const {save} = useEditor();
  if (save.state === 'error') return <Button size="sm" variant="danger" onClick={() => void save.retry()} title={save.error ?? undefined}>Lỗi lưu — Thử lại</Button>;
  if (save.state === 'saving') return <span className={s.pill} role="status"><Spinner size={14} /> Đang lưu…</span>;
  const at = save.savedAt ? new Date(save.savedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}) : null;
  return <span className={`${s.pill} ${s.ok}`} role="status">Đã lưu{at ? ` ${at}` : ''}</span>;
}

export function TopBar(): React.JSX.Element {
  const {slug, detail, renderProps, stale, save} = useEditor();
  const nav = useNavigate();
  const jobs = useJobs();
  const voice = useVoiceAction();
  const startRender = useStartRender(slug);
  const [confirm, setConfirm] = useState<'draft' | 'final' | null>(null);
  const renderJob = jobs.find((j) => j.kind === 'render' && j.project === slug && ACTIVE(j));
  const voiceBusy = voice.loading;
  const rendering = startRender.isPending || !!renderJob;

  const doRender = (kind: 'draft' | 'final') => {
    setConfirm(null);
    void save.flush().then(() => startRender.mutateAsync(kind)).catch((e: unknown) => toast({title: 'Không bắt đầu được render', description: e instanceof Error ? e.message : String(e), tone: 'error'}));
  };
  const ask = (kind: 'draft' | 'final') => (stale.length ? setConfirm(kind) : doRender(kind));
  const openVersions = () => void nav(`/p/${encodeURIComponent(slug)}/renders`);
  const mix = renderProps ? mixOf(renderProps) : (detail.timings?.mix ?? null);
  const progress = rendering && (
    <div className={s.progress} role="status">
      <ProgressBar value={renderJob?.progress ?? null} tone="info" size="sm" label="Tiến độ render" />
      <span>{renderJob?.progress != null ? fmtPct(renderJob.progress) : 'Đang chờ…'}</span>
    </div>
  );

  return (
    <header className={s.top}>
      <div className={s.identity}>
        <nav className={s.crumb} aria-label="Đường dẫn"><Link to="/">Dự án</Link><span aria-hidden>/</span><b title={slug}>{slug}</b></nav>
        <SavePill />
      </div>
      <div className={s.mixWrap}><MixMeter actual={mix} target={detail.mixTarget} /></div>
      <div className={s.mixMenu}>
        <Popover align="end" trigger={<IconButton label="Tỉ lệ nội dung" icon={<ChartPie size={18} aria-hidden />} />}>
          <MixMeter actual={mix} target={detail.mixTarget} />
        </Popover>
      </div>
      <div className={s.compactActions}>
        <DropdownMenu align="end" trigger={<Button variant="primary" icon={<Upload size={16} aria-hidden />}>Xuất video</Button>} items={[
          {label: 'Render nháp', disabled: voiceBusy || rendering, onSelect: () => ask('draft')},
          {label: 'Render cuối', disabled: voiceBusy || rendering, onSelect: () => ask('final')},
          {label: `Bản render (${detail.versions.length})`, onSelect: openVersions},
          'separator',
          {label: voiceBusy ? voice.label : 'Tạo giọng', disabled: voiceBusy || rendering || voice.disabled, onSelect: voice.start},
        ]} />
      </div>
      {progress}
      <div className={s.actions}>
        <Button icon={<Clapperboard size={16} aria-hidden />} onClick={openVersions}>Bản render ({detail.versions.length})</Button>
        <Button icon={<Mic size={16} aria-hidden />} loading={voiceBusy} loadingText={voice.label} disabled={rendering || voice.disabled} onClick={voice.start}>Tạo giọng</Button>
        <Button disabled={voiceBusy || rendering} loading={startRender.isPending && startRender.variables === 'draft'} onClick={() => ask('draft')}>Render nháp</Button>
        <Button variant="primary" disabled={voiceBusy || rendering} loading={startRender.isPending && startRender.variables === 'final'} onClick={() => ask('final')}>Render final</Button>
        <Button icon={<MessageSquare size={16} aria-hidden />} onClick={() => setChatOpen(true)}>Chat</Button>
      </div>
      <ConfirmDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title="Cần tạo giọng trước" description={`Cần tạo giọng cho ${stale.join(', ')} trước. Render sẽ tự tạo giọng rồi mới render.`}
        confirmLabel="Tạo giọng và render" onConfirm={() => confirm && doRender(confirm)} />
    </header>
  );
}
