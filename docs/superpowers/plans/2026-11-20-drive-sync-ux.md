# Plan — Drive sync UX (2026-11-20)

Spec: `docs/superpowers/specs/2026-11-20-drive-sync-ux-design.md` (read the section named in your task).
Shared contract is already in place (spec "Already done") — do not change `shared/types.ts` or `server/drive.ts`
signatures; ask the main session if you need a change.

Rules for every task: Vietnamese UI text; follow existing patterns (Hono routes in `app/server/routes/*`, React Query
hooks, `app/src/ui/*` components, CSS modules). Run only the tests for files you touch plus
`cd app && npx tsc --noEmit`. Stage/commit nothing — the main session commits. Only edit files your task owns.

## T1 — Server: render push / Drive status / delete render / delete project  (worker-sonnet)
Owns: `app/server/publish.ts`, `app/server/deleteProject.ts`, `app/server/routes/projects.ts`, `app/server/versions.ts`
(`nextVersion` only), their tests. High-risk (deletion): per-task review by worker-opus.
Spec sections: "Push render", "Drive status", "Delete render", "Delete project".
Done: endpoints and job behaviour as specified, tests cover verify-after-upload (ok + mismatch), drive status
(ok/missing/orphan/error), delete with drive=1 returning `driveJob`, drive-delete of an already-missing file,
re-push of done-but-missing and done-but-mismatch versions, delete-project retry step text, delete-project refusing
to `rm` when a version is not verified on Drive, `nextVersion` skipping published/renders keys.

## T2 — Server: library sync  (worker-sonnet)
Owns: new `app/server/sync.ts`, new `app/server/routes/sync.ts`, registration in `app/server/app.ts`, tests.
Spec section: "Library sync". Use `rclone`/`parseStats`/`statsText`/`STATS_FLAGS`/`fail` from `drive.ts`, remote
from `config.json` `sync.remote` (see `publishDir()` for how config is read). Local folders are repo-root relative.
Done: status parsing of `--combined` output tested with a fake runner (incl. exit 1 and missing remote dir),
push/pull job (step text, pull exit-3 skip, 409 when busy, sync-state saved).

## T3 — UI: global Drive toasts + Renders screen  (worker-sonnet)
Owns: `app/src/screens/Renders/*`, `app/src/api/hooks.ts` (drive status / drive-delete / delete-render hooks),
new `app/src/shell/DriveToasts.tsx` mounted from `app/src/shell/Layout.tsx`.
Spec sections: "Global", "Renders screen". Server API is being built in parallel by T1 — code against the spec.
Also owns `app/src/ui/*` (e.g. make `Chip` truncate with ellipsis + title; a radio group if needed) — T4 must not
edit `app/src/ui/*`; T4 may use what exists or ask.
Done: tsc + unit tests for touched files (add tests for pure helpers such as status-row state mapping and the toast
message builder). No screenshots — the API is not live until T1 lands; the main session does visual QA.

## T4 — UI: Library Drive drawer + Projects deleting progress  (worker-sonnet)
Owns: `app/src/screens/Library/*`, `app/src/screens/Projects/*`, new `app/src/api/sync.ts` (hooks for /sync/* and a
`useDriveStatus` copy is NOT needed — fetch `/projects/:slug/drive` via a small local hook in the Projects folder).
Do not edit `app/src/ui/*` (T3 owns it).
Spec sections: "Projects screen", "Library screen". Server API (T2) is built in parallel — code against the spec.
Done: tsc + unit tests for touched files (test the status-table / step formatting helpers). No screenshots — the
main session does visual QA after merge.

## Order
T1–T4 run in parallel. Then main session: restart the API (`npm start` = node server + vite; UI is live via vite),
Playwright screenshots of Projects / Renders / Library at 1440, 1100, 390 and fix overflow/alignment, end-to-end check
on the real remote, final review, full test suite, commit.
Note for the user: Drive `xuat-ban/` has `reel-v1.mp4` with no project record — not surfaced by the orphan list.

## Status
- [x] T1 (opus review: fixed 423 on drive-delete, no duplicate drive-delete job)  - [x] T2 (review: mixed exit-1 error, cancel race)
- [x] T3 (review approved)  - [x] T4 (review: summary line wired)
- [x] final review: added 60s deadline for read-only rclone checks (Drive stalls seen live: 35s+), drawer footer
  overflow, Chip no longer shrinks, Tabs/Projects filter scroll instead of wrapping at 390px.
- Parked (minor, from T1 review): crash during repush leaves 'failed' record + wrong-size file on Drive; a failed
  size-check upload leaves the bad file on Drive; repush trusts rec.name from project.json. Sync jobs share the io lane
  with publish jobs (a long library push delays a render push).
