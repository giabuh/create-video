// An image or video from library/ as a layer: logos, stickers, a second camera angle, picture-in-picture.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
import {choice, color, media, numDefault, bool, z, type MotionProps} from './schema';

const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;

export const PictureSchema = z.object({
  src: media('Ảnh / video trong thư viện'),
  fit: choice('Cách vừa khung', ['contain', 'cover'], 'contain', {contain: 'Vừa trọn', cover: 'Lấp đầy (cắt viền)'}),
  radius: numDefault('Bo góc (px)', 0, {min: 0, max: 500, step: 2}),
  border: color('Viền (trống = không)'),
  borderWidth: numDefault('Độ dày viền (px)', 8, {min: 0, max: 60, step: 1}),
  shadow: bool('Đổ bóng', true),
  from: numDefault('Video: bắt đầu từ giây', 0, {min: 0, step: 0.1}),
});

export const Picture: React.FC<MotionProps<typeof PictureSchema>> = (p) => {
  const {fps} = useVideoConfig();
  const src = staticFile(`library/${p.src}`);
  const style: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: p.fit, borderRadius: p.radius,
    border: p.border ? `${p.borderWidth}px solid ${p.border}` : undefined, boxSizing: 'border-box',
    boxShadow: p.shadow ? '0 24px 70px rgba(0,0,0,.5)' : undefined,
  };
  return (
    <AbsoluteFill>
      {IMAGE.test(p.src)
        ? <Img src={src} style={style} />
        : <Video src={src} muted trimBefore={Math.round(p.from * fps)} objectFit={p.fit} style={style} />}
    </AbsoluteFill>
  );
};
