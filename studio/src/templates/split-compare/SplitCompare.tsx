// style: split screen. Two stacked panels (media[0] top, media[1] bottom) with an accent divider; captions sit on the divider.
// One media: it fills the top panel and the bottom panel is a brand-colored text panel.
import React from 'react';
import {AbsoluteFill, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {captionUnits} from '../../components/Captions';
import {MediaShot} from '../../components/MediaShot';
import {MotionLayer} from '../../components/MotionLayer';
import {ReelTail} from '../../components/ReelTail';
import {SceneTransition} from '../../components/SceneTransition';
import {fitFontSize, useFontsLoaded} from '../../fit';
import {fontFamily} from '../../fonts';
import type {Brand, RenderProps, Scene} from '../../types';

const SPLIT = 960; // y of the divider centre
const BAR = 18;

const Label: React.FC<{n: number; brand: Brand; style: React.CSSProperties}> = ({n, brand, style}) => (
  <div style={{
    position: 'absolute', width: 72, height: 72, borderRadius: 36, background: brand.colors.accent, color: brand.colors.background,
    fontFamily, fontWeight: 800, fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 20px rgba(0,0,0,.4)', ...style,
  }}>{n}</div>
);

// current caption chunk; `panel` = big text inside the bottom panel, otherwise a boxed caption centred on the divider
const SplitCaption: React.FC<{sc: Scene; brand: Brand; size: number; panel: boolean; color: string; highlightColor: string; boxed: boolean}> =
  ({sc, brand, size, panel, color, highlightColor, boxed}) => {
    const frame = useCurrentFrame();
    const {fps, width} = useVideoConfig();
    const loaded = useFontsLoaded();
    const t = frame / fps;
    const c = sc.captions.find((x) => t >= x.start && t < x.end);
    if (!c) return null;
    const maxW = width * (panel ? 0.84 : 0.86) - (boxed ? 60 : 0);
    const fs = loaded ? fitFontSize({text: c.text, maxSize: size, width: maxW, height: size * 1.15 * 2 + 1, weight: 800, lineHeight: 1.15}) : size;
    const pop = spring({frame: Math.round((t - c.start) * fps), fps, config: {damping: 14}});
    const units = captionUnits(c.text, sc.highlight).map((u, i) => (
      <React.Fragment key={i}><span style={{whiteSpace: 'nowrap', ...(u.mark ? {color: highlightColor} : {})}}>{u.text}</span>{' '}</React.Fragment>
    ));
    const box = boxed && !panel;
    return (
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', ...(panel ? {top: SPLIT + BAR / 2 + 160, height: 1540 - SPLIT - BAR / 2 - 160} : {top: SPLIT - 150, height: 300})}}>
        <div style={{
          fontFamily, fontWeight: 800, fontSize: fs, color, textAlign: 'center', maxWidth: '86%', textWrap: 'balance',
          lineHeight: box ? 1.65 : 1.15, transform: `scale(${0.85 + 0.15 * pop})`,
          ...(box ? {} : {textShadow: '0 4px 18px rgba(0,0,0,.85), 0 0 4px rgba(0,0,0,.9)'}),
        }}>
          <span style={box ? {background: brand.colors.background, padding: '18px 30px', borderRadius: 12, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'} : undefined}>{units}</span>
        </div>
      </AbsoluteFill>
    );
  };

export const SplitCompare: React.FC<RenderProps> = (p) => {
  const {fps} = useVideoConfig();
  const f = (s: number) => Math.max(1, Math.round(s * fps));
  const {colors} = p.brand;
  const ts = p.transitionSeconds ?? 0.3;
  const tf = Math.round(ts * fps);
  const topH = SPLIT - BAR / 2;
  return (
    <AbsoluteFill style={{backgroundColor: colors.background}}>
      {p.scenes.map((sc, si) => {
        const next = p.scenes[si + 1];
        const tail = next && next.transition !== 'cut' ? tf : 0;
        const dur = f(sc.duration) + tail;
        const two = sc.media.length >= 2;
        // both clips play for the whole scene, each from its own `from`
        const shot = (i: number) => (
          <Sequence from={0} durationInFrames={dur}><MediaShot item={{...sc.media[i], start: 0, duration: sc.duration}} /></Sequence>
        );
        return (
          <Sequence key={sc.id} name={sc.id} from={Math.round(sc.start * fps)} durationInFrames={dur}>
            <SceneTransition type={si === 0 ? 'cut' : sc.transition} seconds={ts}>
              <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: topH, overflow: 'hidden'}}>
                {sc.media[0] ? shot(0) : <AbsoluteFill style={{background: `linear-gradient(160deg, ${colors.primary}, ${colors.background})`}} />}
              </div>
              <div style={{position: 'absolute', left: 0, right: 0, top: SPLIT + BAR / 2, bottom: 0, overflow: 'hidden',
                background: two ? undefined : `linear-gradient(180deg, ${colors.primary}, ${colors.background})`}}>
                {two && <AbsoluteFill style={{top: 0, height: 1920 - SPLIT - BAR / 2}}>{shot(1)}</AbsoluteFill>}
              </div>
              <div style={{position: 'absolute', left: 0, right: 0, top: topH, height: BAR, background: colors.accent, boxShadow: '0 0 24px rgba(0,0,0,.5)'}} />
              <Label n={1} brand={p.brand} style={{right: 50, top: 80}} />
              {two && <Label n={2} brand={p.brand} style={{right: 50, top: SPLIT + 110}} />}
              <Sequence name={`${sc.id} content`} durationInFrames={f(sc.duration)}>
                {sc.motion.map((m, i) => (
                  <Sequence key={`motion-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                    <MotionLayer item={m} brand={p.brand} />
                  </Sequence>
                ))}
                {sc.overlay && (
                  <AbsoluteFill style={{top: two ? 80 : SPLIT + BAR / 2 + 20, height: two ? 100 : 130, alignItems: 'center', justifyContent: 'center'}}>
                    <div style={{fontFamily, fontWeight: 800, fontSize: two ? 56 : 72, color: colors.background, background: colors.accent, padding: two ? '8px 30px' : '10px 36px', borderRadius: two ? 14 : 16, maxWidth: two ? '60%' : '88%', textAlign: 'center'}}>{sc.overlay.text}</div>
                  </AbsoluteFill>
                )}
                <SplitCaption sc={sc} brand={p.brand} panel={!two} size={two ? p.captions.size : Math.round(p.captions.size * 1.3)}
                  color={p.captions.color} highlightColor={p.captions.highlightColor} boxed={!!p.captions.box} />
                {sc.voice && <Audio src={staticFile(sc.voice.src)} />}
              </Sequence>
            </SceneTransition>
          </Sequence>
        );
      })}
      <ReelTail p={p} />
    </AbsoluteFill>
  );
};
