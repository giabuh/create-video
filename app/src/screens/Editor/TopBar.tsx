import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router';
import {Clapperboard, Film, Mic, MoreVertical, Upload} from 'lucide-react';
import {isLive, useJobs, useWorkerStatus} from '../../api/events.ts';
import {useMusic, useStartRender, useStartVoice, useVoices} from '../../api/hooks.ts';
import {Button, ConfirmDialog, DropdownMenu, IconButton, ProgressBar, Select, fmtPct, toast} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {DeleteProjectDialog} from '../Projects/DeleteProjectDialog.tsx';
import s from './TopBar.module.css';

const NO_MUSIC = 'none'; // track files always have an extension, so no clash

/** "Tạo giọng" state shared by the top bar and the stale banner. */
export function useVoiceAction(): {loading: boolean; label: string; start(): void; disabled: boolean} {
  const {slug, save} = useEditor();
  const jobs = useJobs();
  const worker = useWorkerStatus();
  const mut = useStartVoice(slug);
  const job = jobs.find((j) => j.kind === 'voice' && j.project === slug && isLive(j));
  const busyRender = jobs.some((j) => j.kind === 'render' && j.project === slug && isLive(j));
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
  const {slug, detail, stale, save, storyboard, update} = useEditor();
  const voices = useVoices();
  const music = useMusic();
  const nav = useNavigate();
  const jobs = useJobs();
  const voice = useVoiceAction();
  const startRender = useStartRender(slug);
  const [confirm, setConfirm] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const deleting = !!detail.meta.deleting || jobs.some((j) => j.kind === 'delete-project' && j.project === slug && isLive(j));
  // only a delete job this Editor saw queued/running counts: a stale finished job must not redirect a re-created slug
  const seenDel = useRef(new Set<string>());
  useEffect(() => {
    for (const j of jobs) {
      if (j.kind !== 'delete-project' || j.project !== slug) continue;
      if (isLive(j)) seenDel.current.add(j.id);
      else if (j.state === 'done' && seenDel.current.has(j.id)) void nav('/');
    }
  }, [jobs, slug, nav]);
  const renderJob = jobs.find((j) => j.kind === 'render' && j.project === slug && isLive(j));
  const voiceBusy = voice.loading || deleting;
  const rendering = startRender.isPending || !!renderJob || deleting;

  // this video only: the new voice makes every spoken scene stale, so the next "Tạo giọng"/Render re-synthesizes
  const curVoice = storyboard.voice ?? voices.data?.find((v) => v.isDefault)?.name ?? null;
  const voicePick = (
    <div className={s.voice}><Select aria-label="Giọng đọc của video" value={curVoice} disabled={voiceBusy || rendering}
      options={Array.from(new Set([...(voices.data ?? []).map((v) => v.name), ...(curVoice ? [curVoice] : [])])).map((v) => ({value: v, label: `Giọng: ${v}`}))}
      onChange={(v) => update((sb) => ({...sb, voice: v}))} /></div>
  );
  // no `music` in the storyboard = no music (config.json has no default track)
  const curMusic = storyboard.music?.file ?? NO_MUSIC;
  const musicPick = (
    <div className={s.voice}><Select aria-label="Nhạc nền của video" value={curMusic} disabled={rendering}
      options={[{value: NO_MUSIC, label: 'Nhạc: không'}, ...Array.from(new Set([...(music.data ?? []).map((f) => f.name), ...(curMusic !== NO_MUSIC ? [curMusic] : [])])).map((f) => ({value: f, label: `Nhạc: ${f.replace(/\.[^.]+$/, '')}`}))]}
      onChange={(v) => update((sb) => {
        const {music: old, ...rest} = sb;
        return v === NO_MUSIC ? rest : {...rest, music: {...(old ?? {}), file: v}};
      })} /></div>
  );

  const doRender = () => {
    setConfirm(false);
    void save.flush().then(() => startRender.mutateAsync()).catch((e: unknown) => toast({title: 'Không bắt đầu được render', description: e instanceof Error ? e.message : String(e), tone: 'error'}));
  };
  const ask = () => (stale.length ? setConfirm(true) : doRender());
  const openVersions = () => void nav(`/p/${encodeURIComponent(slug)}/renders`);
  const progress = (startRender.isPending || renderJob) && (
    <div className={s.progress} role="status">
      <span>{renderJob ? (renderJob.state === 'queued' ? 'Đang chờ render' : 'Đang render') : 'Đang gửi yêu cầu render…'}</span>
      <ProgressBar value={renderJob?.progress ?? null} size="sm" label="Tiến độ render" />
      {renderJob?.progress != null && <strong>{fmtPct(renderJob.progress)}</strong>}
    </div>
  );

  return (
    <header className={s.top}>
      <div className={s.identity}>
        <nav className={s.crumb} aria-label="Đường dẫn"><Link to="/">Dự án</Link><span aria-hidden>/</span><b title={slug}>{slug}</b></nav>
      </div>
      <div className={s.compactActions}>
        {voicePick}
        {musicPick}
        <DropdownMenu align="end" trigger={<Button variant="primary" icon={<Upload size={16} aria-hidden />}>Xuất video</Button>} items={[
          {label: 'Render', icon: <Film size={16} aria-hidden />, disabled: voiceBusy || rendering, onSelect: ask},
          {label: `Bản render (${detail.versions.length})`, icon: <Clapperboard size={16} aria-hidden />, onSelect: openVersions},
          'separator',
          {label: voiceBusy ? voice.label : 'Tạo giọng', disabled: voiceBusy || rendering || voice.disabled, onSelect: voice.start},
          'separator',
          {label: 'Xoá dự án', danger: true, onSelect: () => setAskDelete(true)},
        ]} />
      </div>
      <div className={s.actions}>
        <Button icon={<Mic size={16} aria-hidden />} loading={voiceBusy} loadingText={voice.label} disabled={rendering || voice.disabled} onClick={voice.start}>Tạo giọng</Button>
        {voicePick}
        {musicPick}
        <Button icon={<Clapperboard size={16} aria-hidden />} onClick={openVersions}>Bản render ({detail.versions.length})</Button>
        <Button variant="primary" icon={<Film size={16} aria-hidden />} disabled={voiceBusy || rendering} loading={startRender.isPending} onClick={ask}>Render</Button>
        <DropdownMenu align="end" trigger={<IconButton label="Thêm" icon={<MoreVertical size={18} aria-hidden />} />}
          items={[{label: 'Xoá dự án', danger: true, onSelect: () => setAskDelete(true)}]} />
      </div>
      {progress}
      {deleting && <div className={s.banner} role="alert">Dự án đang được xoá</div>}
      {askDelete && <DeleteProjectDialog slug={slug} open={askDelete} onOpenChange={setAskDelete} />}
      <ConfirmDialog open={confirm} onOpenChange={(o) => { if (!o) setConfirm(false); }}
        title="Tạo giọng trước khi render?" description={`Hệ thống sẽ tạo giọng cho ${stale.length} cảnh rồi xuất một bản video mới. Mở Bản render để xem video sau khi hoàn tất.`}
        confirmLabel="Tạo giọng và render" onConfirm={doRender} />
    </header>
  );
}
