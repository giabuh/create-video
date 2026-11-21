# Chat Images & Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app chat send images to Claude/Codex, add a copy button to messages, and shorten the input
placeholder.

**Architecture:**
- The server stores uploaded images per chat and serves them back.
- On send, it appends the images' absolute paths to the prompt, and both CLIs open them with their own tools.
- The client (`ChatBody`) attaches images by button, paste or drop, uploads them on send, and shows thumbnails.
- A small clipboard helper with a non-secure-context fallback powers the copy buttons.

**Tech Stack:**
- Server: Hono on Node.
- Client: React 19 and CSS modules.
- Tests: vitest in a node environment, and the Playwright chat E2E, which uses the fake CLIs.

**Spec:** `docs/superpowers/specs/2026-11-21-chat-images-copy-design.md`

## Global Constraints

- **Where to work.** Only in the worktree `/home/giabao/dev/create-video-watch`, on branch `editor-watch`.
  - Never edit or run git in `/home/giabao/dev/create-video`.
  - Dependencies are already installed at the worktree root (npm workspaces). Don't run `npm ci`/`npm install`.
- **Limits.**
  - At most 4 images per message.
  - Each image ≤ 10 MB (10 × 1024 × 1024 bytes).
  - Types `.png .jpg .jpeg .webp .gif` (`image/png`, `image/jpeg`, `image/webp`, `image/gif`). Never svg.
- **Stored name:** `<uuid>.<ext>`, matched by
  `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/`.
  - Folder: `path.join(chatDir(), 'images', chatId)`.
- **Prompt block, exactly:**
  `Attached images (open each file to look at it):` followed by one line `- <absolute path>` per image.
  - It is joined to the text with a blank line.
  - With empty text, the block alone.
- **UI text is Vietnamese** ("Thêm ảnh", "Bỏ ảnh", "Sao chép", "Đã sao chép", "Ảnh đính kèm"). The placeholder is
  `Nhắn ${engineName}…`.
- **Code style.** Code, comments and commits in English. A single-line commit message, no Co-Authored-By trailer.
  Stage only your own files, by explicit path.
- **No new dependencies.**
- **Testing cadence:** only the tests for the files you touch, plus `cd app && npx tsc --noEmit`.

## Shared contract (already committed by the controller before Task 1 and Task 2)
`app/shared/types.ts` `ChatEvent` user variant:
`{kind: 'user'; text: string; account: string; at: number; images?: string[]}`. `images` holds stored names.

---

### Task 1: Server: upload, serve, and images in the prompt

**Files:**
- Create: `app/server/chat/images.ts`
- Modify: `app/server/routes/chats.ts`, `app/server/chat/service.ts`
- Test: `app/server/routes/chats.test.ts`

**Interfaces produced (Task 2 relies on these HTTP contracts):**
- `PUT /api/chats/:id/images/:filename` takes the raw file body.
  - Success: `201 {name: string}`.
  - Errors: 404 for an unknown chat, 400 for a bad extension, 413 for an image over 10 MB.
- `GET /api/chats/:id/images/:name` returns the bytes with `Content-Type` and `X-Content-Type-Options: nosniff`, or 404.
- `POST /api/chats/:id/messages` takes the body `{text, account, ..., images?: string[]}`.
  - `text` may be `''` only when `images` is non-empty.

- [ ] **Step 1: `app/server/chat/images.ts`**

```ts
import {randomUUID} from 'node:crypto';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {chatDir} from './store.ts';

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES: Readonly<Record<string, string>> = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'};
export const IMAGE_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/;

export const imageDir = (chatId: string): string => path.join(chatDir(), 'images', chatId);
export const imagePath = (chatId: string, name: string): string => path.join(imageDir(chatId), name);
export const newImageName = (ext: string): string => `${randomUUID()}${ext}`;

export async function imageExists(chatId: string, name: string): Promise<boolean> {
  if (!IMAGE_NAME_RE.test(name)) return false;
  try { return (await stat(imagePath(chatId, name))).isFile(); } catch { return false; }
}

/** The prompt the CLI gets: the user's text, then the absolute paths of the attached images. */
export function promptWithImages(text: string, paths: string[]): string {
  if (!paths.length) return text;
  const block = `Attached images (open each file to look at it):\n${paths.map(p => `- ${p}`).join('\n')}`;
  return text ? `${text}\n\n${block}` : block;
}
```

- [ ] **Step 2: Write the failing route tests** in `app/server/routes/chats.test.ts`, in a new
  `describe('chat images', ...)`. Use the file's existing `beforeEach`, `setup()`, `newChat()` and `send()`. Add a
  helper:

```ts
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
const upload = (req: ReturnType<typeof setup>['req'], id: string, file: string, body: Uint8Array = PNG) =>
  req(`/api/chats/${id}/images/${encodeURIComponent(file)}`, {method: 'PUT', body, headers: {'content-type': 'application/octet-stream'}});
```

Cases (import `chatDir` from `../chat/store.ts` and `IMAGE_NAME_RE` from `../chat/images.ts`):
- **Upload and serve.**
  - `upload(req, c.id, 'shot.png')` → 201, and `name` matches `IMAGE_NAME_RE` with a `.png` ending.
  - `GET /api/chats/${c.id}/images/${name}` → 200, `content-type` `image/png`, `x-content-type-options` `nosniff`.
  - The body bytes equal `PNG`.
- **Upload rejections.**
  - Unknown chat (`/api/chats/00000000-0000-4000-8000-000000000000/images/a.png`) → 404.
  - `a.svg` → 400, and `a.txt` → 400.
  - A body of `MAX_IMAGE_BYTES + 1` bytes (`new Uint8Array(MAX_IMAGE_BYTES + 1)`) → 413, and the chat's image folder
    has no file left: `readdir(imageDir(id))` is empty or missing.
- **Serve rejections.** `x.png`, `..%2Findex.json` and a valid-looking uuid name that doesn't exist → each 404.
- **Images in the prompt.**
  - Upload two images, then send
    `{text: 'xem ảnh', account: 'claude', screen: '/p/p1', slug: 'p1', images: [n1, n2]}` → 202, then
    `await chat.idle()`.
  - The `user` event has `images: [n1, n2]`.
  - The fake CLI's echoed `text` event contains
    `Attached images (open each file to look at it):\n- ${path.join(chatDir(), 'images', c.id, n1)}` and the line for
    `n2`.
- **Image-only message.** `text: ''` with one image → 202, and the chat title becomes `Ảnh`.
- **Send rejections:**
  - `images` not an array → 400;
  - 5 names → 400;
  - a name that is well-formed but not uploaded → 400;
  - a name like `../x.png` → 400;
  - `text: ''` with no images → 400.

Run: `cd app && npx vitest run server/routes/chats.test.ts`. Expected: the new tests FAIL (404 or route missing).

- [ ] **Step 3: Routes in `app/server/routes/chats.ts`**
  - **Upload:**
    - Validate the id with the existing `idOf`.
    - Return 404 if `await chat.get(id)` is null.
    - Take `ext = path.extname(filename).toLowerCase()` and return 400 (`chỉ nhận ảnh png, jpg, webp, gif`) unless
      `IMAGE_TYPES[ext]`.
    - If a `content-length` header is present and greater than `MAX_IMAGE_BYTES`, return 413 (`ảnh quá 10 MB`).
    - Call `const name = await saveUpload(c, imageDir(id), newImageName(ext))`, importing `saveUpload` from
      `./uploads.ts`.
    - Then `stat` the saved file. If it is over `MAX_IMAGE_BYTES`, `rm` it and return 413.
    - Return `c.json({name}, 201)`.
  - **Serve:**
    - `idOf`, then 404 unless `IMAGE_NAME_RE.test(name)`.
    - `readFile(imagePath(id, name))`; a missing file is 404.
    - Set `Content-Type` from `IMAGE_TYPES[path.extname(name)]`, `X-Content-Type-Options: nosniff` and
      `Cache-Control: private, max-age=31536000, immutable`.
    - Return `c.body(buf)`.
  - **Messages:**
    - Parse `images = b.images ?? []`.
    - Return 400 (`images must be up to 4 uploaded image names`) unless it is an array of ≤ `MAX_IMAGES` strings, each
      matching `IMAGE_NAME_RE`.
    - Change the text check to `typeof b.text === 'string' && b.text.length <= MAX_TEXT && (b.text.trim() !== '' || images.length > 0)`.
    - Pass `images` to `chat.send`.

- [ ] **Step 4: `app/server/chat/service.ts` `send`**
  - **Signature:** `m` gains `images: string[]`.
  - **Check:** after the chat is found, inside the existing `try` so the busy claim is released on throw:
    `for (const n of m.images) if (!(await imageExists(id, n))) throw new HttpError(400, 'image not found');`.
  - **User event:** persist
    `{kind: 'user', text: m.text, account: account.name, at: Date.now(), ...(m.images.length ? {images: m.images} : {})}`.
  - **Title:** `titleOf(m.text || 'Ảnh')`.
  - **Prompt:** `promptWithImages(m.text, m.images.map(n => imagePath(id, n)))`.
  - **Other callers:** check every other `send(` caller (grep), and pass `images: []` where needed so `tsc` stays clean.

- [ ] **Step 5: Run the tests.** `cd app && npx vitest run server/routes/chats.test.ts server/chat` passes, and
  `npx tsc --noEmit` is clean.

- [ ] **Step 6: Commit.**
  `git add app/server/chat/images.ts app/server/routes/chats.ts app/server/chat/service.ts app/server/routes/chats.test.ts`,
  then `git commit -m "Chat images: upload, serve, and paths in the agent prompt"`.

---

### Task 2: Client: attach, preview, thumbnails, copy, placeholder, chat E2E

**Files:**
- Create: `app/src/shell/chatImages.ts`, `app/src/shell/chatImages.test.ts`, `app/src/shell/clipboard.ts`
- Modify: `app/src/api/chat.ts`, `app/src/shell/ChatBody.tsx`, `app/src/shell/ChatPanel.module.css`,
  `app/e2e-chat/chat.spec.ts`

**Interfaces consumed:** the Task 1 HTTP contracts above, and `ChatEvent` user `images?: string[]`.

- [ ] **Step 1: Write the failing test for `app/src/shell/chatImages.ts`** (`chatImages.test.ts`, node environment;
  use plain objects `{name, type, size}`):
  - `acceptImages(0, [png 1 KB, jpeg 2 KB])` → both ok, `error` null.
  - `acceptImages(0, [{type: 'image/svg+xml'}])` → ok `[]`, `error` `'Chỉ nhận ảnh png, jpg, webp, gif'`.
  - `acceptImages(0, [png of 10*1024*1024 + 1 bytes])` → ok `[]`, `error` `'Ảnh quá 10 MB'`.
  - `acceptImages(3, [png, png])` → ok has 1, `error` `'Tối đa 4 ảnh mỗi tin'`.
  - `uploadName({name: 'image.png', type: 'image/png'})` → `'image.png'`.
  - `uploadName({name: '', type: 'image/jpeg'})` → `'anh.jpg'`.
  - `uploadName({name: 'blob', type: 'image/webp'})` → `'anh.webp'`.

- [ ] **Step 2: Implement `chatImages.ts`**

```ts
export const CHAT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
export const MAX_CHAT_IMAGES = 4;
export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif'};

/** Which of `incoming` fit next to `have` already attached images, and the first reason any were refused. */
export function acceptImages<F extends {type: string; size: number}>(have: number, incoming: F[]): {ok: F[]; error: string | null} {
  const ok: F[] = [];
  let error: string | null = null;
  for (const f of incoming) {
    if (!EXT[f.type]) error ??= 'Chỉ nhận ảnh png, jpg, webp, gif';
    else if (f.size > MAX_CHAT_IMAGE_BYTES) error ??= 'Ảnh quá 10 MB';
    else if (have + ok.length >= MAX_CHAT_IMAGES) error ??= 'Tối đa 4 ảnh mỗi tin';
    else ok.push(f);
  }
  return {ok, error};
}

/** File name sent to the server: pasted images are often called "image.png" or have no usable name. */
export function uploadName(f: {name: string; type: string}): string {
  return /\.(png|jpe?g|webp|gif)$/i.test(f.name) ? f.name : `anh.${EXT[f.type] ?? 'png'}`;
}
```

Run: `cd app && npx vitest run src/shell/chatImages.test.ts`, which must pass.

- [ ] **Step 3: `app/src/shell/clipboard.ts`**

```ts
/** Copy text; plain-http LAN access has no navigator.clipboard, so fall back to execCommand. */
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard) { await navigator.clipboard.writeText(text); return; }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { if (!document.execCommand('copy')) throw new Error('copy failed'); } finally { ta.remove(); }
}
```

- [ ] **Step 4: `app/src/api/chat.ts`**
  - Add `images?: string[]` to the `useSendChat` body type.
  - Add these two functions:

```ts
export const chatImageUrl = (chatId: string, name: string): string => `/api/chats/${chatId}/images/${name}`;
export async function uploadChatImage(chatId: string, file: File, name: string): Promise<string> {
  const res = await fetch(`/api/chats/${chatId}/images/${encodeURIComponent(name)}`, {method: 'PUT', body: file});
  const j = (await res.json().catch(() => null)) as {name?: string; error?: string} | null;
  if (!res.ok || !j?.name) throw new Error(j?.error ?? `Tải ảnh lỗi (${res.status})`);
  return j.name;
}
```

- [ ] **Step 5: `app/src/shell/ChatBody.tsx`**
  - **State.** `const [files, setFiles] = useState<File[]>([])` and a hidden file input ref.
    - Preview URLs: `useMemo(() => files.map(f => URL.createObjectURL(f)), [files])`.
    - An effect revokes them on change and on unmount.
  - **`addFiles(list: File[])`.** It runs `acceptImages(files.length, list)`, appends `ok`, and shows the error with
    `toast({title: error, tone: 'error'})` when there is one.
  - **Attach button.** Put an `IconButton` (label `Thêm ảnh`, icon `ImagePlus` from lucide-react) in the input area.
    - It is disabled while busy or running, or when `files.length >= MAX_CHAT_IMAGES`.
    - It clicks the hidden `<input type="file" accept={CHAT_IMAGE_ACCEPT} multiple hidden>`.
    - The input's `onChange` passes `[...e.target.files]` to `addFiles`, then resets `e.target.value = ''`.
  - **Paste.** The textarea `onPaste` collects `[...e.clipboardData.files].filter(f => f.type.startsWith('image/'))`.
    If any are found, it calls `e.preventDefault()` and then `addFiles`.
  - **Drop.** On the `.wrap` root:
    - `onDragOver`: if `e.dataTransfer.types.includes('Files')`, call `e.preventDefault()`.
    - `onDrop`: call `e.preventDefault()`, then `addFiles([...e.dataTransfer.files])`.
  - **Previews.** A row above the textarea, shown only when `files.length > 0`. Each item is a 56px square `<img>` with
    an `IconButton` (label `Bỏ ảnh`, icon `X`, small) that removes that file.
  - **Submit:**
    - Send when `t || files.length`, keeping the other existing guards.
    - After the chat id exists, upload each file in order:
      `images.push(await uploadChatImage(id, f, uploadName(f)))`.
    - Then send with `images: images.length ? images : undefined`.
    - On success, `setText('')` and `setFiles([])`.
    - On error, keep both and show the existing toast.
  - **Placeholder:** `Nhắn ${engineName}…`.
  - **User message.** Wrap it as `<div className={`${s.msg} ${s.mine}`} data-msg>`, containing:
    - the account caption;
    - `<div className={s.me} data-body>`, holding first the thumbnails and then `e.text`. Each thumbnail is
      `<a href={chatImageUrl(chatId, n)} target="_blank" rel="noreferrer"><img src={chatImageUrl(chatId, n)} alt="Ảnh đính kèm" loading="lazy" /></a>`,
      inside a `.imgs` row;
    - the copy button.
  - **Agent text message.** Wrap it as `<div className={s.msg} data-msg>`, containing the existing markdown div (add
    `data-body`) and the copy button.
  - **Copy button.** It is an `IconButton` (label `Sao chép`, icon `Copy`, small, class `s.copy`). On click:
    - read the text of the closest `[data-msg]`'s `[data-body]` (`.innerText`);
    - `await copyText(text)`;
    - `toast({title: 'Đã sao chép'})`;
    - on failure, `toast({title: 'Không sao chép được', tone: 'error'})`.
  - **Not copyable.** Tool lines, errors and the streaming draft get no copy button.

- [ ] **Step 6: `app/src/shell/ChatPanel.module.css`** (append; keep the existing `.me` and `.bot` rules):

```css
.msg { display: flex; flex-direction: column; gap: 2px; max-width: 92%; min-width: 0; align-self: flex-start; align-items: flex-start; }
.msg.mine { align-self: flex-end; align-items: flex-end; }
.msg > .me, .msg > .bot { max-width: 100%; }
.copy { opacity: .55; }
.msg:hover .copy, .copy:focus-visible { opacity: 1; }
.imgs { display: flex; flex-wrap: wrap; gap: var(--sp-1); margin-bottom: var(--sp-1); }
.imgs img { width: 88px; height: 88px; object-fit: cover; border-radius: var(--r-sm); display: block; }
.atts { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
.att { position: relative; width: 56px; height: 56px; }
.att img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--r-sm); display: block; }
.att > button { position: absolute; top: -8px; right: -8px; }
```
The `.cap` account caption keeps its own rule. If `.me` or `.bot` had `align-self`, the wrapper now decides it, and
that is fine.

- [ ] **Step 7: Chat E2E** (`app/e2e-chat/chat.spec.ts`). Add the test `'image attachment and copy'`:
  - Grant `['clipboard-read', 'clipboard-write']` on `context`, go to `/` and open the drawer, as the first test does.
  - Attach the image:

```ts
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
await page.locator('input[type=file]').setInputFiles({name: 'shot.png', mimeType: 'image/png', buffer: PNG});
```

  - Check the preview, then send:
    - expect the `Bỏ ảnh` button to be visible;
    - fill the textbox with `xem ảnh này`, then press Enter;
    - expect the dialog text `/prompt=xem ảnh này\s+Attached images \(open each file to look at it\):\s+- \S+images\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png/`.
  - Check the thumbnail:
    - expect `dialog.getByRole('img', {name: 'Ảnh đính kèm'})` to be visible;
    - its `naturalWidth` is > 0.
  - Check the copy:
    - click the first `Sao chép` button in the dialog;
    - expect `await page.evaluate(() => navigator.clipboard.readText())` to equal `'xem ảnh này'`.
  - Run: `cd app && npx playwright test -c playwright.chat.config.ts`. It uses ports 5336/5337 with fake CLIs and a temp
    home, and does not touch the user's app or chats.
  - It needs Task 1 committed. If Task 1's commit ("Chat images: upload, serve…") isn't in `git log` yet, write the
    test, report it as not run, and the controller runs it.

- [ ] **Step 8: Test and commit.**
  - Run `cd app && npx vitest run src/shell src/api` and `npx tsc --noEmit`.
  - Then `git add` the files listed above.
  - Then `git commit -m "Chat: attach images (button, paste, drop), copy buttons, shorter placeholder"`.
