# Watch & ask screen (Editor redesign): design

## Goal
Nobody who uses the app edits by hand: the owner and the staff watch the preview like CapCut and ask Claude/Codex in
the chat to make every change (user, 2026-11-21). Replace the Editor's manual-editing UI with a screen for three
things: watching the video, pointing at a moment, and chatting with the agent. It must work on PC and on a phone.

## Decisions
- **Approach:** rebuild the Editor screen in place, on the same route `/p/:slug`. Reuse the player in
  `PreviewPane`, the data loading and live refresh in `EditorContext`, and the chat panel. Delete the manual-editing
  UI.
  - Rejected: a second screen next to the old Editor. It means two screens to maintain, and nobody uses the old one.
  - Rejected: hiding the old UI with CSS. Its code would still run.
- **No manual editing** anywhere in the Editor, and no "advanced mode" toggle. The staff also only chat.
- **Chat docked on the right** on PC (the user picked this layout).
- **Live refresh already works and stays as is.** The server watches `projects/` (`app/server/watcher.ts`), and the
  Editor adopts a newer `storyboard.json` (`EditorContext.tsx`, `editorState.ts` `shouldAdopt`). A stale save from
  the app gets a 409 instead of overwriting (`app/server/store.ts`).
- **Branch:** `editor-watch` in the worktree `/home/giabao/dev/create-video-watch`, cut from `main` after the story
  template merge (`d86c5fe`), so no merge conflict is expected.

## Layout
The app's existing phone breakpoint is `max-width: 850px`.

**PC (> 850 px):**
- **Top bar.** Keep the breadcrumb and the "Xuất video" actions as they are: Bản render, Tạo giọng, Render (with the
  existing stale-voice confirm), and the ⋮ menu with Xoá dự án. Remove the save pill, the mix meter and the Chat
  button (the chat is always open here).
- **Centre.** The player, always on the whole video: remove the "Cảnh / Cả video" switch and the box-drag overlay.
  Under the player come the "Sửa chỗ này" button and the scene strip.
- **Right.** The docked chat at full height. Its width is fixed at 440 px, and the player takes the rest of the space. The
  chat has the same parts as today: the chat picker, new chat,
  messages, the input, and the account/model/effort pickers.

**Phone (≤ 850 px):**
- The top bar uses its existing compact form.
- The player sits on top with a capped height.
- The scene strip scrolls sideways under the player.
- The chat fills the rest of the screen, with its input at the bottom.
- No tabs: the current dock with Cảnh / Chỉnh sửa / Timeline is removed.

The stale-voice banner stays where it is today.

## Scene strip (`SceneStrip.tsx`, replaces `SceneList` and `Timeline`)
- One chip per scene plus one for the CTA. Each chip shows a thumbnail (same source as today's `SceneList`), the scene
  id and the length in seconds.
- Clicking a chip calls `seekToScene(id)`.
- The chip of the scene under the playhead is highlighted. The current frame comes from the player's frame events; the
  scene ranges come from the timings in `renderProps`.
- Read-only: no drag, no ⋯ menu, no "Thêm cảnh".

## "Sửa chỗ này"
- A button next to the player controls. A click does four things:
  - pauses the player;
  - reads the current frame `f`;
  - finds the scene at `f`;
  - appends `[cảnh <sceneId> · <m:ss.s> · khung <f>] ` to the chat input, keeping any text already typed, and focuses
    the input. In the CTA the tag reads `[CTA · <m:ss.s> · khung <f>] `.
- The button is disabled while there is no `renderProps`, for example when the preview has errors.
- Pure helpers (unit-tested):
  - `sceneAtFrame(renderProps, frame)` returns a scene id or `'cta'`.
  - `momentTag(scene, frame, fps)` returns the tag string. Time is `m:ss.s`, rounded down to a tenth of a second.
- Text reaches the chat through a small store in `app/src/api/chat.ts`: `insertChatText(text)`. It holds one pending
  string and uses the same subscribe/emit pattern as `setChatOpen`. The chat body consumes it into its input state.
  It works even while the agent is replying, since the user sends when ready.

## Chat
- Split `app/src/shell/ChatPanel.tsx` into two parts:
  - `ChatBody`: everything inside the drawer today;
  - a thin `Drawer` wrapper around it.
- The Editor renders `ChatBody` docked. `Layout` keeps the drawer on every other screen, including
  `/p/:slug/renders`, and does not mount it on the Editor route.
- **Default chat.** On a project route the default is the newest chat whose `slug` is this project. Today it is the
  newest chat of any project (`ChatPanel.tsx:18`). With no such chat, the first send creates one, as today
  (`create.mutateAsync({slug})`). Off project routes the default stays the newest chat overall.
- **System text** (`app/server/chat/service.ts` `systemAppend`). Append these English sentences:
  - The people using this app never edit by hand, so the agent makes every change itself (in `storyboard.json` or in
    code). That includes regenerating the voice after it changes `say`.
  - A tag `[cảnh <id> · m:ss.s · khung N]` (or `[CTA · …]`) points at that scene and frame of the current preview.
  - The agent can render a still at frame N to look at it (the CLAUDE.md "Still" command).

## Kept as is
- **`EditorContext`:** loading, the preview request, SSE adoption, `playerRef`, `seekToScene`, the `stale` list, and
  the flush before voice/render. Remove only the editing actions that have no caller left after the UI deletion
  (`tsc` and the tests decide).
- **Other screens:** the Renders screen, Projects, Library, Voices and Settings.
- **Server API:** routes only the old Editor used stay. The agent and other screens may use them.
- **Studio tests kept in `app/src/screens/Editor/`:** these tests check studio code, not Editor UI, so they and their
  helper modules stay where they are:
  - `choreo`, `glitch`, `musicDuck`, `storyLayout`, `textFx` and `withDefaults` tests;
  - `motionSchema.ts` with its test;
  - `editorState.ts` with its test (`shouldAdopt`).

## Removed
- **UI files and their CSS modules:**
  - `Inspector.tsx`, `InspectorCta.tsx`, `InspectorScene.tsx`, `InspectorVideo.tsx`;
  - `MotionLayerEditor.tsx`, `MotionForm.tsx`, `BoxOverlay.tsx`;
  - `MediaPicker.tsx`, `SfxSelect.tsx`, `MixMeter.tsx`;
  - `Timeline.tsx`, `SceneList.tsx`.
- **Helpers whose only callers were those files:** for example `timelineLayout.ts` and its test, if the strip doesn't
  use it.
- The code stays in git history.

## Error handling
- No `renderProps` (preview errors or still loading): the existing preview error display shows, and "Sửa chỗ này" is
  disabled.
- The agent edits the storyboard while the user watches: the preview refreshes through the existing SSE path. The
  player's position after a refresh is whatever the player does today; this design doesn't change it.
- `sceneAtFrame` past the last frame returns `'cta'`; before the first scene it returns the first scene.

## Testing
- **Unit tests** (vitest):
  - `momentTag`: `0` → `0:00.0`; `372` at 30 fps → `0:12.4`; `1859` at 30 fps → `1:01.9`; the CTA form.
  - `sceneAtFrame`: first frame, a scene boundary, inside the CTA, past the end.
  - `insertChatText`: two inserts append in order.
- **E2E** (`app/e2e/app.spec.ts`):
  - Replace "edit caption: autosave pill and player" with "watch screen". It checks that the player, the scene strip
    and the docked chat are visible, that a strip click seeks, and that "Sửa chỗ này" puts a tag in the chat input.
  - Adapt the selectors in "voice job then render" if buttons moved.
- **Commands:** `cd app && npm test && npx tsc --noEmit`, then `npm run e2e`.
- **Screenshots** of `/p/<slug>` at 1440×900 and 390×844 for the user.

## Out of scope
- The "max" effects kit (its own spec, after `story-template` merges).
- Changes to the Renders screen and to the voice/TTS flow.
- Chat features beyond docking, the per-project default and the tag. In particular, no image attachments: the agent
  renders its own still.
- Removing server routes.

## Done
- `/p/:slug` shows the player, the scene strip, "Sửa chỗ này" and the docked chat on PC, and the stacked layout on
  phone. No manual-editing control is left.
- A tag from "Sửa chỗ này" lands in the chat input, and the agent's system text explains it.
- Unit, typecheck and E2E tests pass.
- Screenshots at both widths are shown to the user.
