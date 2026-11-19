# In-app Codex chat (Sub-project 3, part B) — Design

Date: 2026-11-19
Status: approved
Parent: `2026-11-19-app-claude-chat-design.md` (part A). Same panel, same runner interface, second engine.

## Goal

Chat with OpenAI Codex from the same slide-over panel, next to Claude. A chat is either a Claude chat or a Codex chat for its whole life.

## Decisions

- **Engine locked per chat.** "Phiên mới" becomes a menu: "Phiên Claude" / "Phiên Codex". Claude and Codex sessions cannot resume each other.
- **One Codex account** (`~/.codex`, detected by `~/.codex/auth.json`). Listed as account `codex` (engine `codex`). No CODEX_HOME switching.
- **Permissions: `--yolo`** (codex's alias of `--dangerously-bypass-approvals-and-sandbox`), the user's choice, same protection as part A (hostGuard + 127.0.0.1).
- **One running turn app-wide**, across both engines.
- **Project rules:** codex reads `AGENTS.md`, not `CLAUDE.md`. Add `AGENTS.md` as a symlink to `CLAUDE.md` at the repo root.

## CLI (verified with codex-cli 0.170.0)

- First turn: `codex exec --json --yolo --skip-git-repo-check -c developer_instructions=<TOML string> -` (prompt on stdin, cwd = repo root).
- Later turns: `codex exec resume --json --yolo --skip-git-repo-check -c developer_instructions=<…> <threadId> -`.
- `developer_instructions` carries the same app context as Claude's `--append-system-prompt` (verified: the model sees it, and a new value on resume replaces the old).
- Codex generates the thread id; the app cannot pre-assign it. It arrives in the first line `{"type":"thread.started","thread_id":"<uuid>"}` and is stored as `threadId` on the chat.
- Events (real capture):
  - `thread.started` → init + threadId (accepted only if it matches the uuid shape: it goes to argv later)
  - `item.started` with `item.type: command_execution` → `tool "Bash"`, summary = the command with the `/bin/bash -lc '…'` wrapper removed
  - `item.completed`: `agent_message` → `text`; `file_change` → `tool "Edit"` (changed paths); `mcp_tool_call` → `tool "MCP"`; `web_search` → `tool "Search"`; `reasoning`, `todo_list`, `command_execution` (already shown on start) → ignored
  - `turn.completed` → `done` (`costUsd: null`; `durationMs` measured by the runner)
  - `turn.failed` → `error` with `error.message`; `error` events are non-terminal (may be retries) and only become the fallback message
  - any failure message matching `/usage limit|rate limit|429|quota/i` → error with `limit` (`resetsAt: null`)
  - resume with an unknown thread: stderr `Error: thread/resume: … no rollout found …`, exit 1 → error with that line
- No text streaming (no deltas): the panel shows the spinner until each message arrives.
- No cost reported.

## Data

- `ChatMeta` gains `engine: 'claude' | 'codex'` and `threadId: string | null`. Index entries written by part A lack them and read as `engine: 'claude'`, `threadId: null`.
- `ChatAccount` and the server `Account` gain `engine`.
- Claude chats are unchanged (chat id = Claude session id). Codex chats: `resume = threadId !== null`.

## Server

- `POST /chats {slug?, engine?}`: engine defaults to `claude`; anything else but `codex` → 400; no detected account for the engine → 400. The new chat's account = first detected account of that engine.
- `POST /chats/:id/messages`: the account must be detected **and** have the chat's engine, else 400.
- Runner: same `runTurn`; the account's engine picks binary (`REEL_CODEX_BIN`, default `codex`), argv and line parser. `onInit` receives the thread id (null for Claude).

## UI

- "Phiên mới" → dropdown "Phiên Claude" / "Phiên Codex" (Codex item disabled when no codex account).
- Chat picker items carry the engine as hint; panel title shows the current chat's engine ("Chat với Claude" / "Chat với Codex").
- Account picker lists only accounts of the chat's engine (so a Codex chat shows just `codex`).
- Sending in the empty panel (no chat yet) creates a Claude chat, as today.

## Testing

- Unit: codex line parser against a fixture built from the real capture plus failure/limit lines.
- Runner: `fake-codex.mjs` via `REEL_CODEX_BIN` (new + resume + limit + bad thread), argv test.
- Routes: create with engine, engine/account mismatch → 400, codex two turns resume the stored thread.
- E2E (fake binaries): create a Codex chat, send, see text + tool line, send again → resume of the same thread.
- No test spends real quota.

## Out of scope

Model picker, several Codex accounts, text streaming for Codex, token/cost display.
