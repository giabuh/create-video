# Components for 2026-11-24-tin-hoc-van-phong-giay ("paper / zine" style trial)

Landscape 1920x1080, template `explainer` with storyboard `look.style: "paper"`. Concepts: `storyboard.json` `notes.concepts`.

## Style (from the reference screencast; this is the bar, not docs/style/explainer.md)
- Cream paper canvas; cards are cream with a thin ink outline, small radius, a HARD halftone-dot shadow offset to the
  bottom-right, and a washi-tape strip on top. Upright bold serif titles (Fraunces), mono chips/labels (JetBrains Mono).
- Palette roles: terra = main accent (chips, hand-drawn circle, result card); ink = text, outlines, dark chips;
  sage / blue / purple = semantic colours (one meaning each, e.g. one formula reference each).
- Motion: elements drop/pop in one by one with the voice, short ease-out, small travel, slight tilt settling;
  hand-drawn circle draws itself (stroke-dashoffset), a labelled cursor ("Bạn") moves to what is being discussed,
  numbers change with a short flash. One thing moves at a time. Calm, never bouncy-cartoon.
- Use the shared primitives in `studio/src/paper/paper.tsx` (`PAPER`, `paperDims`, `PaperCard`, `Chip`, `Title`, `Tape`).
  Do not invent another card/tape/shadow style. Fonts: `PAPER.serif`, `PAPER.mono` (weight 700 only), body text `fontFamily`
  from `studio/src/fonts.ts` (Be Vietnam Pro 400/700/800).
- No brand logos of Microsoft/Google. No text below ~20 px at 1080p. Vietnamese diacritics need line-height >= 1.25.

## Contract (all components)
- Files live in `studio/src/videos/2026-11-24-tin-hoc-van-phong-giay/<Name>.tsx`, export `<Name>` and `<Name>Schema`
  (zod via helpers in `studio/src/motion/schema.ts`, Vietnamese `title`s). Already registered in `index.ts` there
  (do not edit index.ts; stubs exist, replace them).
- Props arrive with `brand`, `layerSeconds`, `area: {width,height}` (px of the full frame, band or box the layer is in).
- Size everything from the area (design at a fixed internal size and `scale` to fit the area is fine).
- Beat props are seconds from the layer start: `-1` = never happens, `0` = already done when the layer starts.
- The component owns its exit: fade/drop out over the last ~0.25 s of `layerSeconds`.
- `useCurrentFrame()/useVideoConfig()` from remotion for time. Deterministic (no Math.random; seed by index).

## PaperNote (corner card over footage)
Props: `variant` step|list|note; `chip` text; `chipColor` terra|ink; `title` optText; `sub` optText;
`icon` none|sheet|doc|letter|calc|warn|chat; `step` num (1); `total` num (3); `items` lines, each "icon|Label";
`align` left|right (which side of the area the card hugs).
- step: [icon in a coloured circle] [chip "Việc 1 / 3" + progress dots (done = ink filled, current = terra, rest hollow)] / title (serif).
- list: chip on top (ink), then items in a row: coloured circle icon + label under it; items pop in one by one (~0.15 s stagger).
- note: chip + title + optional sub line (muted).
- Icons: simple line SVGs drawn in code (grid for sheet, page for doc, envelope for letter, calculator, warning triangle,
  chat bubble), white strokes inside a circle of sage/blue/purple/terra.
- Enter: drop from ~-20 px with tilt -3deg settling to -1deg, 0.4 s ease-out; tape lands 0.12 s later.

## PaperPage (full-frame canvas for pure-motion scenes) + `PaperCanvas` export
Props: `title` text ("Excel"); `tag` optText ("bảng tính có công thức thật"); `footer` optText
("TIN HỌC SAO VIỆT · TIN HỌC VĂN PHÒNG · BẢNG TÍNH"); `chip` optText ("Minh họa").
- Canvas: `PAPER.canvas` with very faint paper grain (SVG feTurbulence, low opacity), L-shaped crop marks in the 4 corners,
  footer bottom-left in small mono muted caps, 4 palette squares bottom-right (terra, ink, blue, sage).
- Title top-left in serif (~u*0.055), the tag next to it as an ink Chip with a tape look; `chip` (terra, small) under the title.
- Title/tag slide in from the left 0.4 s; canvas itself is static (no enter).
- Also export `PaperCanvas: React.FC<{width:number;height:number}>` = the canvas only (no title/footer text), used by the template.

## Template paper branch (same worker as PaperPage)
When `p.look?.style === 'paper'` (type already added in `studio/src/types.ts`), and ONLY then:
- `studio/src/templates/explainer/Explainer.tsx`: `empty()` renders `PaperCanvas`; the logo plate becomes a small paper card
  (no tape) instead of the white rounded plate.
- `ExplainerCaptions.tsx`: no card. White Be Vietnam Pro 700 text, ~u*0.04, centered near the bottom (~6% from the edge),
  with an ink outline/shadow strong enough to read on cream paper AND on footage (e.g. `paint-order: stroke` + text-shadow).
  Keep the current fit-to-two-lines logic. Highlight words: terra text.
- `ExplainerCta.tsx`: `PaperCanvas` background + a centered `PaperCard` (with tape): logo, `cta.title` in serif,
  phone/fanpage/address lines only when present (this video has none), a terra Chip with the brand name (`brand.name` if it exists).
- Without `look.style` everything renders exactly as before.

## SheetMock (the hero: spreadsheet on paper)
Props: `columns` lines (["Tháng","Thu","Chi","Còn lại"]); `rows` lines, each "label|income|cost" (Còn lại = income-cost,
computed by the component); `rowStart` num (4, first data row number in the row header); `unit` optText ("triệu đ",
shown at the left of the formula bar); `tag` optText ("Minh họa", a small terra chip by the sheet);
`totalRow` bool (adds a "Tổng" row with the sum of Còn lại); `formulaRow` num (0-based data row the formula is for;
default last); `editRow` num; `editTo` num (new income for editRow); `breakdown` bool (show the right-hand cards);
beats: `cursorAt`, `typeAt`, `circleAt`, `refsAt`, `breakdownAt`, `editAt`, `condAt`.
- Sheet window = `PaperCard` without tape: formula bar ("fx" + unit + formula), column letters A-D, row numbers,
  the header row, data rows, optional total row, a sheet tab at the bottom ("Bảng thu chi").
- cursorAt: an arrow pointer with an ink tag "Bạn" glides to the target cell (D of formulaRow), then later to B of editRow at editAt.
- typeAt: the formula `=B9-C9` (real cell names from rowStart+formulaRow) types into the formula bar char by char (~0.06 s/char),
  the target cell gets a sage outline and shows its value when typing ends.
- circleAt: a hand-drawn, slightly irregular terra ellipse draws itself around the formula bar (0.5 s).
- refsAt: inside the formula, B ref turns blue, C ref purple; the matching cells get same-colour outlines (stagger 0.15 s).
- breakdownAt (if `breakdown`): to the right of the sheet, cards drop in one by one: "thu  46" (blue outline),
  "chi  − 34" (purple outline), a rule, then a terra result card "D9 = 12".
- editAt: cursor moves to B of editRow, the value flips to `editTo` with a short flash, then Còn lại of that row and
  the Tổng row recompute (count to the new value, flash) in a chain top-to-bottom; breakdown cards update too.
- condAt: every Còn lại cell < 0 fills light red with red text (stagger), a hand-drawn circle around the first one,
  and a small chip "Còn lại < 0 → tô đỏ" appears above the sheet.
- Layout: full frame -> sheet left-centre (~55% width) + breakdown on the right, below the page title area
  (leave the top ~15% and bottom ~14% free for title and captions). In a small box -> scale to fit the area.

## DocMock (document page beside footage)
Props: `variant` toc|merge; beats `styleAt`, `tocAt` (toc), `fieldAt`, `fanAt`, `countAt` (merge);
`headings` lines (["Giới thiệu","Số liệu quý","Kết luận"]); `names` lines (["Chị Lan","Anh Minh","Cô Hạnh","Anh Tuấn"]);
`count` num (50); `tag` optText ("Minh họa").
- Page = `PaperCard` (with tape), A4-ish portrait, grey rounded body lines as text placeholders, fits the area.
- toc: headings start messy (different sizes, indents, one bold one not). styleAt: they snap to uniform serif headings with
  terra number chips 1/2/3 (stagger 0.15 s). tocAt: a "Mục lục" block builds at the top: each line = heading + dotted leader +
  page number, drawn in one by one, with a small sage chip "tự cập nhật".
- merge: a letter "Thư mời" with the greeting "Kính gửi «Tên»" where «Tên» is a terra field chip. fieldAt: hand-drawn
  circle around the field. fanAt: copies fan out behind/right of the template (offset + small rotations), each showing
  one of `names` in the field. countAt: a terra counter chip "× 1" counts up to `× {count}`.

## Verify (each worker, for its own component)
1. `cd studio && npx tsc --noEmit 2>&1 | grep -E "videos/2026-11-24|paper/|templates/explainer" ` -> no errors in your files
   (other workers are editing sibling files at the same time; ignore errors that are only in their files).
2. Make a scratch project `projects/_t-<name>/storyboard.json` (copy `video`, `template`, `brand`, `look` from the real
   storyboard; one or two silent scenes with `"duration": 6`, no `say`; your component as a `motion` layer with real props
   and beats; for PaperNote put footage under it: `"media":[{"src":"video-ngang-hoc-vien-thuc-hanh-excel-va-word.mp4"}]`
   and a `box`, `"backdrop":"none"`). Run `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/_t-<name>`, then
   `cd studio && npx remotion still Reel ../projects/_t-<name>/s.png --frame=<n> --props=../projects/_t-<name>/render-props.json`
   at 3-4 frames (before/during/after beats). Look at every still: no overflow, diacritics intact (e.g. "Tính toán số liệu"),
   text >= 20 px. Delete `projects/_t-<name>/` when done.
