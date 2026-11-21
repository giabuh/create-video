// A smartphone showing a social feed: `scroll` = posts fly past (the ad gets ignored);
// `messages` = the ad post stays and customer messages pop in on the spoken words.
import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {bool, choice, lines, media, text, z, type MotionProps} from './schema';

export const FeedPhoneSchema = z.object({
  mode: choice('Kiểu', ['scroll', 'messages'], 'scroll', {scroll: 'Bảng tin lướt qua', messages: 'Tin nhắn khách đổ về'}),
  page: text('Tên trang đăng bài'),
  postText: text('Chữ của bài quảng cáo'),
  image: media('Ảnh của bài quảng cáo').optional(),
  messages: lines('Tin nhắn khách (mỗi dòng một tin)').optional(),
  itemsAt: z.array(z.string()).optional().describe('Từ trong lời đọc để hiện từng tin nhắn (prepare.py tự tính giờ)'),
  itemTimes: z.array(z.number().nullable()).optional().describe('Giờ hiện từng tin nhắn (giây, tự tính từ itemsAt)'),
  demoTag: bool('Hiện nhãn "Minh họa"', true),
});

const Post: React.FC<{page: string; body: string; image?: string; w: number; ad?: boolean; accent: string}> = ({page, body, image, w, ad, accent}) => (
  <div style={{background: '#fff', borderRadius: w * 0.03, padding: w * 0.04, marginBottom: w * 0.035, color: '#1c1e21'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: w * 0.03}}>
      <div style={{width: w * 0.11, height: w * 0.11, borderRadius: 999, background: ad ? accent : '#d0d4da', flex: 'none'}} />
      <div style={{lineHeight: 1.15}}>
        {ad ? <div style={{fontWeight: 800, fontSize: w * 0.045}}>{page}</div> : <div style={{width: w * 0.35, height: w * 0.03, background: '#d0d4da', borderRadius: 9}} />}
        {ad ? <div style={{fontSize: w * 0.033, color: '#65676b'}}>Được tài trợ</div> : <div style={{width: w * 0.2, height: w * 0.022, background: '#e4e6eb', borderRadius: 9, marginTop: 8}} />}
      </div>
    </div>
    {ad ? <div style={{fontSize: w * 0.045, margin: `${w * 0.03}px 0`, fontWeight: 500}}>{body}</div>
      : <div style={{margin: `${w * 0.03}px 0`}}>{[0.9, 0.7].map((k) => <div key={k} style={{width: `${k * 100}%`, height: w * 0.025, background: '#e4e6eb', borderRadius: 9, marginBottom: 8}} />)}</div>}
    <div style={{height: w * 0.62, borderRadius: w * 0.02, overflow: 'hidden', background: ad ? '#eef1f6' : '#e4e6eb'}}>
      {ad && image ? <Img src={staticFile(`library/${image}`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : null}
    </div>
    <div style={{display: 'flex', justifyContent: 'space-around', fontSize: w * 0.036, color: '#65676b', fontWeight: 600, paddingTop: w * 0.03}}>
      <span>Thích</span><span>Bình luận</span><span>Chia sẻ</span>
    </div>
  </div>
);

export const FeedPhone: React.FC<MotionProps<typeof FeedPhoneSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const {accent, background} = p.brand.colors;
  // Phone keeps a 9:19 body and fits inside the layer area.
  const h = Math.min(p.area.height, p.area.width * (19 / 9));
  const w = h * (9 / 19);
  const sw = w * 0.92; // screen width
  const inn = spring({frame, fps, config: {damping: 15}});
  const out = interpolate(t, [p.layerSeconds - 0.3, p.layerSeconds], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const postH = sw * 1.12;
  // scroll: feed slides up fast, the ad (3rd post) passes without a stop.
  const scrollY = p.mode === 'scroll' ? -((t * sw * 0.9) % (postH * 4)) : 0;
  const msgs = p.messages ?? [];
  const posts = p.mode === 'scroll' ? [0, 0, 1, 0, 0, 0, 1, 0] : [1];
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: out, fontFamily}}>
      <div style={{width: w, height: h, borderRadius: w * 0.12, background: '#0d0f14', padding: w * 0.04, boxSizing: 'border-box',
        boxShadow: '0 50px 120px rgba(0,0,0,.55), inset 0 0 0 3px rgba(255,255,255,.15)', transform: `translateY(${(1 - inn) * 200}px) rotate(${(1 - inn) * -6}deg)`, opacity: Math.min(1, inn * 2)}}>
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: w * 0.09, overflow: 'hidden', background: '#f0f2f5'}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: w * 0.14, padding: `0 ${sw * 0.03}px`, transform: `translateY(${scrollY}px)`}}>
            {posts.map((ad, i) => <Post key={i} page={p.page} body={p.postText} image={p.image} w={sw * 0.94} ad={!!ad} accent={accent} />)}
          </div>
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: w * 0.14, background: '#fff', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: `0 ${sw * 0.05}px ${w * 0.02}px`, boxSizing: 'border-box', boxShadow: '0 2px 8px rgba(0,0,0,.08)'}}>
            <span style={{fontWeight: 800, fontSize: sw * 0.06, color: background}}>Bảng tin{p.demoTag ? <span style={{fontSize: sw * 0.05, color: '#65676b', fontWeight: 700, marginLeft: sw * 0.03}}>(minh họa)</span> : null}</span>
          </div>
          {p.mode === 'messages' && (
            <div style={{position: 'absolute', left: sw * 0.04, right: sw * 0.04, bottom: sw * 0.05, display: 'flex', flexDirection: 'column', gap: sw * 0.025}}>
              {msgs.map((m, i) => {
                const s = spring({frame: frame - Math.round((p.itemTimes?.[i] ?? 0.6 + i * 0.7) * fps), fps, config: {damping: 12, stiffness: 180}});
                if (s <= 0.001) return null;
                return (
                  <div key={i} style={{alignSelf: 'flex-start', maxWidth: '96%', background: '#fff', borderRadius: sw * 0.05, padding: `${sw * 0.025}px ${sw * 0.04}px`, fontSize: sw * 0.065, color: '#1c1e21', fontWeight: 600,
                    boxShadow: '0 10px 30px rgba(0,0,0,.25)', border: `3px solid ${accent}`, transform: `translateY(${(1 - s) * 60}px) scale(${0.8 + 0.2 * s})`, opacity: Math.min(1, s * 3)}}>{m}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
