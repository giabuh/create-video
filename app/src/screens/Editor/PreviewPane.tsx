import {useEffect, useState} from 'react';
import {Player} from '@remotion/player';
import {Film, Plus} from 'lucide-react';
import {Reel} from '@studio/Reel';
import {Button, EmptyState, Segmented, Skeleton} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {sceneRange} from './editorState.ts';
import {useVoiceAction} from './TopBar.tsx';
import s from './PreviewPane.module.css';

type Mode = 'scene' | 'video';

const mediaError = ({error}: {error: Error}): React.ReactNode => {
  const src = /(?:library|music|brands|projects)\/[^\s"')]+/.exec(error.message)?.[0];
  return <div className={s.fallback} role="alert"><Film size={22} aria-hidden /><span>{src ? `Không tải được media: ${src}` : `Không dựng được bản xem trước: ${error.message}`}</span></div>;
};

export function PreviewPane(): React.JSX.Element {
  const {storyboard, renderProps, stale, errors, previewOk, previewing, selectedId, playerRef, addSceneAt} = useEditor();
  const voice = useVoiceAction();
  const [mode, setMode] = useState<Mode>('scene');

  const fps = renderProps?.fps ?? 30;
  const total = renderProps ? Math.max(1, Math.ceil(renderProps.totalSeconds * fps)) : 1;
  const range = mode === 'scene' && selectedId ? sceneRange(renderProps, selectedId) : null;
  const inFrame = range ? Math.min(total - 2, Math.round(range[0] * fps)) : null;
  const outFrame = range && inFrame !== null ? Math.min(total - 1, Math.max(inFrame + 1, Math.round(range[1] * fps) - 1)) : null;
  const loopOk = inFrame !== null && inFrame >= 0 && outFrame !== null && outFrame > inFrame;

  useEffect(() => { if (loopOk) playerRef.current?.seekTo(inFrame); }, [loopOk, inFrame, outFrame, playerRef]);

  let body: React.ReactNode;
  if (storyboard.scenes.length === 0) {
    body = <EmptyState icon={<Film size={28} />} title="Chưa có cảnh nào" description="Thêm cảnh đầu tiên để xem trước." action={<Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => addSceneAt(null)}>+ Thêm cảnh</Button>} />;
  } else if (!previewOk) {
    body = (
      <div className={s.errors} role="alert">
        <b>Storyboard chưa hợp lệ</b>
        <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </div>
    );
  } else if (!renderProps) {
    body = <div className={s.frame}><Skeleton height="100%" radius={18} /><span className={s.wait}>Đang dựng bản xem trước…</span></div>;
  } else {
    body = (
      <div className={s.frame}>
        <Player ref={playerRef} component={Reel} inputProps={renderProps} durationInFrames={total} fps={fps}
          compositionWidth={renderProps.width} compositionHeight={renderProps.height} controls loop={loopOk}
          inFrame={loopOk ? inFrame : null} outFrame={loopOk ? outFrame : null} spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense errorFallback={mediaError} style={{width: '100%'}} />
        {previewing && <div className={s.shimmer} aria-hidden />}
      </div>
    );
  }

  return (
    <section className={s.col} aria-label="Xem trước">
      {body}
      <div className={s.bar}>
        <Segmented<Mode> size="sm" value={mode} onChange={setMode} aria-label="Phạm vi xem trước" options={[{value: 'scene', label: 'Cảnh'}, {value: 'video', label: 'Cả video'}]} />
        {previewing && <span className={s.hint} role="status">Đang cập nhật…</span>}
      </div>
      {stale.length > 0 && (
        <div className={s.banner}>
          <span>Lời đọc của {stale.join(', ')} chưa có giọng — đang dùng độ dài ước tính.</span>
          <Button size="sm" variant="primary" loading={voice.loading} loadingText={voice.label} disabled={voice.disabled} onClick={voice.start}>Tạo giọng</Button>
        </div>
      )}
    </section>
  );
}
