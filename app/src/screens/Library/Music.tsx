import {Music as MusicIcon} from 'lucide-react';
import {useMusic} from '../../api/hooks.ts';
import {useUploads} from '../../api/upload.ts';
import {AudioPlayer, DropZone, EmptyState, ErrorState, Skeleton, fmtBytes} from '../../ui/index.ts';
import {MUSIC_EXTS} from './exts.ts';
import {UploadRows} from './Uploads.tsx';
import s from './Library.module.css';

export function MusicTab(): React.JSX.Element {
  const {upload} = useUploads();
  const q = useMusic();
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
            </li>
          ))}
        </ul>}
    </div>
  );
}
