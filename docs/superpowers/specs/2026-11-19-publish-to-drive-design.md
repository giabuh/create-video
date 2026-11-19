# Publish approved reel to Google Drive + delete renders — Design

Status: approved by user 2026-11-19
Extends: `2026-11-18-reel-app-design.md` (Renders screen, `project.json`)

## Goal
Keep the VPS light. Drafts are only for viewing/comparing. The approved Final is copied to Drive, the user
downloads it from Drive, then deletes renders on the VPS by hand. The storyboard and project stay for editing.

## Decisions (user-approved)
- **No more drafts: every render is Final 1080×1920.** The Editor has one "Render" button; `POST /render` drops `kind`
  (always final). Remove `config.video.draftScale`, the draft branch in `app/server/render.ts`, the old-draft
  auto-delete in `recordRender` (`app/server/versions.ts`), and the Draft command in `CLAUDE.md` and the
  `/make-reel` skill (CLAUDE.md rule 7: "before every render"). Quick checks use the Editor's live Player.
- **Any render can be approved**, including old ones. Legacy draft renders (`renders[v].kind == "draft"`) still show
  "Nháp 0,5×" and have no "Duyệt" button; the user deletes them by hand.
- Renders now accumulate; nothing auto-deletes them. No bulk "clean up" button in v1.
- **Approve → upload.** After the existing approve (meta + git commit), the app enqueues an `io` job that copies that
  one mp4 to `<config.sync.remote>/xuat-ban/<name>.mp4` with `rclone copyto`.
- **File name is editable (a).** The approve dialog asks for the Drive file name, default `<slug>-<version>`.
  Sanitised to `[a-z0-9-_.]`, `.mp4` added. If the name already exists on Drive (`rclone lsf`), the job fails with
  "Tên đã có trên Drive" and the user picks another name (retry with a new name). Folder `xuat-ban/` is fixed.
- **No automatic deletes anywhere.** The user deletes renders by hand.
- **Delete button on every render card.** Confirm dialog; deletes `reel-vN.mp4` and its `reel-vN.storyboard.json`
  (except the approved version's snapshot, which is in git and stays) and drops it from `project.json.renders`.
  The approved version can be deleted only after its upload is `done`; deleting it does not clear `approved`.
- **"Xoá cả trên Drive" checkbox** in that confirm dialog, unchecked by default, shown only when the version has a
  `done` upload: runs `rclone deletefile` on its Drive file. Deleting on Drive by hand is also fine; the app never
  checks Drive afterwards.
- **`tools/sync.sh` stops pushing/pulling `projects/*/reel-v*.mp4`.** Otherwise push would send drafts and pull would
  bring back renders the user deleted.

## Data
`project.json` gains `published`:
```json
{ "approved": "reel-v3", "renders": {...},
  "published": { "reel-v3": { "name": "ielts-7-5.mp4", "state": "uploading" | "done" | "failed", "error": "...", "at": "<ISO>" } } }
```
Written under the slug lock, like the rest of `project.json`.

## API
| Route | Does |
|---|---|
| `POST /projects/:slug/approve` `{version, name}` | existing approve; 400 if the version is a legacy draft; then enqueues the upload job |
| `POST /projects/:slug/publish` `{version, name}` | retry / rename upload for the approved version |
| `DELETE /projects/:slug/renders/:version?drive=1` | delete as above; 409 if approved and not uploaded |

## UI (Renders screen)
- Card chip: "Đang tải lên Drive" (progress from rclone `--stats`), "Đã lên Drive · <name>", "Lỗi Drive" + "Thử lại".
- Replace the "Duyệt bản này làm gì?" text: approving copies the file to Drive folder `xuat-ban/`; other renders stay only on this machine.

## Errors
- rclone missing / remote not configured: upload job fails with the `rclone config` hint; approve itself stays done.
- Drive delete fails: local delete still happens; toast shows the Drive error.

## Delete project
Button "Xoá dự án" on the Projects card / Editor menu. Opens a dialog:
- Lists every render of the project **not yet on Drive** (`published[v].state != "done"`), each with a checkbox,
  kind ("1080p", or "Nháp 540p" for legacy drafts), size and date. Nothing ticked by default.
- Renders already on Drive are listed as "Đã lên Drive · <name>" (no action; Drive copy is never touched here).
- If the project has **no** version on Drive, the dialog title asks "Chưa có bản nào trên Drive — xoá luôn hay đẩy
  lên Drive rồi xoá?". Same list, same checkboxes.
- Buttons: "Xoá luôn" (nothing ticked) or "Đẩy N bản lên Drive rồi xoá".

Flow (one `io` job "Xoá dự án <slug>"):
1. Write `project.json.deleting = {uploads: [versions], state: "uploading"}`. While set, the project is read-only
   in the app (no edit, voice, render, approve) and shows status "Đang xoá".
2. Upload each ticked version to `xuat-ban/<slug>-<version>.mp4` (name conflict -> add `-2`, `-3`...). Record each in
   `published` as it finishes, so a retry skips the ones already done.
3. A failed upload retries automatically 3 times (10 s, 30 s, 90 s). Still failing -> job `failed`,
   `deleting.state = "failed"`, project card shows "Xoá dở: lỗi Drive" + "Thử lại" / "Huỷ xoá" (clears `deleting`,
   project usable again). Nothing local is deleted until **all** ticked uploads are `done`.
4. Then: `git rm -r --cached projects/<slug>` + commit "Delete project <slug>" (only if it has tracked files; git
   history keeps the approved storyboards), then `rm -rf projects/<slug>` (mp4s, snapshots, `audio/`, `preview/`).
   Shared `library/` and `music/` files are never deleted.
- Server restart while `deleting` is set: the project stays read-only with "Thử lại" / "Huỷ xoá".

API: `DELETE /projects/:slug` `{upload: ["reel-v3", ...]}` -> 202 job; `POST /projects/:slug/delete-cancel`.
409 if a render/voice job for the project is running.

## Out of scope
Offloading `library/` footage to Drive,
re-rendering an old version from its snapshot.
