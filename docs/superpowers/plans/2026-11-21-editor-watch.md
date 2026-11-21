# Watch & Ask Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app Editor's manual-editing UI with a screen for watching the video, pointing at a moment
("Sửa chỗ này") and chatting with Claude/Codex in a docked chat. It must work on PC and phone.

**Architecture:** The Editor is rebuilt in place on the route `/p/:slug`.
- It keeps the existing pieces: the `PreviewPane` player, the `EditorContext` data and live refresh, and the
  `TopBar` export actions.
- The chat panel's content moves into a reusable `ChatBody`. The Editor docks it on the right; other screens keep the
  drawer.
- A read-only `SceneStrip` replaces `SceneList` and `Timeline`.
- A small store in `app/src/api/chat.ts` carries the "Sửa chỗ này" tag into the chat input.

**Tech Stack:**
- React 19, react-router, TanStack Query and `@remotion/player`, with CSS modules.
- vitest (node environment, so no DOM tests) and Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-11-21-editor-watch-design.md`

## Global Constraints

- **Where to work.** Only in the worktree `/home/giabao/dev/create-video-watch`, on branch `editor-watch`.
  - Never edit, commit in, or run git commands that change `/home/giabao/dev/create-video`. That is the main tree,
    and the user's app runs from it on ports 5316/5317.
  - It may be used read-only as `REEL_ROOT` for E2E (Task 5).
- **No manual-editing control** anywhere in the Editor, and no "advanced mode" toggle.
- **Sizes.** The phone breakpoint is `@media (max-width: 850px)`. The docked chat is 440 px wide on PC.
- **Tag format, exactly:**
  - `[cảnh <sceneId> · <m:ss.s> · khung <f>] ` for a scene;
  - `[CTA · <m:ss.s> · khung <f>] ` in the CTA;
  - both end with a trailing space. Time is rounded down to a tenth of a second, `·` is U+00B7, and `f` is the integer
    frame.
- **Language.** UI text is Vietnamese; code, comments and commit messages are English.
- **Commits.** A single-line message and no Co-Authored-By trailer. Stage only your own files, by explicit path.
- **No new dependencies.** Do not change the server routes. Do not change the Renders, Projects, Library, Voices or
  Settings screens, apart from the chat mounting in `app/src/shell/Layout.tsx`.
- **Keep these files in `app/src/screens/Editor/`.** They test studio code:
  - `choreo.test.ts`, `glitch.test.ts`, `musicDuck.test.ts`, `storyLayout.test.ts`, `textFx.test.ts`,
    `withDefaults.test.ts`;
  - `motionSchema.ts` and `motionSchema.test.ts`;
  - `editorState.ts` and `editorState.test.ts`.
- **Testing cadence.** Per task, run only the tests for the files you touched plus `cd app && npx tsc --noEmit`. The
  full suite runs once at the final review.

---

### Task 1: Worktree setup, moment helpers, chat insert store

**Files:**
- Create: `app/src/screens/Editor/moment.ts`
- Create: `app/src/screens/Editor/moment.test.ts`
- Modify: `app/src/api/chat.ts` (append the insert store after `useChatDraft`, around line 61)
- Modify: `app/src/api/chat.test.ts` (append one `describe`)

**Interfaces:**
- Produces:
  - `sceneAtFrame(props: RenderProps | null, frame: number): string | null`. It returns a scene id or `'cta'`.
  - `momentTag(scene: string, frame: number, fps: number): string`.
  - `insertChatText(text: string): void`, `useChatInsert(): string` and `takeChatInsert(): string`.

- [ ] **Step 1: Install dependencies in the worktree** (it has no `node_modules`)

```bash
cd /home/giabao/dev/create-video-watch/studio && npm ci
cd /home/giabao/dev/create-video-watch/app && npm ci
```
Expected: both finish without errors. App tests import studio code through the `@studio` alias, so both are needed.

- [ ] **Step 2: Write the failing tests**

`app/src/screens/Editor/moment.test.ts`:
```ts
import {describe, expect, it} from 'vitest';
import type {RenderProps} from '@studio/types';
import {momentTag, sceneAtFrame} from './moment.ts';

const props = {
  fps: 30, totalSeconds: 13,
  scenes: [{id: 'a', start: 0, duration: 4}, {id: 'b', start: 4, duration: 6}],
  cta: {title: 'x', duration: 3},
} as unknown as RenderProps;

describe('sceneAtFrame', () => {
  it('first frame is the first scene', () => expect(sceneAtFrame(props, 0)).toBe('a'));
  it('a scene start belongs to that scene', () => expect(sceneAtFrame(props, 120)).toBe('b'));
  it('last frame before the boundary stays in the previous scene', () => expect(sceneAtFrame(props, 119)).toBe('a'));
  it('after the last scene is the CTA', () => expect(sceneAtFrame(props, 300)).toBe('cta'));
  it('past the end is the CTA', () => expect(sceneAtFrame(props, 9999)).toBe('cta'));
  it('without a CTA, past the end is the last scene', () => expect(sceneAtFrame({...props, cta: null}, 9999)).toBe('b'));
  it('no props or no scenes gives null', () => {
    expect(sceneAtFrame(null, 0)).toBeNull();
    expect(sceneAtFrame({...props, scenes: []}, 0)).toBeNull();
  });
});

describe('momentTag', () => {
  it('frame 0', () => expect(momentTag('mo-dau', 0, 30)).toBe('[cảnh mo-dau · 0:00.0 · khung 0] '));
  it('exact tenth', () => expect(momentTag('kem-1-1', 372, 30)).toBe('[cảnh kem-1-1 · 0:12.4 · khung 372] '));
  it('rounds down past a minute', () => expect(momentTag('b', 1859, 30)).toBe('[cảnh b · 1:01.9 · khung 1859] '));
  it('CTA form', () => expect(momentTag('cta', 780, 30)).toBe('[CTA · 0:26.0 · khung 780] '));
});
```

Append to `app/src/api/chat.test.ts` (merge the new names into the existing import line from `./chat.ts`):
```ts
describe('chat insert store', () => {
  it('appends inserts in order and empties on take', () => {
    insertChatText('[cảnh a · 0:01.0 · khung 30] ');
    insertChatText('[cảnh b · 0:05.0 · khung 150] ');
    expect(takeChatInsert()).toBe('[cảnh a · 0:01.0 · khung 30] [cảnh b · 0:05.0 · khung 150] ');
    expect(takeChatInsert()).toBe('');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd /home/giabao/dev/create-video-watch/app && npx vitest run src/screens/Editor/moment.test.ts src/api/chat.test.ts`
Expected: FAIL, because `./moment.ts` is not found and `insertChatText` is not exported.

- [ ] **Step 4: Implement**

`app/src/screens/Editor/moment.ts`:
```ts
import type {RenderProps} from '@studio/types';

/** Scene id (or 'cta') shown at `frame`: the last scene starting at or before it; after the scenes, the CTA. */
export function sceneAtFrame(props: RenderProps | null, frame: number): string | null {
  if (!props || props.scenes.length === 0) return null;
  const t = frame / props.fps;
  const last = props.scenes[props.scenes.length - 1];
  if (props.cta && t >= last.start + last.duration) return 'cta';
  let id = props.scenes[0].id;
  for (const sc of props.scenes) if (sc.start <= t) id = sc.id;
  return id;
}

/** Chat tag for a moment of the preview, e.g. "[cảnh kem-1-1 · 0:12.4 · khung 372] " (time rounded down to 0.1 s). */
export function momentTag(scene: string, frame: number, fps: number): string {
  const tenths = Math.floor((frame * 10) / fps); // integer numerator avoids 0.1 float drift
  const m = Math.floor(tenths / 600), sec = Math.floor((tenths % 600) / 10), d = tenths % 10;
  const label = scene === 'cta' ? 'CTA' : `cảnh ${scene}`;
  return `[${label} · ${m}:${String(sec).padStart(2, '0')}.${d} · khung ${frame}] `;
}
```

Append to `app/src/api/chat.ts`. It uses the module's existing `subscribe`/`emit` and `useSyncExternalStore`:
```ts
// Text queued for the chat input (the Editor's "Sửa chỗ này"); the chat body takes it into its input.
let insert = '';
export function insertChatText(text: string): void { insert += text; emit(); }
export const useChatInsert = (): string => useSyncExternalStore(subscribe, () => insert);
export function takeChatInsert(): string { const t = insert; insert = ''; if (t) emit(); return t; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /home/giabao/dev/create-video-watch/app && npx vitest run src/screens/Editor/moment.test.ts src/api/chat.test.ts && npx tsc --noEmit`
Expected: PASS, and `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
cd /home/giabao/dev/create-video-watch
git add app/src/screens/Editor/moment.ts app/src/screens/Editor/moment.test.ts app/src/api/chat.ts app/src/api/chat.test.ts
git commit -m "Add moment tag helpers and chat insert store"
```

---

### Task 2: Reusable ChatBody, per-project default chat, agent system text

**Files:**
- Create: `app/src/shell/ChatBody.tsx`, with everything `ChatPanel` renders today.
- Modify: `app/src/shell/ChatPanel.tsx`. It becomes a thin `Drawer` around `ChatBody`.
- Modify: `app/src/shell/ChatPanel.module.css` (or whichever CSS module `ChatPanel.tsx` imports as `s`), so that
  `ChatBody` fills its container.
- Modify: `app/server/chat/service.ts:12-14` (`systemAppend`).

**Interfaces:**
- Consumes: `useChatInsert()` and `takeChatInsert()` from Task 1.
- Produces: `ChatBody({active}: {active: boolean}): React.JSX.Element`. `active` means the panel is visible: the drawer
  passes `open`, the docked Editor passes `true`. It renders the whole column: the header (chat picker, "Phiên mới",
  account/model/effort), the scrolling log, and the input footer.

- [ ] **Step 1: Move the body.** Create `ChatBody.tsx` with the hooks, state and JSX from `ChatPanel.tsx`.
  - Move lines 11–91 (hooks and `submit`), plus the drawer's children and footer, into one flex column:
    `head` → `log` (flex: 1, overflow auto) → `foot`.
  - Replace `open` with the `active` prop in the focus effect (`ChatPanel.tsx:72`).
  - Keep every existing behaviour: picker, new Claude/Codex session, account/model/effort, Enter to send, Dừng,
    limit errors, interrupted note, draft spinner, scroll to the end.

- [ ] **Step 2: Default chat per project.** Replace `ChatPanel.tsx:18`:
```ts
const chatId = picked ?? chats.data?.[0]?.id ?? null; // newest by default
```
with:
```ts
// newest chat of this project on project routes (newest of any project elsewhere)
const own = slug ? chats.data?.find((c) => c.slug === slug) : chats.data?.[0];
const chatId = picked ?? own?.id ?? null;
```
`chats.data` is already newest first. With no chat for the project, `chatId` is null, and `submit` already creates one
with `create.mutateAsync({slug})`.

- [ ] **Step 3: Take inserted text.** In `ChatBody`, after the `text` state:
```ts
const pending = useChatInsert();
useEffect(() => {
  if (!pending) return;
  const t = takeChatInsert();
  setText((cur) => (cur === '' || cur.endsWith(' ') || cur.endsWith('\n') ? cur + t : `${cur} ${t}`));
  inputRef.current?.querySelector('textarea')?.focus();
}, [pending]);
```

- [ ] **Step 4: Thin drawer.** `ChatPanel.tsx` keeps its export and props:
```tsx
export function ChatPanel({open, onOpenChange}: {open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element {
  return <Drawer open={open} onOpenChange={onOpenChange} title="Chat" width={640}><ChatBody active={open} /></Drawer>;
}
```
The old title named the engine (`Chat với ${engineName}`). If you keep the engine name visible, show it inside
`ChatBody`'s header instead. `ChatBody` must fill the drawer body's height, so that the log scrolls and the input stays
at the bottom: check the `Drawer` component's body styles in `app/src/ui/` and adjust `ChatBody`'s root CSS (height
100%, min-height 0).

- [ ] **Step 5: Agent system text.** In `app/server/chat/service.ts`, append to the `systemAppend` string, after the
  current second line, in English:
```ts
  ` The people using this app never edit by hand: make every change yourself (storyboard.json or code), and regenerate the voice after you change a scene's \`say\`.` +
  ` A tag like "[cảnh <id> · m:ss.s · khung N]" or "[CTA · m:ss.s · khung N]" points at that scene and frame of the current preview; you can render a still at frame N (CLAUDE.md "Still" command) to look at it.`
```
Keep the existing text unchanged before it.

- [ ] **Step 6: Verify.**
  - Run: `cd /home/giabao/dev/create-video-watch/app && npx vitest run src/api/chat.test.ts src/shell server/chat && npx tsc --noEmit`.
    Expected: PASS, and `tsc` exits 0.
  - The drawer is still mounted on every screen, the Editor included, until Task 4. Behaviour must be unchanged
    apart from the per-project default and the inserted text.

- [ ] **Step 7: Commit**

```bash
cd /home/giabao/dev/create-video-watch
git add app/src/shell/ChatBody.tsx app/src/shell/ChatPanel.tsx app/src/shell/*.module.css app/server/chat/service.ts
git commit -m "Split chat into a reusable ChatBody, default to the project's chat, explain moment tags to the agent"
```
Stage only the CSS module you changed, not a glob, if more than one exists.

---

### Task 3: SceneStrip and "Sửa chỗ này" in a whole-video player

**Files:**
- Create: `app/src/screens/Editor/SceneThumb.tsx`. Move `Thumb` (with `IMAGE`, `url` and its `.thumb`/`.swatch` CSS)
  out of `SceneList.tsx`.
- Create: `app/src/screens/Editor/SceneThumb.module.css`.
- Create: `app/src/screens/Editor/SceneStrip.tsx` and `app/src/screens/Editor/SceneStrip.module.css`.
- Modify: `app/src/screens/Editor/SceneList.tsx`. It imports `Thumb` from `SceneThumb.tsx` until Task 4 deletes it.
- Modify: `app/src/screens/Editor/PreviewPane.tsx`.
- Modify: `app/src/screens/Editor/Editor.tsx`. Render `<SceneStrip />` where `<Timeline />` is now; Task 4 does the
  final layout.

**Interfaces:**
- Consumes:
  - `sceneAtFrame` and `momentTag` from `./moment.ts`;
  - `insertChatText` from `../../api/chat.ts`;
  - `useEditor()`: `storyboard`, `renderProps`, `playerRef`, `seekToScene`.
- Produces:
  - `SceneStrip(): React.JSX.Element`;
  - `Thumb({scene, bg}: {scene: SceneSpec; bg: string | undefined})`, exported from `SceneThumb.tsx`.

- [ ] **Step 1: SceneThumb.** Move `Thumb` with its helpers and CSS verbatim, export it, and update `SceneList.tsx`
  to import it. The `bg` value comes from where `SceneList` gets it today (`useConfig`); keep that call in the
  caller.

- [ ] **Step 2: SceneStrip.** A horizontal list of chips:
  - one chip per `storyboard.scenes` entry, plus a "CTA" chip when `renderProps?.cta` exists;
  - each chip shows `<Thumb>`, the scene id and the length (`fmtSec` from `../../ui/index.ts`, computed from
    `sceneRange(renderProps, id)` in `./editorState.ts`).
  - Chips are `<button type="button">` with `aria-label={`Tới cảnh ${id}`}` (`'Tới CTA'` for the CTA).
  - A click calls `seekToScene(id)` (`seekToScene('cta')` already works through `sceneRange`).
  - **Current chip.** Track the player frame through `playerRef.current` events `frameupdate` and `seeked`, attached
    when the player exists, the same way `PreviewPane.tsx:31-41` does. Mark the chip of
    `sceneAtFrame(renderProps, frame)` with `aria-current="true"` and a highlighted style.
  - **Behaviour.** The strip scrolls sideways (`overflow-x: auto`) and the current chip stays in view
    (`scrollIntoView({block: 'nearest', inline: 'nearest'})` when it changes). No drag, menus or add button.
  - Render nothing while `renderProps` is null.

- [ ] **Step 3: PreviewPane, whole video only.**
  - Remove the `Mode` type, `mode` state and the `Segmented` "Cảnh / Cả video" bar.
  - Remove the `range`/`inFrame`/`outFrame`/`loopOk` logic and the `inFrame`/`outFrame`/`loop` props. The player
    always plays the whole video, with `loop={false}`.
  - Remove `<BoxOverlay />` and its import.
  - Keep the "Đang cập nhật…" hint (it moves to where the bar was), the error list, the skeleton and the stale banner.
  - The empty storyboard state no longer offers "+ Thêm cảnh". Show `EmptyState` with the title "Chưa có cảnh nào"
    and the description "Nhắn Claude/Codex ở khung chat để dựng cảnh đầu tiên.", and no action.

- [ ] **Step 4: "Sửa chỗ này".** In the transport row of `PreviewPane`, after the fullscreen button:
```tsx
<Button size="sm" icon={<MessageSquarePlus size={16} aria-hidden />} disabled={!renderProps} onClick={() => {
  const p = playerRef.current;
  if (!p || !renderProps) return;
  p.pause();
  const f = p.getCurrentFrame();
  const scene = sceneAtFrame(renderProps, f);
  if (scene) insertChatText(momentTag(scene, f, renderProps.fps));
}}>Sửa chỗ này</Button>
```
`MessageSquarePlus` comes from `lucide-react`, which is already a dependency.

- [ ] **Step 5: Verify**
  - Run: `cd /home/giabao/dev/create-video-watch/app && npx vitest run src/screens/Editor && npx tsc --noEmit`.
    Expected: PASS, and `tsc` exits 0.
  - Check that `useEditor()` fields other code still reads (`selectedId` in `SceneList`/`Inspector`) still compile.
    Task 4 removes them.

- [ ] **Step 6: Commit**

```bash
cd /home/giabao/dev/create-video-watch
git add app/src/screens/Editor/SceneThumb.tsx app/src/screens/Editor/SceneThumb.module.css app/src/screens/Editor/SceneStrip.tsx app/src/screens/Editor/SceneStrip.module.css app/src/screens/Editor/SceneList.tsx app/src/screens/Editor/SceneList.module.css app/src/screens/Editor/PreviewPane.tsx app/src/screens/Editor/Editor.tsx
git commit -m "Add read-only scene strip and the Sửa chỗ này tag; preview always plays the whole video"
```

---

### Task 4: Watch & ask layout, docked chat, removal of the editing UI

**Files:**
- Modify: `app/src/screens/Editor/Editor.tsx`, `app/src/screens/Editor/Editor.module.css`,
  `app/src/screens/Editor/TopBar.tsx`, `app/src/screens/Editor/TopBar.module.css` and
  `app/src/screens/Editor/EditorContext.tsx`.
- Modify: `app/src/shell/Layout.tsx`.
- Delete:
  - `Inspector.tsx`, `Inspector.module.css`, `InspectorCta.tsx`, `InspectorScene.tsx`, `InspectorVideo.tsx`;
  - `MotionLayerEditor.tsx`, `MotionForm.tsx`, `BoxOverlay.tsx`, `BoxOverlay.module.css`;
  - `MediaPicker.tsx`, `SfxSelect.tsx`, `MixMeter.tsx`, `MixMeter.module.css`;
  - `Timeline.tsx`, `Timeline.module.css`, `SceneList.tsx`, `SceneList.module.css`.

  All of them are in `app/src/screens/Editor/`.
- Delete only if nothing imports them after the deletions above (check with `grep -rn`): `timelineLayout.ts` and
  `timelineLayout.test.ts`, plus any other non-test helper whose only importers were deleted files. Never delete the
  files listed under Global Constraints.

**Interfaces:**
- Consumes: `ChatBody` from Task 2, and `SceneStrip`/`PreviewPane` from Task 3.
- Produces: the final Editor screen.

- [ ] **Step 1: Editor.tsx.** Replace `EditorBody` with:
```tsx
function EditorBody(): React.JSX.Element {
  useEditorKeys();
  return (
    <div className={s.root}>
      <TopBar />
      <div className={s.work}>
        <div className={s.center}><PreviewPane /><SceneStrip /></div>
        <aside className={s.chat} data-chat-docked aria-label="Chat"><ChatBody active /></aside>
      </div>
    </div>
  );
}
```
- `useEditorKeys` keeps only Space to play/pause, with the same `OWN_SPACE` guard. Remove Ctrl+S and the ArrowUp/Down
  scene selection.
- Remove the `Panel` type, the `Segmented` dock and the `#editor-timeline` block.
- In the loading skeleton, drop the left and right columns: one centre skeleton and one chat-column skeleton.

- [ ] **Step 2: Editor.module.css.** Rewrite the layout rules. The existing CSS custom properties and tokens stay.
  - **PC:**
    - `.root` is a flex column filling the main area.
    - `.work` is `display: grid; grid-template-columns: minmax(0, 1fr) 440px; flex: 1; min-height: 0`.
    - `.center` is a flex column: the player takes the free height, and the strip sits under it.
    - `.chat` gets `border-left: 1px solid var(--line)` (use the token the old `.right` column used),
      `min-height: 0` and `display: flex`.
  - **`@media (max-width: 850px)`:**
    - `.work` becomes one column (`grid-template-columns: 1fr; grid-template-rows: auto auto minmax(0, 1fr)`).
    - The player height is capped at `45vh`, and the strip stays one scrolling row.
    - `.chat` fills the rest, with no left border and a top border instead.
    - The page itself must not need to scroll to reach the chat input at 390×844.
  - Delete the rules for removed classes (`.left`, `.right`, `.dock`, `.panels`, `.timeline`, `data-panel`).

- [ ] **Step 3: TopBar.tsx.**
  - Remove `SavePill`, both `MixMeter` uses (`.mixWrap` and the `.mixMenu` popover) and the "Chat" button.
  - Remove their imports (`MixMeter`, `setChatOpen`, `ChartPie`, `MessageSquare`, `mixOf` if unused).
  - Keep everything else: breadcrumb, "Xuất video" menu, Bản render, Tạo giọng, Render with the stale-voice confirm
    and `save.flush()`, ⋮ Xoá dự án, render progress and the deleting banner.
  - Delete the now unused CSS rules in `TopBar.module.css`.

- [ ] **Step 4: EditorContext.tsx.** After the deletions, grep each `EditorCtx` field for consumers outside
  `EditorContext.tsx`.
  - Remove the fields, and their state and callbacks, that have no consumer left: expected `select`/`selectedId`,
    `layer`/`selectLayer`, `addSceneAt` and the exported `layerAt`/`withLayer` helpers if unused.
  - Keep `save` (`TopBar` flushes before render), the storyboard adoption logic, `renderProps`, `stale`, `errors`,
    `previewing`, `previewOk`, `playerRef` and `seekToScene`.

- [ ] **Step 5: Layout.tsx.**
```tsx
const focusDockedChat = () => document.querySelector<HTMLTextAreaElement>('[data-chat-docked] textarea')?.focus();
// ...inside Layout():
const openChat = editor ? focusDockedChat : () => setChatOpen(true);
useEffect(() => { if (editor) setChatOpen(false); }, [editor]); // the Editor docks its own chat
// ...in JSX, mount the drawer only off the Editor:
{!editor && <ChatPanel open={chatOpen} onOpenChange={setChatOpen} />}
```
Move the existing `const editor = useMatch('/p/:slug') !== null;` above `openChat`. Add `useEffect` to the `react`
import.

- [ ] **Step 6: Delete the files** listed above with `git rm`, then grep `app/src` for each removed module name to
  confirm that nothing imports it.

- [ ] **Step 7: Verify**
  - Run: `cd /home/giabao/dev/create-video-watch/app && npx vitest run src/screens/Editor src/shell src/api && npx tsc --noEmit`.
    Expected: PASS, and `tsc` exits 0. Kept studio tests in `src/screens/Editor` still pass.
  - Run: `cd /home/giabao/dev/create-video-watch/app && npx vite build`. Expected: the build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /home/giabao/dev/create-video-watch
git add -A app/src/screens/Editor app/src/shell/Layout.tsx
git commit -m "Editor becomes the watch & ask screen: docked chat, scene strip, no manual editing"
```
Before committing, check with `git status` that `-A` staged only files under those two paths.

---

### Task 5: E2E for the watch screen, run on side ports, screenshots

**Files:**
- Modify: `app/e2e/app.spec.ts`.

**Interfaces:**
- Consumes:
  - the Editor from Task 4;
  - `REEL_UI_URL`, already read by `app/playwright.config.ts`;
  - `REEL_API_PORT`/`REEL_UI_PORT`, already read by `app/server/index.ts` and `app/vite.config.ts`;
  - `REEL_ROOT`, already read by `app/server/paths.ts` and by the spec.

- [ ] **Step 1: API URL from env.** Replace `app/e2e/app.spec.ts:7`
  (`const API = 'http://127.0.0.1:5316/api';`) with:
```ts
const API = `${process.env.REEL_API_URL ?? 'http://127.0.0.1:5316'}/api`;
```

- [ ] **Step 2: Replace the test 'edit caption: autosave pill and player'** with:
```ts
test('watch screen: player, scene strip, docked chat and the Sửa chỗ này tag', async ({page}) => {
  await page.goto(`/p/${slug}`);
  const player = page.getByRole('region', {name: 'Xem trước'});
  const ask = page.getByRole('button', {name: 'Sửa chỗ này'});
  await expect(ask).toBeEnabled({timeout: 30_000}); // enabled only once renderProps exist
  const chat = page.getByLabel('Chat', {exact: true}); // exact: the nav's "Chat với Claude" button also matches
  await expect(chat).toBeVisible();
  await expect(page.getByLabel(/Caption/)).toHaveCount(0); // no manual-editing fields left
  const second = page.getByRole('button', {name: /^Tới cảnh /}).nth(1);
  await second.click();
  await expect(second).toHaveAttribute('aria-current', 'true', {timeout: 10_000});
  await ask.click();
  const input = chat.getByRole('textbox');
  await expect(input).toHaveValue(/^\[cảnh \S+ · \d+:\d{2}\.\d · khung \d+\] $/);
  await expect(input).toBeFocused();
  await player.screenshot({path: 'test-results/watch-player.png'});
});
```
- If the chat textbox is disabled because another chat session is busy, `toHaveValue` still holds and
  `toBeFocused` may not. In that case, assert focus only when the textbox is enabled.
- Remove the now unused `CAPTION` constant.
- Keep the other tests. In 'voice job then render', the buttons "Tạo giọng" and "Render" keep their names; change
  selectors only if they fail.

- [ ] **Step 3: Start the worktree app on side ports.** It uses the main tree's data read-only through `REEL_ROOT`.
  Run it as a background process:
```bash
cd /home/giabao/dev/create-video-watch/app
REEL_ROOT=/home/giabao/dev/create-video REEL_API_PORT=5326 REEL_UI_PORT=5327 NO_OPEN=1 npm run dev
```
Wait until `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5327/api/health` prints `200`. Never stop or
restart the user's app on 5316/5317.

- [ ] **Step 4: Run E2E**

```bash
cd /home/giabao/dev/create-video-watch/app
REEL_ROOT=/home/giabao/dev/create-video REEL_UI_URL=http://127.0.0.1:5327 REEL_API_URL=http://127.0.0.1:5326 npx playwright test
```
Expected: all tests pass. 'voice job then render' runs a real voice job and a real render, and can take up to about
6 minutes.

- [ ] **Step 5: Screenshots.** Use the side-port app and the existing project `2026-11-20-demo-card-moi`:
```bash
S=/tmp/claude-1000/-home-giabao-dev-create-video/bba133da-be00-4f0e-88d3-112908a33d38/scratchpad
cd /home/giabao/dev/create-video-watch/app
npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=4000 http://127.0.0.1:5327/p/2026-11-20-demo-card-moi $S/watch-1440.png
npx playwright screenshot --viewport-size=390,844 --wait-for-timeout=4000 http://127.0.0.1:5327/p/2026-11-20-demo-card-moi $S/watch-390.png
```
Look at both:
- At 1440, the player, the strip and the "Sửa chỗ này" button are on the left and the chat is docked right.
- At 390, the player is on top, then the strip, then the chat with its input visible without scrolling.
- Neither shows an Inspector, timeline or mix meter.

Fix any layout problem in `Editor.module.css` and re-shoot.

- [ ] **Step 6: Stop the side-port app** (only the processes you started on 5326/5327), then commit:

```bash
cd /home/giabao/dev/create-video-watch
git add app/e2e/app.spec.ts
git commit -m "E2E: watch screen with docked chat and moment tag; API URL from env"
```
Report the two screenshot paths.
