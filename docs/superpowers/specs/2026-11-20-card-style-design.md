# Card style system (Sao Việt) — design

Status: approved by user 2026-11-20. Visual reference (approved mockup, animated):
`brands/demo/refs/chot-card-style.dc.html` (canvas https://claude.ai/artifact/WFmxfZw7T7Bpzz1UtXuvQf, board "Chốt · B + C + A").
Raw inspiration: `brands/demo/refs/*.png` + `sources.md`.

## Goal
Cards in every reel look like one brand (fixed foundation) while each video can still vary
(2 variants per card type + "don't repeat last video's combo" rule + freedom to write new components).

## Layer 1 — fixed foundation (all cards)
- Colors: brand `primary` #1E3A8A (navy), `accent` #FFD400 (yellow), `background` #0B1530 (dark navy),
  `text` white, `accent2` #E11D2E (red, ONLY for stamps), `surface` white. Read from `brand.colors`, never hardcode.
- Fonts: headings/numbers **Barlow Condensed** 800/900 (uppercase); body **Be Vietnam Pro** 600–900.
  Barlow Condensed must be bundled like Be Vietnam Pro (woff2, vietnamese+latin-ext+latin, OFL) in `studio/src/fonts.ts`.
- "Bold block" look (style B): solid blocks, radius 6 (at 360px preview → ×3 at 1080 = 18px), hard offset shadow
  `6px 6px 0` (×3 → 18px) in background navy or accent yellow, no blur.
- Tokens live in one file `studio/src/motion/style.ts` (radius, hard shadow, heading font, timing curves). Scale: mockup px × 3.
- Captions (whole video): text in a navy (`background`) box per line, radius ~4×3, highlight words yellow. Config switch
  `config.json captions.box: true` (default true; false = old shadow style).

## Card types (approved mockup → component)
| Card | Look | Component |
|---|---|---|
| 1 Ưu đãi | Style C: white card (radius 20×3, soft deep shadow), small navy label, big navy title with yellow highlighter sweep under `highlight` phrase; red round **stamp** (double ring: solid outer, dashed inner) with `GIẢM / 35% / ĐĂNG KÝ NGAY` | new `OfferCard` |
| 2 Bạn sẽ học | Style B: yellow title block wipes in; items = navy bars with yellow `01..` number + yellow hard shadow, staircase indent, stagger slide-in with overshoot | restyle `Checklist` |
| 3 Học phí | Style B: white small block old price (strike line draws), yellow slab new price slams in (scale 1.7→0.92→1.04→1), red rect **stamp** (double border) `ƯU ĐÃI` stamped onto the slab corner | restyle `PriceTag` |
| 4 Khai giảng | Style B: navy tab `KHAI GIẢNG` drops, yellow slab with big date wipes in | restyle `DateBadge` |
| 5 CTA | Style A: navy frosted glass card (blur 14×3, 1px white 18% border, radius 22×3), logo, yellow pill button "ĐĂNG KÝ NGAY" that pulses (1→1.05, 1.1s), phone with icon, fanpage | restyle `CtaCard` |
| Stamp | reusable: red stamp slams (scale 2.8, rot −24° → −12°, overshoot), red ring shockwave (scale 0.8→2, fade), card shake ~0.15s on impact | new `Stamp` motion + shared helper |

Facts (price, date, %, stamp text) always come from storyboard props; never defaults that look like facts.
Stamp text defaults may be generic labels only ("ƯU ĐÃI").

## Layer 2 — variants (one `variant` choice prop per card, default = approved look)
- `OfferCard.variant`: `card` (approved) | `giant` (huge Barlow number ~half screen in yellow slab + small stamp).
- `Checklist.variant`: `steps` (approved staircase bars) | `grid` (2×2 navy tiles, yellow number, pop stagger).
- `PriceTag.variant`: `slam` (approved) | `countdown` (new price counts down from `old` to `price` digits, then stamp).
- `DateBadge.variant`: `slab` (approved) | `calendar` (white calendar tile: navy top band with month, big day; label right).
- CtaCard: single style (end card, no variant).
Existing props keep working (old storyboards render with the new look; that is intended).

## Animation rules
- Each card choreographs its own enter (ownsExit true where it animates its exit); exits are quick (≤0.3s fade/slide, staggered).
- Entrances 0.3–0.45s, back/overshoot easing for bold elements, `cubic-bezier(.65,0,.35,1)`-like for wipes.
- Stagger 0.15s between list items. Stamp lands after its card (≈0.45s after card start, PriceTag after slam).
- Shake applies to the card layer itself (a motion layer cannot shake the footage underneath).

## Layer 3 — variety
- `tools/usage.py --motion`: count `component/variant` per project across `projects/*/storyboard.json`, least-used first,
  and print the previous (most recent by storyboard mtime) project's combo.
- make-reel SKILL.md: pick variants by fit; among equal fits pick least-used and do not repeat the last project's combo;
  new components are still allowed (must use Layer 1 tokens); good ones become variants later.

## Out of scope (this round)
GlossyPill, TwoTier, Ribbon, Callout, other cards keep their current look. Multiple style packs per brand.
