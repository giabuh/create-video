# Editor voice picker — short design

## Intent
New videos keep the default voice (`config.json` `defaults.voice`, currently `phuong`). The user wants to
switch an existing video to another voice from the Editor and render it again, without editing files.

## Approach (the only sensible one)
A "Giọng" select in the Editor top bar, before "Tạo giọng". Options = `GET /voices`; value =
`storyboard.voice`, falling back to the voice with `isDefault`. Changing it sets `storyboard.voice` through
the existing autosave (this video only; never touches `config.json`).

Everything after that already exists: the voice cache key includes the reference audio, so the preview that
runs after the save marks every spoken scene stale → stale banner + "Tạo giọng và render" confirm. Render
writes a new `reel-vN`; old renders are kept.

Rejected: per-scene voice, rendering several voices in one go (not asked for).

## Details
- `EditorCtx` gains `update(fn)` to change the storyboard (autosave picks it up).
- The select is disabled while a voice/render/delete job runs for the project.
- Compact (narrow) top bar: select stays visible next to the "Xuất video" menu.
