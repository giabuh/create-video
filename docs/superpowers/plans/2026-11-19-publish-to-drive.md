# Publish to Drive + Delete Renders/Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final-only renders; approving a render copies it to Google Drive `xuat-ban/`; renders and whole projects can be deleted (optionally uploading first) to keep the VPS light.

**Architecture:** A small `app/server/drive.ts` wraps `rclone` (upload / list / delete, retry helper). Upload and project deletion run as `io`-lane jobs in the existing `JobQueue`; their state lives in `projects/<slug>/project.json` (`published`, `deleting`) so it survives restarts. The Renders and Projects screens show state and drive the new routes.

**Tech Stack:** Node 22 + TypeScript, Hono, vitest, React + TanStack Query, rclone CLI (`/usr/bin/rclone`).

**Spec:** `docs/superpowers/specs/2026-11-19-publish-to-drive-design.md` (read it first).

## Global Constraints
- UI text in Vietnamese; code, comments, commit messages in English. Commit messages: one line, no body, no Co-Authored-By.
- Never delete anything automatically: only on an explicit user action. Never call `rclone sync`/`purge`; only `copyto`, `lsf`, `deletefile`.
- Drive folder: `<config.sync.remote>/xuat-ban` (fixed). Drive file name = `slugify(userInput) + ".mp4"` (reuse `slugify` from `app/server/paths.ts`).
- All `project.json` writes go through `withSlugLock(slug, ...)` + `readMeta`/`writeMeta` (`app/server/versions.ts`).
- Tests never call real rclone: mock `app/server/drive.ts` (pattern: `vi.mock('../git.ts', ...)` in `app/server/routes/projects.test.ts`).
- Testing cadence: per task run only the touched files' tests (`cd app && npx vitest run <files>` and `npx tsc --noEmit`). Full suite only at final review.
- Workers share one tree: stage only your own files by explicit path.

## File map
| File | Task | Responsibility |
|---|---|---|
| `app/server/render.ts`, `versions.ts`, `routes/projects.ts` (render route), `shared/types.ts` (kind), `config.json`, `tools/tests/*`, `src/screens/Editor/TopBar.tsx`, `src/screens/Renders/Renders.tsx` (render call), `src/api/hooks.ts` (`useStartRender`), `src/screens/Settings/SettingsForm.tsx`, `src/screens/Projects/Projects.tsx` (label), `e2e/app.spec.ts`, `CLAUDE.md`, `.claude/skills/make-reel/SKILL.md`, pipeline spec | 1 | final-only |
| `app/server/drive.ts` (+ test), `tools/sync.sh`, pipeline spec §Portability | 2 | rclone wrapper, stop syncing mp4 |
| `app/server/publish.ts` (+ test), `routes/projects.ts` (approve, publish, delete render), `shared/types.ts` (meta), `versions.ts` (helpers) | 3 | publish + delete render server |
| `app/server/deleteProject.ts` (+ test), `git.ts` (+ test), `routes/projects.ts` (delete routes, read-only guard) | 4 | delete project server |
| `src/screens/Renders/*`, `src/api/hooks.ts` | 5 | Renders UI |
| `src/screens/Projects/*`, `src/screens/Editor/TopBar.tsx` (menu item), `src/api/hooks.ts` | 6 | Delete-project UI |

Order: **1 ∥ 2 → 3 → 4 ∥ 5 → 6.** (3 needs 1's edited `projects.ts`/`types.ts`; 4 and 5 touch different files, 4 owns `routes/projects.ts`, 5 owns `Renders/*`; both may add one hook each to `src/api/hooks.ts` — 5 appends at the end of the file, 4 does not touch it.)

---

### Task 1: Final-only renders

**Files:** see file map row 1. Tests: `app/server/versions.test.ts`, `app/server/jobs.test.ts`, `app/server/routes/projects.test.ts`, `tools/tests/conftest.py`, `tools/tests/test_props.py`.

**Interfaces:**
- Produces: `renderVersion(slug: string, ctx: JobCtx, worker: VoiceWorker): Promise<Json>` (no `kind`); `recordRender(slug, name)` (always writes `kind: 'final'`); `POST /projects/:slug/render` ignores the body; `useStartRender(slug)` → `UseMutationResult<Job, HttpError, void>`.
- `ProjectMeta.renders[v].kind` stays `'draft' | 'final'` (legacy drafts exist on disk). `VersionInfo.kind` unchanged. `ProjectStatus` stays `'rendering' | 'approved' | 'draft' | 'new'` (`'draft'` now means "rendered, not approved").

- [ ] **Step 1: Update tests first.**
  - `versions.test.ts`: replace the "new draft replaces older drafts" expectation with: after `recordRender('p2', 'reel-v4')`, all earlier mp4/snapshots still exist and `meta.renders['reel-v4'].kind === 'final'`.
  - `jobs.test.ts:89,97`: call `renderVersion('p1', ctx, ...)`.
  - `projects.test.ts`: `recordRender('p1', 'reel-v2')`; a render POST with `{}` body returns 202.
- [ ] **Step 2: Run** `cd app && npx vitest run server/versions.test.ts server/jobs.test.ts server/routes/projects.test.ts` → FAIL (signature).
- [ ] **Step 3: Implement.**
  - `render.ts`: drop `kind` param; `scale: 1` → remove the `scale` option entirely; call `recordRender(slug, name)`.
  - `versions.ts` `recordRender`: delete the `if (kind === 'draft') {...}` cleanup block and the `rm` import if unused; write `{kind: 'final', at}`. Update the doc comment.
  - `routes/projects.ts` render route: no body parsing; label `Render ${slug}`.
  - `shared/types.ts`: remove `draftScale` from `Config.video`. `config.json`: remove `"draftScale": 0.5`. `tools/tests/conftest.py:16` and `test_props.py:5`: remove `"draftScale": 0.5`.
  - `SettingsForm.tsx:122`: drop the "bản nháp …" part of the text.
  - `TopBar.tsx`: one "Render" action (remove "Render nháp" menu item and draft button; keep the stale-voice confirm, now without kind state: `useState(false)`).
  - `Renders.tsx:30`: `start.mutate(undefined, ...)`. `hooks.ts`: `useStartRender` takes `void`, posts `{}`.
  - `VersionCard.tsx`: `QUALITY.final = '1080×1920'`.
  - `Projects.tsx:23`: label `Chưa duyệt${v}` instead of `Bản nháp${v}` (filter logic unchanged).
  - `e2e/app.spec.ts:61`: rename test to `'voice job then render'`, adjust any draft click.
  - Docs: `CLAUDE.md` remove the `Draft:` command line, change `Final: same as draft without --scale` to `Render: cd studio && npx remotion render Reel ../projects/<slug>/reel-v<N>.mp4 --props=../projects/<slug>/render-props.json`, rule 7 "Before every render". `.claude/skills/make-reel/SKILL.md` steps 6/8: render full quality (no `--scale`); on approval commit `storyboard.json` (no sync push of mp4). Pipeline spec `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md` lines 96, 197-198, 207, 278: remove draftScale / draft wording.
- [ ] **Step 4: Run** the three vitest files, `cd app && npx tsc --noEmit`, `cd studio && npx tsc --noEmit`, `uv run --with pytest python -m pytest tools/tests -q` → PASS. `grep -rn "draftScale\|'draft' | 'final'>" app/src app/server studio/src tools config.json` → only the legacy type in `shared/types.ts`.
- [ ] **Step 5: Commit** `git commit -m "Renders: final quality only, drop drafts"` (explicit paths).

---

### Task 2: rclone wrapper + stop syncing renders

**Files:** Create `app/server/drive.ts`, `app/server/drive.test.ts`. Modify `tools/sync.sh` (last `copy projects ...` line), pipeline spec line 217.

**Interfaces (Produces):**
```ts
export type Runner = (args: string[], onLine?: (line: string) => void, signal?: AbortSignal) => Promise<{code: number; out: string; err: string}>;
export function setRunner(r: Runner): void;               // tests inject a fake
export function driveName(input: string): string;          // slugify(input.replace(/\.mp4$/i, '')) + '.mp4'; throws Error('bad name') if slug empty
export async function publishDir(): Promise<string>;       // `${config.sync.remote}/xuat-ban`
export async function driveList(): Promise<string[]>;      // `rclone lsf <dir> --files-only`; exit 3 (dir missing) => []
export async function driveUpload(local: string, name: string, onProgress: (p: number | null) => void, signal?: AbortSignal): Promise<void>;
  // `rclone copyto <local> <dir>/<name> --stats=1s --stats-one-line --use-json-log -v`; parse JSON lines with stats.bytes/stats.totalBytes for progress
export async function driveDelete(name: string): Promise<void>;  // `rclone deletefile <dir>/<name>`
export function freeName(base: string, taken: string[]): string; // 'a.mp4' -> 'a.mp4' | 'a-2.mp4' | 'a-3.mp4'...
export async function withRetry<T>(fn: () => Promise<T>, delaysMs: number[], sleep?: (ms: number) => Promise<void>, signal?: AbortSignal): Promise<T>;
  // tries 1 + delaysMs.length times
export class DriveError extends Error {}  // non-zero exit: message = last stderr line; code 'ENOENT' spawn => 'Chưa cài rclone'; "didn't find section in config file" => 'Chưa cấu hình rclone — chạy: rclone config'
```
Default runner: `spawn('rclone', args)` from `node:child_process`, split stderr by line into `onLine`, kill on `signal` abort.

- [ ] **Step 1: Failing tests** (`drive.test.ts`, fake runner via `setRunner`, `makeTestRoot()` for config): `driveName('IELTS 7.5 Hè')` → `'ielts-7-5-he.mp4'`; `driveName('!!!')` throws; `freeName('a.mp4', ['a.mp4','a-2.mp4'])` → `'a-3.mp4'`; `driveList` returns `[]` on code 3 and lines on code 0; `driveUpload` passes `['copyto', local, '<remote>/xuat-ban/x.mp4', ...]` and reports `0.5` for a JSON line `{"stats":{"bytes":5,"totalBytes":10}}`; non-zero exit throws `DriveError`; `withRetry` with fake sleep calls fn 4 times for `[10,30,90]` then rethrows, and stops early on success.
- [ ] **Step 2: Run** `cd app && npx vitest run server/drive.test.ts` → FAIL.
- [ ] **Step 3: Implement** `drive.ts` per interfaces (read config via `readJson<Config>(path.join(repoRoot(), 'config.json'))`).
- [ ] **Step 4: sync.sh**: delete the line `copy projects projects --include "*/reel-v*.mp4"`. Pipeline spec line 217: remove `, and projects/*/reel-v*.mp4`, add sentence "Approved renders go to Drive `xuat-ban/` from the app (see 2026-11-19-publish-to-drive-design.md)." Run `bash -n tools/sync.sh`.
- [ ] **Step 5: Run** test + `npx tsc --noEmit` → PASS. Manual smoke (optional, report result): `rclone lsf video-syn:create-video --max-depth 1`.
- [ ] **Step 6: Commit** `git commit -m "Drive: rclone wrapper for publishing; sync no longer copies renders"`.

---

### Task 3: Publish on approve + delete render (server)

**Files:** Create `app/server/publish.ts`, `app/server/publish.test.ts`. Modify `app/shared/types.ts`, `app/server/versions.ts`, `app/server/routes/projects.ts`, `app/server/routes/projects.test.ts`.

**Interfaces:**
- Consumes: Task 2 `driveName, driveList, driveUpload, driveDelete, DriveError`; Task 1 render changes.
- Produces (types):
```ts
export type PublishInfo = {name: string; state: 'uploading' | 'done' | 'failed'; error?: string; at: string};
export type ProjectMeta = {approved: string | null; renders: Record<string, {kind: 'draft' | 'final'; at: string}>;
  published?: Record<string, PublishInfo>; deleting?: {uploads: string[]; state: 'uploading' | 'failed'; error?: string}};
// VersionInfo gains: published: PublishInfo | null
// JobKind gains: 'publish' | 'delete-project'
```
- Produces (server): `setPublished(slug, version, info | null): Promise<void>` in `versions.ts` (slug-locked read-modify-write); `uploadVersion(slug, version, name, ctx, opts: {unique: boolean}): Promise<string>` in `publish.ts` — returns final name; `unique: false` → throws `DriveError('Tên đã có trên Drive')` if name taken; `unique: true` → `freeName`. Sets `uploading` → `done`/`failed` (with error). `deleteRender(slug, version, {drive: boolean}): Promise<{driveError?: string}>`.
- Routes:
  - `POST /projects/:slug/approve {version, name?}`: 400 `'Bản nháp cũ không duyệt được'` if `meta.renders[version]?.kind === 'draft'`; after the existing commit, enqueue job `{kind: 'publish', lane: 'io', label: 'Đẩy <version> lên Drive', project: slug, cancellable: true, run: ctx => uploadVersion(slug, version, driveName(name ?? `${slug}-${version}`), ctx, {unique: false})}`. Response adds `job`. `name` invalid → 400 before anything is written.
  - `POST /projects/:slug/publish {version, name}`: 409 unless `version === meta.approved`; enqueue the same job (retry / rename).
  - `DELETE /projects/:slug/renders/:version?drive=1`: 404 unknown; 409 `'Bản đã duyệt chưa lên Drive'` if approved and `published[v]?.state !== 'done'`; 409 while a render or publish job for the slug is queued/running. Removes `<v>.mp4`, removes `<v>.storyboard.json` unless `v === meta.approved`, deletes `renders[v]`; keeps `approved`. If `drive` and published done → `driveDelete`, on error return `{driveError}` with 200 (local delete still done) and clear `published[v]` only on success.

- [ ] **Step 1: Failing tests.** `publish.test.ts` (mock `./drive.ts` with `vi.mock`, real `makeTestRoot`): upload success → `published[v] = {state:'done', name}`; name taken + `unique:false` → `failed` with 'Tên đã có trên Drive'; `unique:true` → `x-2.mp4`; `deleteRender` keeps approved snapshot, removes non-approved snapshot, `drive:true` calls `driveDelete`, drive failure returns `driveError` and files are still gone. `projects.test.ts`: approve legacy draft → 400; approve final → 200 with `job`; DELETE approved not uploaded → 409; DELETE unknown → 404.
- [ ] **Step 2: Run** `cd app && npx vitest run server/publish.test.ts server/routes/projects.test.ts` → FAIL.
- [ ] **Step 3: Implement** types, `setPublished`, `listVersions` fills `published: meta.published?.[name] ?? null`, `publish.ts`, routes.
- [ ] **Step 4: Run** both test files + `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Approve uploads the render to Drive; delete a render"`.

---

### Task 4: Delete project (server)

**Files:** Create `app/server/deleteProject.ts`, `app/server/deleteProject.test.ts`. Modify `app/server/git.ts`, `app/server/git.test.ts`, `app/server/routes/projects.ts`, `app/server/routes/util.ts`, `app/server/routes/projects.test.ts`, `app/shared/types.ts` (`ProjectSummary.deleting`, `ProjectStatus` + `'deleting'`).

**Interfaces:**
- Consumes: Task 3 `uploadVersion(..., {unique: true})`, `ProjectMeta.deleting`; Task 2 `withRetry`.
- Produces: `deleteProjectCommit(slug): Promise<string | null>` in `git.ts` — `git rm -r -q --cached --ignore-unmatch -- projects/<slug>`, then if `git diff --cached --quiet -- projects/<slug>` exits 1, `git commit -m "Delete project <slug>" -- projects/<slug>`; returns short sha or null. `runDeleteProject(slug, ctx, sleep?)` in `deleteProject.ts`. `needEditable(slug)` in `routes/util.ts`: throws `HttpError(423, 'Dự án đang được xoá')` when `meta.deleting` is set.
- Routes:
  - `DELETE /projects/:slug {upload?: string[]}`: 409 if any job for the slug is queued/running; 400 if an `upload` entry is not an existing `reel-vN` mp4. If `upload` omitted and `meta.deleting` exists → retry with `meta.deleting.uploads`. Writes `deleting = {uploads, state: 'uploading'}`, enqueues `{kind: 'delete-project', lane: 'io', label: 'Xoá dự án <slug>', project: slug, cancellable: false}` → 202 job.
  - `POST /projects/:slug/delete-cancel`: 409 if the delete job is running; else clears `deleting` → 200.
  - Call `needEditable` in every mutating `/projects/:slug/*` route except the two above (storyboard PUT, preview, voice, render, approve, publish, delete render).
- `runDeleteProject` flow: for each version in `deleting.uploads` whose `published[v]?.state !== 'done'`: `withRetry(() => uploadVersion(slug, v, driveName(`${slug}-${v}`), ctx, {unique: true}), [10_000, 30_000, 90_000], sleep)`. On final failure: `deleting.state = 'failed'`, `deleting.error = message`, rethrow (job fails; nothing local deleted). When all done: `deleteProjectCommit(slug)` then `rm(safeJoin('projects', slug), {recursive: true, force: true})`. Never touches `library/` or `music/`.
- `summarize` (projects list): `deleting: meta.deleting ?? null`; status `'deleting'` when `meta.deleting` set (before other checks).

- [ ] **Step 1: Failing tests.** `git.test.ts`: `deleteProjectCommit` commits removal of tracked files under `projects/p1` and returns sha; untracked-only project → null. `deleteProject.test.ts` (mock `./drive.ts` and `./git.ts`, fake sleep): no uploads → folder gone, commit called; one upload ok → `published` recorded then folder gone; upload fails 4 times → folder still exists, `deleting.state === 'failed'`, sleep called with 10000, 30000, 90000; retry after a partial success skips the done version. `projects.test.ts`: storyboard PUT → 423 while `deleting` set; delete-cancel clears it; list shows status `'deleting'`.
- [ ] **Step 2: Run** `cd app && npx vitest run server/git.test.ts server/deleteProject.test.ts server/routes/projects.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** those tests + `npx tsc --noEmit` → PASS. Because this deletes data, also run the whole server suite: `cd app && npx vitest run server`.
- [ ] **Step 5: Commit** `git commit -m "Delete project: optional Drive upload with retries, then remove files"`.

---

### Task 5: Renders UI (approve name, Drive state, delete render)

**Files:** Modify `app/src/screens/Renders/Renders.tsx`, `VersionCard.tsx`, `Renders.module.css`, `app/src/api/hooks.ts` (append at end).

**Interfaces:**
- Consumes: Task 3 routes, `VersionInfo.published`, `ProjectMeta.renders[v].kind`.
- Produces hooks: `usePublish(slug)` (`{version, name}`), `useDeleteRender(slug)` (`{version, drive}` → `DELETE /projects/:slug/renders/:version?drive=0|1`, returns `{driveError?}`), both invalidating `qk.project(slug)`, `qk.projects`. `useApprove` mutation variable becomes `{version, name}`. Check `src/api/client.ts` supports `method: 'DELETE'`.

- [ ] **Step 1:** Approve dialog (`Dialog` from `ui/index.ts`) with an `Input` "Tên file trên Drive", default `${slug}-${v.name}`, hint "Lưu vào thư mục xuat-ban/ trên Drive". On success toast "Đã duyệt … · đang đẩy lên Drive".
- [ ] **Step 2:** `VersionCard`: no "Duyệt" button when `v.kind === 'draft'` (show `Chip` "Nháp 0,5×" + muted "Bản nháp cũ — không duyệt được"). Drive chip from `v.published`: `uploading` → "Đang tải lên Drive" + progress from the running `publish` job (`useJobs()`), `done` → "Đã lên Drive · {name}", `failed` → "Lỗi Drive" + tooltip error + "Thử lại" (opens the name dialog prefilled, calls `usePublish`).
- [ ] **Step 3:** Trash `IconButton` "Xoá bản này" next to the folder button. Disabled with tooltip "Đẩy lên Drive trước khi xoá" when `v.approved && v.published?.state !== 'done'`. Confirm dialog: text "Xoá file video trên máy này. Storyboard của dự án vẫn giữ."; checkbox (native `<input type="checkbox">` with label) "Xoá cả trên Drive" only when `v.published?.state === 'done'`, unchecked. Show `driveError` as an error toast.
- [ ] **Step 4:** Side card text → "Duyệt = chốt bản này, lưu storyboard vào git và đẩy file lên Drive (thư mục xuat-ban/). Các bản khác chỉ nằm trên máy này; xoá khi không cần."
- [ ] **Step 5: Verify:** `cd app && npx tsc --noEmit && npm test`; with the app running (`npm start`), check `/p/_smoke/renders` in Playwright at 1440 px and 390 px widths: dialogs open, delete disabled state, no overflow. Report screenshots paths.
- [ ] **Step 6: Commit** `git commit -m "Renders: Drive name on approve, upload state, delete render"`.

---

### Task 6: Delete-project UI

**Files:** Create `app/src/screens/Projects/DeleteProjectDialog.tsx`. Modify `app/src/screens/Projects/Projects.tsx` (+ its css module), `app/src/screens/Editor/TopBar.tsx` (menu item), `app/src/api/hooks.ts` (append).

**Interfaces:**
- Consumes: Task 4 routes, `ProjectSummary.deleting`, status `'deleting'`; `useProject(slug).data.versions` for the list.
- Produces hooks: `useDeleteProject(slug)` (`{upload?: string[]}`), `useCancelDelete(slug)`.

- [ ] **Step 1:** `DeleteProjectDialog({slug, open, onOpenChange})`: loads `useProject(slug)`; lists versions with `published?.state !== 'done'` as checkboxes (label `reel-vN · 1080p|Nháp 540p · size · date`, unchecked); lists done ones as "Đã lên Drive · name". Title: "Xoá dự án {slug}?" or, when no version is done, "Chưa có bản nào trên Drive — xoá luôn hay đẩy lên Drive rồi xoá?". Text: "Thư viện footage và nhạc không bị xoá." Primary button: "Xoá luôn" (none ticked) / "Đẩy {n} bản lên Drive rồi xoá". Destructive styling.
- [ ] **Step 2:** Project card: "Xoá dự án" in the card's menu (add a `DropdownMenu` if the card has none). Status chip for `'deleting'`: state uploading → "Đang xoá" (info), failed → "Xoá dở: lỗi Drive" (error) with buttons "Thử lại" (`useDeleteProject` with no body) and "Huỷ xoá". Card not clickable into the Editor while deleting.
- [ ] **Step 3:** Editor `TopBar` menu: "Xoá dự án" opens the same dialog; after the job finishes navigate to `/`. If the Editor is open on a project that is `deleting`, show a banner "Dự án đang được xoá" and disable editing (the server already returns 423).
- [ ] **Step 4: Verify:** `npx tsc --noEmit && npm test`; Playwright on the running app: create a throwaway project, delete it with nothing ticked → disappears from the list; never delete `_smoke`. Report.
- [ ] **Step 5: Commit** `git commit -m "Projects: delete project dialog with optional Drive upload"`.

---

## Agent assignment
- Task 1: `worker-sonnet` — mechanical removal across many files.
- Task 2: `worker-sonnet` — small module, interfaces fixed.
- Task 3: `worker-sonnet` — routes follow existing patterns.
- Task 4: `worker-sonnet` (decisions settled here) + **`worker-opus` review** — data deletion is high-risk.
- Task 5, 6: `worker-sonnet` — UI on existing components.

## Final review (main session)
Full branch diff, `cd app && npm test && npx tsc --noEmit && npm run e2e`, `cd studio && npx tsc --noEmit`, pytest; one real Drive upload of `_smoke` reel-v3 with the user's OK.
