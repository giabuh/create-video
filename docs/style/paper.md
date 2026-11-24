# Paper style bar (default look of `explainer`)

Source: `reference/paper/sheets-claude-screencast.webm` (1920x1080, 2:08, no audio; contact sheets `sheet_1..4.jpg` beside it).
It is the quality bar, not a template to copy: never reuse the reference creator's footer text, product names or app logos.
First video in this look: `projects/2026-11-24-tin-hoc-van-phong-giay` (user: "tạm ổn", 2026-11-24).
Turned on by `look.style: "paper"` (`config.json` `templates.explainer.look`); `"style": "clean"` in a storyboard gets the
old white-card look of `docs/style/explainer.md`, whose principles (footage first, one idea = one visual, build-up,
text >= 20 px at 1080p) still apply here.

## Look
- **Canvas** (`studio/src/paper/PaperCanvas.tsx`): cream paper with faint grain, L-shaped crop marks in the corners,
  4 palette squares bottom-right. Pure-motion pages add a serif title top-left, an ink tag chip with tape, and a small mono
  footer (`<BRAND> · <TOPIC>`, short so it never touches the captions).
- **Cards** (`studio/src/paper/paper.tsx`: `PaperCard`, `Chip`, `Title`, `Tape`, `PAPER`): cream fill, thin ink outline,
  small radius, a hard halftone-dot shadow offset bottom-right, a washi-tape strip on top. Never soft blurred shadows
  or glass. Over footage: `backdrop: "none"`.
- **Type**: titles in upright bold serif (Fraunces 700, `PAPER.serif`); chips/labels/numbers in mono (JetBrains Mono 700,
  `PAPER.mono`); body in Be Vietnam Pro. Captions: white Be Vietnam Pro 700 with an ink outline, no card.
- **Palette roles**: terra = the accent (chips, hand-drawn circle, result card); ink = text, outlines, dark chips;
  sage / blue / purple = one meaning each (e.g. one formula reference each), matched between a label and what it points at.
- **Logo**: small paper plate top-right (page titles own top-left); the CTA card carries its own logo.
- **Illustrative content** (mock sheets, letters, names, numbers) gets a terra "Minh họa" chip.

## Motion
- Cards drop in with a small tilt that settles; the tape lands a beat later; list items pop one by one with the voice.
- A **labelled cursor** ("Bạn") glides to what the voice names; its tag never covers the value being discussed.
- **Hand-drawn circle** (irregular terra ellipse, stroke draws itself) on the one thing that matters.
- **Colour links**: a reference in a formula/label takes the colour of the cell/box it points to.
- **Continuity**: the same object (one sheet, one page) persists and changes state across scenes; it shrinks beside
  footage instead of cutting to a new picture. Beats are seconds from the layer start (`-1` never, `0` already done).
- Numbers change with a short flash and count to the new value, recomputing in a chain.
- Chapter card "Việc x / y" with progress dots marks each skill, placed where the voice introduces it, away from faces.

## Check before showing a still
Footage frames free of unconfirmed phone numbers/URLs on walls; cards off faces and the logo plate; nothing in the
bottom caption band; "Minh họa" on every mock; text >= 20 px; one accent circle per moment.
