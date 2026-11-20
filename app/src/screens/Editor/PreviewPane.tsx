import {useEffect, useState} from 'react';
import {Player} from '@remotion/player';
import {Expand, Film, Pause, Play, Plus, Volume2, VolumeX} from 'lucide-react';
import {Reel} from '@studio/Reel';
import {Button, EmptyState, IconButton, Popover, Segmented, Skeleton} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {sceneRange} from './editorState.ts';
import {useVoiceAction} from './TopBar.tsx';
import s from './PreviewPane.module.css';

type Mode = 'scene' | 'video';
const playbackEvents = ['play', 'pause', 'ended', 'timeupdate', 'seeked', 'fullscreenchange', 'mutechange', 'volumechange'] as const;
const timestamp = (frame: number, fps: number) => {
  const seconds = Math.floor(frame / fps);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const mediaError = ({error}: {error: Error}): React.ReactNode => {
  const src = /(?:library|music|brands|projects)\/[^\s"')]+/.exec(error.message)?.[0];
  return <div className={s.fallback} role="alert"><Film size={22} aria-hidden /><span>{src ? `Không tải được media: ${src}` : `Không dựng được bản xem trước: ${error.message}`}</span></div>;
};

export function PreviewPane(): React.JSX.Element {
  const {storyboard, renderProps, stale, errors, previewOk, previewing, selectedId, playerRef, addSceneAt} = useEditor();
  const voice = useVoiceAction();
  const [mode, setMode] = useState<Mode>('scene');
  const [playback, setPlayback] = useState({frame: 0, playing: false, muted: false, fullscreen: false, volume: 1});
  const ready = !!renderProps && previewOk && storyboard.scenes.length > 0;

  useEffect(() => {
    if (!ready) return;
    const player = playerRef.current;
    if (!player) return;
    const sync = () => setPlayback({
      frame: player.getCurrentFrame(), playing: player.isPlaying(), muted: player.isMuted(),
      fullscreen: player.isFullscreen(), volume: player.getVolume(),
    });
    sync();
    for (const event of playbackEvents) player.addEventListener(event, sync);
    return () => { for (const event of playbackEvents) player.removeEventListener(event, sync); };
  }, [ready, playerRef]);

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
          compositionWidth={renderProps.width} compositionHeight={renderProps.height} controls={playback.fullscreen} loop={loopOk}
          inFrame={loopOk ? inFrame : null} outFrame={loopOk ? outFrame : null} spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense errorFallback={mediaError} style={{width: '100%'}} />
        {previewing && <div className={s.shimmer} aria-hidden />}
      </div>
    );
  }

  return (
    <section className={s.col} aria-label="Xem trước">
      <div className={s.canvas}>{body}</div>
      {ready && (
        <div className={s.transport} aria-label="Điều khiển xem trước" role="group">
          <IconButton className={s.control} label={playback.playing ? 'Tạm dừng' : 'Phát xem trước'}
            icon={playback.playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            onClick={() => playerRef.current?.toggle()} />
          <Popover align="center" side="top" trigger={<IconButton className={s.control} label="Âm lượng xem trước"
            icon={playback.muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />} />}>
            <div className={s.volume}>
              <Button size="sm" onClick={() => playback.muted ? playerRef.current?.unmute() : playerRef.current?.mute()}>{playback.muted ? 'Bật tiếng' : 'Tắt tiếng'}</Button>
              <input type="range" min={0} max={1} step={0.05} value={playback.volume} aria-label="Mức âm lượng"
                onChange={(event) => playerRef.current?.setVolume(Number(event.target.value))} />
            </div>
          </Popover>
          <span className={s.time}>{timestamp(playback.frame, fps)} / {timestamp(total, fps)}</span>
          <input className={s.seek} type="range" min={0} max={total - 1} value={Math.min(playback.frame, total - 1)}
            aria-label="Tua xem trước" aria-valuetext={timestamp(playback.frame, fps)}
            onChange={(event) => playerRef.current?.seekTo(Number(event.target.value))} />
          <IconButton className={s.control} label="Xem toàn màn hình" icon={<Expand size={18} aria-hidden />}
            onClick={() => playerRef.current?.requestFullscreen()} />
        </div>
      )}
      <div className={s.bar}>
        <Segmented<Mode> size="sm" value={mode} onChange={setMode} aria-label="Phạm vi xem trước" options={[{value: 'scene', label: 'Cảnh'}, {value: 'video', label: 'Cả video'}]} />
        {previewing && <span className={s.hint} role="status">Đang cập nhật…</span>}
      </div>
      {stale.length > 0 && (
        <div className={s.banner}>
          <span title={stale.join(', ')}>{stale.length} cảnh chưa tạo giọng</span>
          <Button size="sm" variant="primary" loading={voice.loading} loadingText={voice.label} disabled={voice.disabled} onClick={voice.start}>Tạo giọng</Button>
        </div>
      )}
    </section>
  );
}
