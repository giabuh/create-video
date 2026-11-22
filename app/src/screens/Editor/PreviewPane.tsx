import {useEffect, useMemo, useState} from 'react';
import {Player} from '@remotion/player';
import {Expand, Film, MessageSquarePlus, Pause, Play, Volume2, VolumeX} from 'lucide-react';
import {Reel} from '@studio/Reel';
import {Button, EmptyState, IconButton, Popover, Skeleton} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {insertChatText} from '../../api/chat.ts';
import {momentTag, sceneAtFrame} from './moment.ts';
import {SceneStrip} from './SceneStrip.tsx';
import {useVoiceAction} from './TopBar.tsx';
import s from './PreviewPane.module.css';

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
  const {storyboard, renderProps, stale, errors, previewOk, previewing, playerRef} = useEditor();
  const voice = useVoiceAction();
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
  const frameVars = renderProps ? {'--ar': `${renderProps.width} / ${renderProps.height}`} as React.CSSProperties : undefined;
  const total = renderProps ? Math.max(1, Math.ceil(renderProps.totalSeconds * fps)) : 1;
  // Playback time updates the transport, independently of the composition.
  const player = useMemo(() => renderProps && (
    <Player ref={playerRef} component={Reel} inputProps={renderProps} durationInFrames={total} fps={fps}
      compositionWidth={renderProps.width} compositionHeight={renderProps.height} controls={playback.fullscreen} loop={false}
      spaceKeyToPlayOrPause={false}
      defaultPremountInSeconds={1} // load the next clip before its cut
      acknowledgeRemotionLicense errorFallback={mediaError} style={{width: '100%'}} />
  ), [renderProps, playerRef, total, fps, playback.fullscreen]);

  let body: React.ReactNode;
  if (storyboard.scenes.length === 0) {
    body = <EmptyState icon={<Film size={28} />} title="Chưa có cảnh nào" description="Nhắn Claude/Codex ở khung chat để dựng cảnh đầu tiên." />;
  } else if (!previewOk) {
    body = (
      <div className={s.errors} role="alert">
        <b>Storyboard chưa hợp lệ</b>
        <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </div>
    );
  } else if (!renderProps) {
    body = <div className={s.frame} style={frameVars}><Skeleton height="100%" radius={18} /><span className={s.wait}>Đang dựng bản xem trước…</span></div>;
  } else {
    body = (
      <div className={s.frame} style={frameVars} data-testid="preview-frame">
        {player}
        {previewing && <div className={s.shimmer} aria-hidden />}
      </div>
    );
  }

  return (
    <section className={s.col} aria-label="Xem trước">
      <div className={s.canvas}>{body}</div>
      {renderProps && <div className={s.timeline}>
        <SceneStrip frame={ready ? playback.frame : null} />
        {ready && <div className={s.transport} aria-label="Điều khiển xem trước" role="group">
          <IconButton size="sm" className={s.control} label={playback.playing ? 'Tạm dừng' : 'Phát xem trước'}
            icon={playback.playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            onClick={() => playerRef.current?.toggle()} />
          <Popover align="center" side="top" trigger={<IconButton size="sm" className={s.control} label="Âm lượng xem trước"
            icon={playback.muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />} />}>
            <div className={s.volume}>
              <Button size="sm" onClick={() => playback.muted ? playerRef.current?.unmute() : playerRef.current?.mute()}>{playback.muted ? 'Bật tiếng' : 'Tắt tiếng'}</Button>
              <input type="range" min={0} max={1} step={0.05} value={playback.volume} aria-label="Mức âm lượng"
                onChange={(event) => playerRef.current?.setVolume(Number(event.target.value))} />
            </div>
          </Popover>
          <span className={s.time}>{timestamp(playback.frame, fps)} / {timestamp(total, fps)}</span>
          <input className={s.seek} type="range" min={0} max={total - 1} value={Math.min(playback.frame, total - 1)}
            style={{'--played': `${Math.min(1, playback.frame / Math.max(1, total - 1)) * 100}%`} as React.CSSProperties}
            aria-label="Tua xem trước" aria-valuetext={timestamp(playback.frame, fps)}
            onChange={(event) => playerRef.current?.seekTo(Number(event.target.value))} />
          <IconButton size="sm" className={s.control} label="Xem toàn màn hình" icon={<Expand size={18} aria-hidden />}
            onClick={() => playerRef.current?.requestFullscreen()} />
          <Button className={s.ask} size="sm" icon={<MessageSquarePlus size={16} aria-hidden />} disabled={!renderProps} onClick={() => {
            const p = playerRef.current;
            if (!p || !renderProps) return;
            p.pause();
            const f = p.getCurrentFrame();
            const scene = sceneAtFrame(renderProps, f);
            if (scene) insertChatText(momentTag(scene, f, renderProps.fps));
          }}>Sửa chỗ này</Button>
        </div>}
      </div>}
      {previewing && <span className={s.hint} role="status">Đang cập nhật…</span>}
      {stale.length > 0 && (
        <div className={s.banner}>
          <span title={stale.join(', ')}>{stale.length} cảnh chưa tạo giọng</span>
          <Button size="sm" variant="primary" loading={voice.loading} loadingText={voice.label} disabled={voice.disabled} onClick={voice.start}>Tạo giọng</Button>
        </div>
      )}
    </section>
  );
}
