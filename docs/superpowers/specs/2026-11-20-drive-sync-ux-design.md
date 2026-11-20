# Drive sync UX — design (2026-11-20)

Goal: every Drive action in the app (push render, delete render / Drive copy, delete project, sync media library)
is trackable while it runs, announces its outcome wherever the user is, and the app can verify what really is on Drive.
Plus fix overflowing / misaligned UI on Projects, Renders, Library.

## Already done (shared contract, main session)
- `shared/types.ts`: `JobKind` += `'drive-delete' | 'sync'`; `Job.ref: string | null` (render version for
  publish / drive-delete, `'push' | 'pull'` for sync); new `DriveStatus`, `SyncFolder`, `SyncStatus` types.
- `server/jobs.ts`: `JobSpec.ref?` copied onto the job.
- `server/drive.ts`: `rclone` (runner, swappable via `setRunner`), `parseStats(line)`, `statsText(stats)`
  ("12,3/22,1 MB · 4,2 MB/s"), `STATS_FLAGS`, exported `fail`, `driveSizes()` (name -> bytes in xuat-ban/),
  `driveUpload` onProgress now also gets `Stats`, `withRetry(..., onRetry?)`.

## Server behaviour
### Push render (`publish`)
- Job gets `ref: version`. Step text while uploading: `Đẩy lên Drive · <statsText>`.
- After upload: verify with `driveSizes()` — file present and size equals the local mp4 size. Otherwise fail with
  `Đã tải lên nhưng không thấy đúng file trên Drive`. Step `Kiểm tra trên Drive` during the check.
- Re-push (`Đẩy lại`): `POST /projects/:slug/publish` accepts a version whose record is `done` when the Drive check
  says `missing` or `mismatch` (server re-checks with `driveSizes()`); still 409 while `uploading`, and 409 for `done`
  when the file is on Drive with the right size. Re-push uploads under the recorded name and overwrites it
  (`uploadVersion` gets a `repush` option that skips the done-record guard and the "name taken" check for that name).
- `nextVersion()` (`server/versions.ts`) must also skip numbers that appear as keys in `project.json` `published` /
  `renders`, so a version kept on Drive after local delete is never reused by a new render.

### Drive status — `GET /projects/:slug/drive` -> `DriveStatus`
- One `driveSizes()` call. For each `published[v].state === 'done'`: `ok` (present, size equals local mp4 when local
  exists, else present), `missing`, `mismatch`. `orphans` = done records whose local `<v>.mp4` is gone, with `onDrive`.
- rclone failure -> 200 with `error` set and empty maps (UI shows "Không kiểm tra được Drive: …").

### Delete render
- `DELETE /projects/:slug/renders/:version?drive=1` deletes locally as now, then (drive=1 and record done) enqueues a
  `drive-delete` job and returns `{driveJob: Job}`; drive=0 returns `{}`. Response no longer has `driveError`.
- `POST /projects/:slug/drive-delete` `{version}` -> 202 `drive-delete` job (used for orphans / retry). 404 if no done
  record. Job: label `Xoá <version> trên Drive`, `ref: version`, lane io, not cancellable. Deleting a file that is
  already gone from Drive counts as success. On success `setPublished(slug, version, null)`.

### Delete project
- Step texts: `Đẩy <v> (i/n) · <statsText>`, on retry `Lỗi: <msg> — thử lại sau <s> giây (lần k/3)`,
  then `Kiểm tra trên Drive`, then `Xoá thư mục dự án`. Progress = overall fraction across uploads where possible.
- Safety: right before `rm`, one `driveSizes()` call must show every version that is ticked for upload or has a
  `done` record with its local mp4 present on Drive with the same size. Missing -> re-upload it (once, via the same
  retry path); still missing/mismatch -> fail, nothing removed.

### Library sync (new; same semantics as `tools/sync.sh`: never deletes, `--update` never overwrites newer)
- `GET /sync/status` -> `SyncStatus`: `rclone check <local> <remote>/<folder> --size-only --combined -` per folder
  in parallel (`+` localOnly, `-` driveOnly, `*` differ, `=` same). Exit 1 is only "differences" when stderr says
  differences were found (e.g. `N differences found`); any other non-zero exit -> `error`. Missing remote folder =
  everything localOnly. Verify the exact stderr/exit codes against the real remote (`video-syn:create-video`,
  read-only commands only: `rclone check`, `lsf`), including a non-existent remote folder. Folders: library, music, sfx, reference.
- `POST /sync/push`, `POST /sync/pull` -> 202 `sync` job (`ref` push|pull, lane io, cancellable,
  label `Đẩy thư viện lên Drive` / `Kéo thư viện từ Drive`). 409 if a sync job is active.
  Runs `rclone copy --update` per folder with `STATS_FLAGS`; step `<folder> (i/4) · <k>/<n> file · <statsText>`;
  pull treats exit 3 (remote dir missing) as skip. On success stores the time in `app/.data/sync-state.json`
  (`{lastPush, lastPull}`) and returns the fresh `SyncStatus` as job result.

## UI behaviour
### Global
- One watcher (mounted once in the shell) toasts when a `publish | drive-delete | delete-project | sync` job turns
  done / failed / cancelled while the app is open (not for jobs already finished at load). Success:
  `Đã đẩy reel-v3 lên Drive (đã kiểm tra)`, `Đã xoá reel-v2 trên Drive`, `Đã xoá dự án <slug>`,
  `Đã đồng bộ thư viện`. Failure: tone error with `job.error`. Action `Xem` navigates to the relevant screen
  (renders page of the project / projects list / library).

### Renders screen
- Match the publish/drive-delete job by `job.ref === v.name` (not label).
- Status row on every card, fixed min-height so cards align whether or not they are approved/published:
  not published -> muted `Chỉ trên máy`; uploading -> progress bar + `job.step` + cancel; done & ok ->
  `Có trên Drive ✓` + truncated file name (full name in title/tooltip); done & missing/mismatch -> danger
  `Không thấy trên Drive` + `Đẩy lại`; failed -> error text + `Thử lại`; checking -> `Đang kiểm tra Drive…`.
- `useDriveStatus(slug)` fetched on open; refetched when a publish/drive-delete job for the project finishes; header
  shows `Kiểm tra Drive lúc hh:mm` + `Kiểm tra lại` button; error shown inline.
- Delete dialog: when the version is on Drive, three radios `Chỉ xoá trên máy (giữ bản trên Drive)` /
  `Chỉ xoá trên Drive (giữ file trên máy)` (POST drive-delete) / `Xoá cả trên máy và Drive` (default: local only).
- While the Drive check is pending a done record shows `Đã lên Drive · đang kiểm tra…` + file name (not a blank wait).
- Live updates: `server/watcher.ts` watches each directory non-recursively — Node's recursive watch on Linux went deaf to
  files replaced by rename (writeJsonAtomic), so project.json changes needed F5. Toast after local delete says exactly what happened:
  `Đã xoá reel-v2 trên máy · bản trên Drive vẫn giữ` or `… · đang xoá trên Drive`.
- Section `Chỉ còn trên Drive` (orphans): name, date, `Xoá trên Drive` button with running state; orphans with
  `onDrive: false` show `Không còn trên Drive` and the same button clears the record.
- Fix: the Drive chip overflowing the card; cards must align.

### Projects screen
- Delete-project dialog (`DeleteProjectDialog.tsx`): the "Đã lên Drive" rows use `GET /projects/:slug/drive`
  (✓ đã kiểm tra / không thấy trên Drive) instead of trusting the record.
- Card of a deleting project shows the running delete-project job: progress bar + `job.step`; failed shows error +
  existing retry path. Fix wrapping/alignment at 1440/1100/390.

### Library screen
- `Drive` button in the page header opens a Drawer `Đồng bộ Google Drive`: per-folder table (chưa lên Drive /
  chỉ có trên Drive / khác nhau / khớp), `Đẩy lần cuối` / `Kéo lần cuối`, `Kiểm tra lại`, buttons `Đẩy lên Drive` /
  `Kéo về máy` (disabled while a sync job runs), running job progress + step + cancel; after the job the table
  refreshes from the job result. Explain in one line: never deletes, never overwrites newer files.

## Out of scope
Public share links on Drive; deleting files from Drive via library sync; auto sync schedules.
