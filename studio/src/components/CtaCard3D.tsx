// CTA: a 3D logo card (three.js through @remotion/three) over a brand field with drifting light bokeh, then button, phone, fanpage.
// Without brand.logo it is the normal CtaCard.
import React from 'react';
import {AbsoluteFill, Easing, cancelRender, getRemotionEnvironment, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {noise2D} from '@remotion/noise';
import {Star} from '@remotion/shapes';
import * as THREE from 'three';
import {fontFamily, headingFamily} from '../fonts';
import type {Brand, Cta, MediaItem} from '../types';
import {CtaCard} from './CtaCard';

const phoneFmt = (p: string) => (/^\d{10}$/.test(p) ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p); // spacing only, same digits

const RoundedPlate: React.FC<{w: number; h: number; r: number; depth: number; color: string; glow: string}> = ({w, h, r, depth, color, glow}) => {
  const geo = React.useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 5});
    g.translate(0, 0, -depth / 2);
    return g;
  }, [w, h, r, depth]);
  return <mesh geometry={geo}><meshStandardMaterial color={color} emissive={glow} emissiveIntensity={0.55} metalness={0.2} roughness={0.3} /></mesh>;
};

const Logo3D: React.FC<{tex: THREE.Texture; aspect: number; color: string; glow: string}> = ({tex, aspect, color, glow}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const enter = spring({frame, fps, config: {damping: 13, stiffness: 70}});
  const ry = (1 - enter) * Math.PI * 2.2 + Math.sin(t * 1.6) * 0.28;
  const rx = Math.sin(t * 1.1) * 0.1;
  const pw = 5.6, ph = pw / aspect + 1.1;
  return (
    <group position={[0, 0, 0]} rotation={[rx, ry, 0]} scale={0.3 + 0.7 * enter}>
      <RoundedPlate w={pw} h={ph} r={0.5} depth={0.35} color={color} glow={glow} />
      <mesh position={[0, 0, 0.3]}>
        <planeGeometry args={[pw - 0.9, (pw - 0.9) / aspect]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.3]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[pw - 0.9, (pw - 0.9) / aspect]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
};

const Cta3D: React.FC<{cta: Cta; brand: Brand; logo: string}> = ({cta, brand, logo}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const {accent, background, primary, text} = brand.colors;
  // the texture is loaded out here and the frame held until the 3D tree has it (state inside the canvas flushes after capture)
  const [tex, setTex] = React.useState<THREE.Texture | null>(null);
  const [handle] = React.useState(() => delayRender('Loading logo texture'));
  React.useEffect(() => {
    new THREE.TextureLoader().load(staticFile(logo), (x) => { x.colorSpace = THREE.SRGBColorSpace; setTex(x); }, undefined, () => cancelRender(new Error(`CtaCard3D: cannot load logo texture ${logo}`)));
  }, [logo]);
  React.useEffect(() => { if (tex) { const id = requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle))); return () => cancelAnimationFrame(id); } }, [tex, handle]);
  const p = (d: number, dur = 0.45) => interpolate(t, [d, d + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const btn = spring({frame: frame - Math.round(0.7 * fps), fps, config: {damping: 10, stiffness: 150}});
  const pulse = 1 + 0.04 * Math.sin(t * 6);
  const phone = p(1.0), fb = p(1.3);
  const shine = ((t * 0.7) % 1.6) * 1.5 - 0.3;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 28%, ${primary} 0%, ${background} 70%)`, fontFamily}}>
      {[...Array(16)].map((_, i) => {
        const x = (noise2D('bx', i, t / 6) * 0.5 + 0.5) * width, y = (noise2D('by', i, t / 6) * 0.5 + 0.5) * height, s = 60 + (i % 5) * 50;
        return <div key={i} style={{position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: 999, background: i % 3 ? `${accent}29` : `${primary}55`, filter: 'blur(14px)'}} />;
      })}
      <div style={{position: 'absolute', left: width / 2 - 560, top: 150, opacity: 0.9, transform: `rotate(${t * 12}deg)`}}>
        <Star points={16} innerRadius={420} outerRadius={560} cornerRadius={10} fill={`${accent}17`} />
      </div>
      <ThreeCanvas width={width} height={height * 0.5} style={{position: 'absolute', top: 120, left: 0}} camera={{position: [0, 0, 9], fov: 40}}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 6, 8]} intensity={2.2} />
        <pointLight position={[-6, -3, 5]} intensity={90} color={accent} />
        {tex && <Logo3D tex={tex} aspect={(tex.image as {width: number; height: number}).width / (tex.image as {width: number; height: number}).height} color={text} glow={text} />}
      </ThreeCanvas>
      <div style={{position: 'absolute', left: 72, right: 72, top: 1090, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
        <div style={{position: 'relative', overflow: 'hidden', background: accent, color: background, fontSize: 60, fontWeight: 900, textAlign: 'center', padding: '38px 70px', borderRadius: 999, boxShadow: `0 16px 0 ${accent}99, 0 40px 90px rgba(0,0,0,.4)`,
          opacity: Math.min(1, btn * 3), transform: `scale(${(0.4 + 0.6 * btn) * pulse})`}}>
          {cta.title}
          <div style={{position: 'absolute', top: 0, bottom: 0, left: `${shine * 100}%`, width: '22%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.65), transparent)', transform: 'skewX(-18deg)'}} />
        </div>
        {cta.phone && (
          <div style={{fontFamily: headingFamily, fontWeight: 900, fontSize: 170, lineHeight: 1, whiteSpace: 'nowrap', color: text, letterSpacing: 2, opacity: phone, transform: `translateY(${(1 - phone) * 80}px)`, textShadow: `0 8px 0 ${primary}, 0 20px 50px rgba(0,0,0,.5)`}}>{phoneFmt(cta.phone)}</div>
        )}
        {[cta.fanpage, cta.address].filter(Boolean).map((l, i) => (
          <div key={i} style={{fontSize: 48, fontWeight: 700, color: text, opacity: fb * 0.88, transform: `translateY(${(1 - fb) * 60}px)`}}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// three.js cancels the whole Player when the viewer's browser has no WebGL; the app preview then shows the 2D card.
// Renders never fall back, so a missing 3D card fails loudly instead of shipping silently.
const previewHasWebGL = (): boolean => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // probe only: give the context straight back
    return !!gl;
  } catch { return false; }
};

export const CtaCard3D: React.FC<{cta: Cta; brand: Brand; bg?: MediaItem; centerY?: number}> = (a) => {
  const [webgl] = React.useState(() => !getRemotionEnvironment().isPlayer || previewHasWebGL());
  return a.brand.logo && webgl ? <Cta3D cta={a.cta} brand={a.brand} logo={a.brand.logo} /> : <CtaCard {...a} />;
};
