import {useCallback, useEffect, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router';
import {Film} from 'lucide-react';
import type {VersionInfo} from '../../../shared/types.ts';
import {useJobs} from '../../api/events.ts';
import {useCancelJob, useApprove, useOpenFolder, useProject, useStartRender} from '../../api/hooks.ts';
import {Button, Chip, ConfirmDialog, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, fmtPct, toast} from '../../ui/index.ts';
import {VersionCard} from './VersionCard.tsx';
import s from './Renders.module.css';

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function RendersScreen(): React.JSX.Element {
  const slug = useParams().slug ?? '';
  const nav = useNavigate();
  const project = useProject(slug);
  const approve = useApprove(slug);
  const open = useOpenFolder();
  const start = useStartRender(slug);
  const cancel = useCancelJob();
  const job = useJobs().find((j) => j.kind === 'render' && j.project === slug && (j.state === 'running' || j.state === 'queued'));
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const register = useCallback((name: string, el: HTMLVideoElement | null) => { if (el) videos.current.set(name, el); else videos.current.delete(name); }, []);
  const [confirm, setConfirm] = useState<VersionInfo | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!job) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [job]);

  const versions = [...(project.data?.versions ?? [])].sort((a, b) => b.n - a.n);
  const playAll = () => videos.current.forEach((el) => { el.currentTime = 0; void el.play().catch(() => {}); });
  const render = () => start.mutate(undefined, {onError: (e) => toast({title: 'Không bắt đầu được render', description: e.message, tone: 'error'})});
  const doApprove = () => {
    if (!confirm) return;
    approve.mutate(confirm.name, {
      onSuccess: (r) => { toast({title: `Đã duyệt ${confirm.name}`, description: r.commit ? `Commit ${r.commit}` : 'Không có thay đổi để commit', tone: 'success'}); setConfirm(null); },
      onError: (e) => { toast({title: 'Không duyệt được', description: e.message, tone: 'error'}); setConfirm(null); },
    });
  };

  const crumb = <span className={s.crumb}><Link to="/">Dự án</Link> / <Link to={`/p/${encodeURIComponent(slug)}`}>{slug}</Link> / Bản render</span>;
  const header = (
    <PageHeader title="Bản render" subtitle={<>{crumb} · Mỗi lần render tạo bản mới, không bao giờ ghi đè.</>}
      actions={<>
        <Button onClick={() => nav(`/p/${encodeURIComponent(slug)}`)}>← Về trình sửa</Button>
        <Button disabled={versions.length < 2} onClick={playAll}>Phát đồng thời</Button>
      </>} />
  );

  let body: React.JSX.Element;
  if (project.isPending) {
    body = <div className={s.grid}>{[0, 1, 2].map((i) => <div key={i} className={s.card}><Skeleton height={24} width="50%" /><Skeleton height={320} radius={10} /><Skeleton height={80} /><Skeleton height={34} /></div>)}</div>;
  } else if (project.isError) {
    body = <ErrorState error={project.error} onRetry={() => void project.refetch()} />;
  } else if (versions.length === 0) {
    body = <EmptyState icon={<Film size={28} />} title="Chưa có bản render" description="Render một bản nháp để xem thử video."
      action={<Button variant="primary" loading={start.isPending || !!job} loadingText="Đang render…" onClick={render}>Render nháp</Button>} />;
  } else {
    body = <div className={s.grid}>{versions.map((v) => <VersionCard key={v.name} v={v} register={register} onApprove={() => setConfirm(v)} onOpenFolder={() => open.mutate(`projects/${slug}`, {onError: (e) => toast({title: 'Không mở được thư mục', description: e.message, tone: 'error'})})} />)}</div>;
  }

  const elapsed = job?.startedAt ? (now - job.startedAt) / 1000 : 0;
  return (
    <div className={s.page}>
      {header}
      <div className={s.layout}>
        {body}
        <aside className={s.side}>
          {job ? (
            <section className={s.card}>
              <div className={s.row}><b>{job.label}</b><Chip tone="info">{job.state === 'queued' ? 'Đang chờ' : 'Đang render'}</Chip>{job.progress != null && <span className={s.pct}>{fmtPct(job.progress)}</span>}</div>
              <ProgressBar value={job.progress} tone="info" label="Tiến độ render" />
              <div className={s.hint}>{[job.step, job.startedAt && `đã ${mmss(elapsed)}`, job.etaSeconds != null && `còn ~${mmss(job.etaSeconds)}`].filter(Boolean).join(' · ')}</div>
              {job.cancellable && <Button size="sm" onClick={() => cancel.mutate(job.id)} loading={cancel.isPending}>Huỷ</Button>}
            </section>
          ) : (
            <section className={s.card}>
              <b>“Duyệt bản này” làm gì?</b>
              <p className={s.muted}>Đánh dấu bản đã chốt và lưu storyboard của bản đó vào git, để sau này dựng lại đúng y như vậy. File video vẫn nằm trong thư mục dự án và được đồng bộ lên Drive.</p>
            </section>
          )}
        </aside>
      </div>
      <ConfirmDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }} loading={approve.isPending}
        title={`Duyệt ${confirm?.name ?? ''}?`} confirmLabel="Duyệt bản này" onConfirm={doApprove}
        description={confirm?.hasSnapshot === false
          ? 'Bản này không có snapshot storyboard, nên chỉ ghi nhận việc duyệt, không lưu storyboard vào git.'
          : 'Đánh dấu bản này là bản đã chốt và lưu snapshot storyboard của nó vào git để sau này dựng lại đúng như vậy.'} />
    </div>
  );
}
