# Showcase brief (round 2): seven techniques, same brief for both engines

Canvas 1080x1920, 30 fps, vertical. Each technique is one clip; Remotion writes `showcase/out/r-<n>.mp4`, HyperFrames writes `showcase/out/h-<n>.mp4`.
On-screen text comes only from this table (letter case may change for styling; no rewording).

| # | Technique | Duration | Footage | On-screen text | Audio |
| --- | --- | --- | --- | --- | --- |
| 1 | Transitions (at least two different ones) | 8 s | A (0–2.7 s) → B → A | none (logo optional) | optional sfx from `sfx/` |
| 2 | Kinetic typography | 6 s | A | "HỌC 1 KÈM 1", then "Tại Tin học Sao Việt" | optional sfx from `sfx/` |
| 3 | TikTok-style word-by-word captions | scene `kem-1-1` length (5.519 s) | A | caption chunks of `kem-1-1` verbatim: "Tại Tin học Sao Việt," / "giảng viên hướng dẫn" / "bạn 1 kèm 1," / "thực hành ngay trên" / "sản phẩm của mình." | the `kem-1-1` voice wav; timings from its `.words.json` |
| 4 | Background removal (text/graphics behind the student) | 6 s | A + cutout | "Quảng cáo Facebook" | none |
| 5 | Animated numbers | 6 s | A | "ƯU ĐÃI HỌC PHÍ", count-up to "35%", "Giảm ngay khi đăng ký" | optional sfx from `sfx/` |
| 6 | 3D | 6 s | A or brand-colour backdrop | logo as a 3D object/card; "Tin học Sao Việt" | none |
| 7 | Look (light leaks, grain, grade) | 6 s | A | "Thực hành ngay trên sản phẩm của mình." | none |

## Inputs

- Footage A: `library/video-doc-hoc-vien-nu-thuc-hanh-excel-tren-laptop.mp4`, 720x1280, 30 fps, 10.37 s, use from 0.5 s. The blue-shirt student fills the frame until about 4–5 s; after that the shot changes to a monitor view (another person), so for the cutout use the first ~4 s.
- Footage B: `library/video-doc-hoc-sinh-hoc-lap-trinh-python.mp4`, 720x1280, 8.31 s, use 0.5–7.5 s (boy in white school uniform at a monitor, head and hands visible; face turns toward the camera in the last ~2 s).
- Cutout of A (alpha): `showcase/shared/cutout.webm` (VP9 + alpha, yuv420p with ALPHA_MODE=1, 720x1280, 30 fps, 311 frames = 10.37 s, same timeline as A, so use it with the same media start as A). It decodes with alpha in both engines (see the report "Prep"). No matte needed.
- Voice for #3: `projects/2026-11-21-so-sanh-toi-da/audio/kem-1-1-af3c7454a597.wav` (5.2195 s); word timings `projects/2026-11-21-so-sanh-toi-da/audio/kem-1-1-af3c7454a597.words.json` (`{"engine","words":[{"w","start","end"}]}`, seconds from the wav start). Scene `kem-1-1` starts at 3.433 s in the full reel; caption chunk starts inside the scene are 0, 1.31, 2.3, 3.44, 4.09 s.
- Logo: `brands/demo/logo-marketing-sao-viet-3-nobg.png`. Brand colours: primary #1E3A8A, accent #FFD400, text #FFFFFF, background #0B1530.
- SFX: `sfx/*.mp3` (whoosh-*, pop-*, ting-*, click-*, sparkle-*).
- Outputs: `showcase/out/r-<n>.mp4` (Remotion), `showcase/out/h-<n>.mp4` (HyperFrames), n = 1..7.
