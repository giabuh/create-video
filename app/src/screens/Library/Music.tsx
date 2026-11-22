import {useState} from 'react';
import {Music as MusicIcon, Trash2} from 'lucide-react';
import {useDeleteMusic, useMusic} from '../../api/hooks.ts';
import {useUploads} from '../../api/upload.ts';
import {AudioPlayer, ConfirmDialog, DropZone, IconButton, toast, EmptyState, ErrorState, Skeleton, fmtBytes} from '../../ui/index.ts';
import {MUSIC_EXTS} from '../../../shared/exts.ts';
import {UploadRows} from './Uploads.tsx';
import s from './Library.module.css';

export function MusicTab(): React.JSX.Element {
  const {upload} = useUploads();
  const q = useMusic();
  const del = useDeleteMusic();
  const [pending, setPending] = useState<string | null>(null);
  return (
    <div className={s.stack}>
      <DropZone accept={MUSIC_EXTS} title="Kéo-thả nhạc nền vào đây" description="MP3, M4A, WAV, OGG, AAC. File lưu vào thư mục music/." buttonLabel="Chọn file nhạc"
        onFiles={(f) => void upload(f, 'music')}>
        <UploadRows target="music" />
      </DropZone>
      {q.isPending ? <div className={s.music}>{[0, 1, 2].map((i) => <Skeleton key={i} height={64} radius={12} />)}</div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon={<MusicIcon size={28} />} title="Chưa có nhạc nền" description="Tải một bài nhạc lên để dùng làm nhạc nền cho reel." />
        : <ul className={s.music} style={{listStyle: 'none', margin: 0, padding: 0}}>
          {q.data.map((m) => (
            <li key={m.name} className={s.mrow}>
              <AudioPlayer compact src={`/music/${encodeURIComponent(m.name)}`} label={m.name} />
              <span className={s.mname} title={m.name}>{m.name}</span>
              <span className={s.msize}>{fmtBytes(m.bytes)}</span>
              <IconButton label={`Xoá ${m.name}`} icon={<Trash2 size={18} />} onClick={() => setPending(m.name)} />
            </li>
          ))}
        </ul>}
      <ConfirmDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }} danger loading={del.isPending}
        title={`Xoá nhạc "${pending ?? ''}"?`} description="Xoá file khỏi thư mục music/. Không hoàn tác được." confirmLabel="Xoá nhạc"
        onConfirm={() => pending && del.mutate(pending, {
          onSuccess: () => { setPending(null); toast({title: 'Đã xoá nhạc', tone: 'success'}); },
          onError: (e) => { setPending(null); toast({title: 'Không xoá được nhạc', description: e.message, tone: 'error'}); },
        })} />
    </div>
  );
}
