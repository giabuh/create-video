# Card style system — implementation plan

Spec: `docs/superpowers/specs/2026-11-20-card-style-design.md` (read the section for your task + "Layer 1" + "Animation rules").
Visual truth: `brands/demo/refs/chot-card-style.dc.html` (HTML/CSS mockup at 360×640; multiply px by 3 for 1080×1920;
its CSS @keyframes give exact timings — 4.5s loop, so 1% = 45ms).

Conventions for every task:
- Follow CLAUDE.md rule 6 (motion contract: `<Name>` + `<Name>Schema`, helpers from `motion/schema.ts`, Vietnamese titles,
  colors from `brand.colors`, register with `defineMotion`). Use Remotion `spring`/`interpolate`, frame-based; no CSS animations.
- Tokens only from `studio/src/motion/style.ts` (created in T1). Fonts from `studio/src/fonts.ts`.
- Text must fit: reuse `fitFontSize`/`useFontsLoaded` from `studio/src/fit.ts` like the current components do.
- Tests per task: only touched modules: `cd studio && npx tsc --noEmit`; `cd app && npx vitest run src/screens/Editor/motionSchema.test.ts src/screens/Editor/withDefaults.test.ts`;
  `uv run --with pytest python -m pytest tools/tests/test_props.py -q` when schemas change. Render one still to check:
  use the sample project in T-verify notes below or a props file you write in the scratch dir, never overwrite renders.
- Stage/commit nothing; the main session commits. Do not touch files owned by other tasks.

## Ledger
| Task | Agent | Status |
|---|---|---|
| T1 foundation | worker-sonnet | done |
| T2 OfferCard | worker-sonnet | done |
| T3 Checklist | worker-sonnet | done |
| T4 PriceTag | worker-sonnet | done |
| T5 DateBadge | worker-sonnet | done |
| T6 CtaCard | worker-sonnet | done |
| T7 Captions box | worker-sonnet | done (check 2-line wrap; app toggle not added) |
| T8 usage --motion + skill | worker-sonnet | done (verify SKILL prop names vs final components) |

Order: T1 first (others import style.ts/Stamp/fonts). Then T2–T8 in parallel. T8 does not depend on T1.

## T1 — foundation
Files: `studio/src/fonts.ts`, `studio/src/assets/fonts/barlow-condensed/*` (woff2 + OFL.txt), new `studio/src/motion/style.ts`,
new `studio/src/motion/Stamp.tsx`, `studio/src/motion/registry.ts`.
- Bundle Barlow Condensed 800 + 900 (vietnamese, latin-ext, latin subsets) like Be Vietnam Pro; export `headingFamily`;
  include in `fontsReady`. Source: fontsource (`npm pack @fontsource/barlow-condensed` in a scratch dir, copy woff2) or Google Fonts.
- `style.ts`: `RADIUS` (18), `HARD_SHADOW(color)` → `18px 18px 0 color`, `CARD_RADIUS` (60), `SOFT_SHADOW`, `GLASS` style
  object (background rgba(11,21,48,.58) from brand background, backdropFilter blur(42px), border, radius 66),
  easing helpers (`backOut`, `inOut`), and a `stampImpact(frame, fps, startSec)` returning {scale, rotate, opacity, ring:{scale,opacity}, shake:{x,y}}
  matching the mockup's `stamp`/`ring`/`shake` keyframes.
- `Stamp.tsx`: exported drawing component `StampMark` ({shape:'round'|'rect', lines:string[] (round: top/big/bottom), color, size, start})
  rendering stamp + ring with `stampImpact`; and motion `Stamp` + `StampSchema` (shape choice, top optText, main text, bottom optText,
  size numDefault, delay numDefault) registered as `Stamp` title 'Con dấu', ownsExit true.
Done: tsc passes, a still of `Stamp` at impact+0.5s looks like the mockup stamp (red accent2, double ring, −12°).

## T2 — OfferCard (new)
File: `studio/src/motion/OfferCard.tsx` + one line in `registry.ts` (title 'Thẻ ưu đãi', description in Vietnamese, ownsExit true).
Schema: `label` optText('Nhãn nhỏ (VD: ƯU ĐÃI HỌC PHÍ)'), `title` text('Chữ chính'), `highlight` optText('Cụm được tô vàng (nằm trong chữ chính)'),
`stampTop` optText, `stampMain` text('Chữ to trên dấu (VD: 35%)'), `stampBottom` optText, `variant` choice card|giant (labels Vietnamese).
Look/motion: spec card 1 + mockup frame 1. `giant`: yellow slab with huge `stampMain` (Barlow 900) + label/title below, small stamp corner.
Done: tsc; stills of both variants at 1.5s.

## T3 — Checklist restyle
File: `studio/src/motion/Checklist.tsx`. Keep all existing props; add `variant` choice steps|grid (default steps).
steps = mockup frame 2 (yellow title block wipe, navy bars with yellow 01.. numbers, yellow hard shadow, indent 36px per step,
stagger by existing `interval`). grid = 2×2 navy tiles with big yellow number, pop stagger. Title optional as before.
Done: tsc; stills of both at end of stagger; existing storyboards still validate (props test).

## T4 — PriceTag restyle
File: `studio/src/motion/PriceTag.tsx`. Keep `price`, `old`, `note`, `size`, `fx`; `tilt` stays but default 0 (stamp has its own angle).
Add `stamp` optText('Chữ trên dấu', default 'ƯU ĐÃI'; empty = no stamp) and `variant` choice slam|countdown.
slam = mockup frame 3 (old price block drops + strike draws, yellow slab slams, `note` as navy tag, rect StampMark lands on slab corner).
countdown = slab shows digits counting from `old` to `price` (parse digits; if not parseable, fall back to slam) then stamp.
Done: tsc; stills both variants after stamp lands.

## T5 — DateBadge restyle
File: `studio/src/motion/DateBadge.tsx`. Keep `label`, `date`, `width`, `fx`; add `variant` choice slab|calendar; optional `sub` optText('Dòng phụ').
slab = mockup frame 4; calendar = white tile (navy top band with first part of date e.g. month text if `date` like "DD/MM", big day) + label/sub on the right.
Done: tsc; stills both.

## T6 — CtaCard restyle
File: `studio/src/components/CtaCard.tsx` only (read how it gets `cta` + `brand`). Look = mockup frame 5 (glass card bottom,
logo, pulsing yellow pill "ĐĂNG KÝ NGAY" or `cta.title` if set, phone with icon, fanpage), staggered entrance.
Never invent missing fields: hide a row whose value is empty.
Done: tsc; still of an existing project's last scene (e.g. projects/khoa-hoc-quang-cao-facebook) at CTA + 1s.

## T7 — Captions box
Files: `studio/src/components/Captions.tsx`, `studio/src/types.ts` (CaptionStyle gets `box?: boolean`), `config.json` (`captions.box: true`),
and wherever caption style is built in `tools/reel/props.py` (pass `box` through) + its test if any.
Box = navy `brand.colors.background` behind each line (`box-decoration-break: clone`, padding, radius 12), no heavy shadow when boxed.
Done: tsc; pytest tools/tests -q for props; still of a scene with caption.

## T8 — usage --motion + make-reel skill
Files: `tools/usage.py`, `tools/tests/test_usage.py`, `.claude/skills/make-reel/SKILL.md`, CLAUDE.md command list line.
- `python3 tools/usage.py --motion`: count projects using each `component/variant` (variant from props, else `default`) across
  scene-level and top-level `motion` layers of `projects/*/storyboard.json`; least-used first; then print "last project: <slug>: <combo>"
  (most recent storyboard mtime). Test with tmp dirs.
- SKILL.md "Thẻ và hiệu ứng chữ": add OfferCard (offer/discount, with stamp), Stamp, the variants, and the rule from spec Layer 3.
Done: pytest tools/tests/test_usage.py passes.

## Final review (main session, 2026-11-20)
- Full suites pass: tools pytest 64, studio tsc, app vitest 239 + tsc.
- Fixed in review: props.py OWNS_EXIT += OfferCard, Stamp; fit.ts `family` option so Barlow text is measured in Barlow (OfferCard, Checklist, DateBadge).
- Parked: ownsExit/self exit for Checklist, PriceTag, DateBadge (layer default fade applies); app Settings toggle for captions.box;
  2-line boxed captions overlap slightly (merged block look, not checked on a real long caption); old render-props need prepare.py to get `box`.
