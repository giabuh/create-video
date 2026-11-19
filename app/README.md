# Reel Studio app

Local web UI for the reel pipeline: projects, storyboard editor with live Remotion preview, voice generation, renders, media library, voices and settings.

## Run

```
npm ci                      # once, from the repo root (setup.sh does this)
cd app
npm start                   # API http://127.0.0.1:5316 + UI http://127.0.0.1:5317
npm run dev                 # same, API restarts on server changes
```

Open http://127.0.0.1:5317. Both servers bind 127.0.0.1 only; Vite proxies `/api` and the media roots to the API.

## Test

```
cd app
npm test                    # vitest (server + UI units)
npx tsc --noEmit            # typecheck
npx playwright install chromium   # once, dev-only (not part of setup.sh)
npm run e2e                 # Playwright; reuses a running server on 5316/5317, else starts `npm start`
```

The E2E test runs a real voice job (GPU TTS) and a real draft render on a scratch project `e2e-<timestamp>` copied from `projects/_smoke`, then deletes it.

## Architecture

`server/` is a Hono API run with plain `node` (type stripping, erasable TypeScript only). It reads and writes the same files as the CLI pipeline (`projects/<slug>/storyboard.json`, `library/media-index.json`, `config.json`, `brands/`), runs jobs (ingest, voice, render, preview) through a queue with GPU and render lanes, keeps the VieNeu voice worker warm, and pushes jobs and file changes to the UI over SSE (`/api/events`). `src/` is a React 19 + react-router + TanStack Query UI that previews the `studio/` Remotion composition with `@remotion/player`. `shared/` holds types used by both sides. There is no production build; the UI is served by Vite.

## Where things live

- `app/server/` API, jobs, voice worker, render, git approve; `server/routes/` one file per area
- `app/src/screens/` Projects, Editor, Renders, Library, Voices, Settings; `src/ui/` shared components; `src/shell/` layout
- `app/shared/` shared types; `app/e2e/` Playwright test; `app/.scratch/` git-ignored throwaway scripts
- `studio/src/` Remotion composition and motion graphics (also imported by the app as `@studio/*`)
- Data: `projects/`, `library/`, `music/`, `brands/`, `voices/`, `config.json` at the repo root
