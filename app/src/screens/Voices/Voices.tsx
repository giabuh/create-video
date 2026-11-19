import {useEffect, useState} from 'react';
import {Mic, MoreHorizontal, Plus} from 'lucide-react';
import type {VoiceInfo} from '../../../shared/types.ts';
import {useJobs} from '../../api/events.ts';
import {useUploads} from '../../api/upload.ts';
import {useVoices} from '../../api/hooks.ts';
import {AudioPlayer, Button, Chip, Dialog, DropdownMenu, DropZone, EmptyState, ErrorState, Field, fmtNum, IconButton, Input, PageHeader, ProgressBar, Select, Skeleton} from '../../ui/index.ts';
import {DefaultsCard} from './Defaults.tsx';
import {TryPanel} from './Try.tsx';
import {useConfigEdit} from './useConfigEdit.ts';
import s from './Voices.module.css';

const AUDIO_REF_EXTS = ['.wav', '.mp3', '.m4a', '.ogg', '.flac'];
// Same rule as server/paths.ts slugify (server code cannot be imported here).
const slugify = (x: string) => x.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
const base = (r: string) => r.split('/').pop() ?? r;
const refLabel = (name: string, r: string) => base(r).replace(new RegExp(`^${name}-`), '').replace(/\.\w+$/, '');

function VoiceCard({v}: {v: VoiceInfo}): React.JSX.Element {
  const {saving, run} = useConfigEdit();
  const title = v.name.charAt(0).toUpperCase() + v.name.slice(1);
  return (
    <article className={`${s.card} ${s.vc}`} data-on={v.isDefault || undefined} aria-label={`Giọng ${v.name}`}>
      <div className={s.head}>
        <div className={s.avatar} aria-hidden>{title.charAt(0)}</div>
        <div className={s.grow}>
          <div className={s.name}>{title}</div>
          <div className={s.dim}>{v.ref}{v.seconds != null && ` · ${fmtNum(v.seconds, 1)} s`}</div>
        </div>
        {v.isDefault && <Chip tone="success">Mặc định</Chip>}
        <DropdownMenu align="end" trigger={<IconButton label={`Tuỳ chọn giọng ${v.name}`} icon={<MoreHorizontal size={20} />} />}
          items={[{label: 'Đặt làm mặc định', disabled: v.isDefault || saving, onSelect: () => run((c) => ({...c, defaults: {...c.defaults, voice: v.name}}), {ok: `Đã đặt giọng ${v.name} làm mặc định`})}]} />
      </div>
      <AudioPlayer src={`/${v.ref}`} label={`Giọng mẫu ${v.name}`} accent={v.isDefault ? 'accent' : 'voice'} />
      <div className={s.refRow}>
        <label>Mẫu tham chiếu</label>
        <Select size="sm" aria-label={`Mẫu tham chiếu ${v.name}`} value={v.ref} disabled={saving}
          options={(v.refs.includes(v.ref) ? v.refs : [v.ref, ...v.refs]).map((r) => ({value: r, label: refLabel(v.name, r)}))}
          onChange={(r) => run((c) => ({...c, voices: {...c.voices, [v.name]: {...c.voices[v.name], ref: r}}}), {ok: `Đã đổi mẫu của giọng ${v.name}`})} />
      </div>
    </article>
  );
}

function AddVoice({open, onClose}: {open: boolean; onClose(): void}): React.JSX.Element {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const {items, upload} = useUploads();
  const jobs = useJobs();
  const slug = slugify(name);
  const [sentAt, setSentAt] = useState(0);
  const item = [...items].reverse().find((i) => i.target === 'voice' && i.file === file);
  const job = jobs.find((j) => j.kind === 'voice-add' && j.label === `Thêm giọng ${slug}` && (j.startedAt ?? Date.now()) >= sentAt - 5000);
  const busy = item?.state === 'uploading' || job?.state === 'queued' || job?.state === 'running';
  const err = item?.state === 'error' ? item.error : job?.state === 'failed' ? job.error ?? 'Thêm giọng thất bại' : null;
  useEffect(() => { if (job?.state === 'done' && open) { onClose(); setName(''); setFile(null); } }, [job?.state, open, onClose]);
  const go = () => { if (file && name.trim()) { setSentAt(Date.now()); void upload([file], 'voice', {voiceName: slug}); } };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }} title="Thêm giọng" description="Chọn một đoạn thu rõ tiếng, dài 6–10 giây, không nhạc nền."
      footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Huỷ</Button><Button variant="primary" loading={busy} loadingText="Đang thêm…" disabled={!file || !name.trim()} onClick={go}>Thêm giọng</Button></>}>
      <div className={s.page} style={{gap: 'var(--sp-4)'}}>
        <Field label="Tên giọng" hint={name.trim() ? `Sẽ lưu là: ${slug}` : 'Ví dụ: Phương, Vy'} error={err ?? undefined}>
          <Input value={name} disabled={busy} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <DropZone accept={AUDIO_REF_EXTS} multiple={false} compact title={file ? file.name : 'Kéo thả file ghi âm vào đây'} description=".wav, .mp3, .m4a, .ogg, .flac" buttonLabel={file ? 'Chọn file khác' : 'Chọn file'} onFiles={(f) => setFile(f[0])} />
        {item?.state === 'uploading' && <ProgressBar value={item.progress} label="Đang tải lên" />}
        {job && (job.state === 'queued' || job.state === 'running') && <ProgressBar value={job.progress} label={job.step || 'Đang xử lý'} />}
        {busy && <p className={s.note}>{job ? job.step || 'Đang chuyển định dạng…' : 'Đang tải lên…'}</p>}
      </div>
    </Dialog>
  );
}

export function VoicesScreen(): React.JSX.Element {
  const voices = useVoices();
  const [adding, setAdding] = useState(false);
  const list = voices.data ?? [];
  const onClose = () => setAdding(false);
  return (
    <div className={s.page}>
      <PageHeader title="Giọng đọc" subtitle="Nghe thử nhiều cách đọc cùng một câu, chọn cái hay nhất rồi lưu làm mặc định."
        actions={<Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>Thêm giọng (mẫu 6–10 s)</Button>} />
      {voices.isError ? <ErrorState title="Không tải được danh sách giọng" error={voices.error} onRetry={() => void voices.refetch()} />
        : voices.isLoading ? <div className={s.skel}>{[0, 1].map((i) => <Skeleton key={i} height={190} />)}</div>
        : !list.length ? <EmptyState icon={<Mic size={28} />} title="Chưa có giọng nào" description="Thêm một giọng từ mẫu ghi âm 6–10 giây." action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Thêm giọng</Button>} />
        : (
          <>
            <div className={s.cards}>{list.map((v) => <VoiceCard key={v.name} v={v} />)}</div>
            <div className={s.wrap}><TryPanel voices={list} /><DefaultsCard /></div>
          </>
        )}
      <AddVoice open={adding} onClose={onClose} />
    </div>
  );
}
