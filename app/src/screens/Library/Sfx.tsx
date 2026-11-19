import {useState} from 'react';
import {Trash2, Volume2} from 'lucide-react';
import {useDeleteSfx, useSfx} from '../../api/hooks.ts';
import {useUploads} from '../../api/upload.ts';
import {AudioPlayer, ConfirmDialog, DropZone, IconButton, toast, EmptyState, ErrorState, Skeleton, fmtBytes} from '../../ui/index.ts';
import {MUSIC_EXTS} from './exts.ts';
import {UploadRows} from './Uploads.tsx';
import s from './Library.module.css';

export const GROUPS: [string, string][] = [
  ['whoosh', 'Chuyển cảnh (whoosh)'], ['impact', 'Nhấn mạnh (impact)'], ['ting', 'Ting / chuông'],
  ['sparkle', 'Lấp lánh'], ['pop', 'Pop (bật lên)'], ['click', 'Click'],
];
const groupOf = (name: string) => GROUPS.find(([k]) => name.startsWith(`${k}-`))?.[0] ?? 'other';

export function SfxTab(): React.JSX.Element {
  const {upload} = useUploads();
  const q = useSfx();
  const del = useDeleteSfx();
  const [pending, setPending] = useState<string | null>(null);
  const sections = [...GROUPS, ['other', 'Khác'] as [string, string]]
    .map(([k, label]) => ({label, files: (q.data ?? []).filter((m) => groupOf(m.name) === k)})).filter((g) => g.files.length);
  return (
    <div className={s.stack}>
      <DropZone accept={MUSIC_EXTS} title="Kéo-thả hiệu ứng âm thanh vào đây" description="MP3, M4A, WAV, OGG, AAC. Đặt tên dạng nhóm-tên (vd whoosh-nhanh.mp3). File lưu vào thư mục sfx/." buttonLabel="Chọn file âm thanh"
        onFiles={(f) => void upload(f, 'sfx')}>
        <UploadRows target="sfx" />
      </DropZone>
      {q.isPending ? <div className={s.music}>{[0, 1, 2].map((i) => <Skeleton key={i} height={64} radius={12} />)}</div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon={<Volume2 size={28} />} title="Chưa có hiệu ứng âm thanh" description="Tải file âm thanh lên để dùng làm hiệu ứng cho reel." />
        : sections.map((g) => (
          <section key={g.label} className={s.stack} aria-label={g.label}>
            <h3 style={{margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--muted)'}}>{g.label} · {g.files.length}</h3>
            <ul className={s.music} style={{listStyle: 'none', margin: 0, padding: 0}}>
              {g.files.map((m) => (
                <li key={m.name} className={s.mrow}>
                  <AudioPlayer compact src={`/sfx/${encodeURIComponent(m.name)}`} label={m.name} />
                  <span className={s.mname} title={m.name}>{m.name}</span>
                  <span className={s.msize}>{fmtBytes(m.bytes)}</span>
                  <IconButton label={`Xoá ${m.name}`} icon={<Trash2 size={18} />} onClick={() => setPending(m.name)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      <ConfirmDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }} danger loading={del.isPending}
        title={`Xoá hiệu ứng "${pending ?? ''}"?`} description="Xoá file khỏi thư mục sfx/. Không hoàn tác được." confirmLabel="Xoá hiệu ứng"
        onConfirm={() => pending && del.mutate(pending, {
          onSuccess: () => { setPending(null); toast({title: 'Đã xoá hiệu ứng', tone: 'success'}); },
          onError: (e) => { setPending(null); toast({title: 'Không xoá được hiệu ứng', description: e.message, tone: 'error'}); },
        })} />
    </div>
  );
}
