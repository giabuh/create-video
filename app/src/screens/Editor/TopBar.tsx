import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router';
import {Clapperboard, Mic, MoreVertical, Upload} from 'lucide-react';
import type {Job} from '../../../shared/types.ts';
import {useJobs, useWorkerStatus} from '../../api/events.ts';
import {useStartRender, useStartVoice} from '../../api/hooks.ts';
import {Button, ConfirmDialog, DropdownMenu, IconButton, ProgressBar, fmtPct, toast} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {DeleteProjectDialog} from '../Projects/DeleteProjectDialog.tsx';
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

export function TopBar(): React.JSX.Element {
  const {slug, detail, stale, save} = useEditor();
  const nav = useNavigate();
  const jobs = useJobs();
  const voice = useVoiceAction();
  const startRender = useStartRender(slug);
  const [confirm, setConfirm] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const deleting = !!detail.meta.deleting || jobs.some((j) => j.kind === 'delete-project' && j.project === slug && ACTIVE(j));
  // only a delete job this Editor saw queued/running counts: a stale finished job must not redirect a re-created slug
  const seenDel = useRef(new Set<string>());
  useEffect(() => {
    for (const j of jobs) {
      if (j.kind !== 'delete-project' || j.project !== slug) continue;
      if (ACTIVE(j)) seenDel.current.add(j.id);
      else if (j.state === 'done' && seenDel.current.has(j.id)) void nav('/');
    }
  }, [jobs, slug, nav]);
  const renderJob = jobs.find((j) => j.kind === 'render' && j.project === slug && ACTIVE(j));
  const voiceBusy = voice.loading || deleting;
  const rendering = startRender.isPending || !!renderJob || deleting;

  const doRender = () => {
    setConfirm(false);
    void save.flush().then(() => startRender.mutateAsync()).catch((e: unknown) => toast({title: 'Không bắt đầu được render', description: e instanceof Error ? e.message : String(e), tone: 'error'}));
  };
  const ask = () => (stale.length ? setConfirm(true) : doRender());
  const openVersions = () => void nav(`/p/${encodeURIComponent(slug)}/renders`);
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
      </div>
      <div className={s.compactActions}>
        <DropdownMenu align="end" trigger={<Button variant="primary" icon={<Upload size={16} aria-hidden />}>Xuất video</Button>} items={[
          {label: 'Render', disabled: voiceBusy || rendering, onSelect: ask},
          {label: `Bản render (${detail.versions.length})`, onSelect: openVersions},
          'separator',
          {label: voiceBusy ? voice.label : 'Tạo giọng', disabled: voiceBusy || rendering || voice.disabled, onSelect: voice.start},
          'separator',
          {label: 'Xoá dự án', danger: true, onSelect: () => setAskDelete(true)},
        ]} />
      </div>
      {progress}
      {deleting && <div className={s.banner} role="alert">Dự án đang được xoá</div>}
      <div className={s.actions}>
        <Button icon={<Clapperboard size={16} aria-hidden />} onClick={openVersions}>Bản render ({detail.versions.length})</Button>
        <Button icon={<Mic size={16} aria-hidden />} loading={voiceBusy} loadingText={voice.label} disabled={rendering || voice.disabled} onClick={voice.start}>Tạo giọng</Button>
        <Button variant="primary" disabled={voiceBusy || rendering} loading={startRender.isPending} onClick={ask}>Render</Button>
        <DropdownMenu align="end" trigger={<IconButton label="Thêm" icon={<MoreVertical size={18} aria-hidden />} />}
          items={[{label: 'Xoá dự án', danger: true, onSelect: () => setAskDelete(true)}]} />
      </div>
      {askDelete && <DeleteProjectDialog slug={slug} open={askDelete} onOpenChange={setAskDelete} />}
      <ConfirmDialog open={confirm} onOpenChange={(o) => { if (!o) setConfirm(false); }}
        title="Cần tạo giọng trước" description={`Cần tạo giọng cho ${stale.join(', ')} trước. Render sẽ tự tạo giọng rồi mới render.`}
        confirmLabel="Tạo giọng và render" onConfirm={doRender} />
    </header>
  );
}
