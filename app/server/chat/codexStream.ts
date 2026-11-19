import type {Parsed} from './stream.ts';

type R = Record<string, unknown>;
const obj = (v: unknown): R | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as R : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const short = (s: string): string => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > 80 ? t.slice(0, 79) + '…' : t; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // goes to argv on resume
const LIMIT_RE = /usage limit|rate limit|429|quota/i;

/** `/bin/bash -lc '<cmd>'` → `<cmd>` */
export function shellCommand(cmd: string): string {
  const m = /^\S*bash -lc '([\s\S]*)'$/.exec(cmd);
  return m ? m[1].replace(/'\\''/g, "'") : cmd;
}

/** One `codex exec --json` line → the same shape the Claude parser returns. */
export function parseCodexLine(line: string): Parsed | null {
  let e: R | null;
  try { e = obj(JSON.parse(line)); } catch { return null; }
  if (!e) return null;
  const out: Parsed = {events: []};
  const item = obj(e.item);
  switch (e.type) {
    case 'thread.started': {
      const id = str(e.thread_id);
      if (id && UUID.test(id)) { out.init = true; out.threadId = id; }
      break;
    }
    case 'item.started':
      if (item?.type === 'command_execution' && str(item.command)) out.events.push({kind: 'tool', name: 'Bash', summary: short(shellCommand(item.command as string))});
      break;
    case 'item.completed':
      if (!item) break;
      if (item.type === 'agent_message' && str(item.text)) out.events.push({kind: 'text', text: item.text as string});
      else if (item.type === 'file_change' && Array.isArray(item.changes)) out.events.push({kind: 'tool', name: 'Edit', summary: short(item.changes.map(c => str(obj(c)?.path)).filter(Boolean).join(', '))});
      else if (item.type === 'mcp_tool_call') out.events.push({kind: 'tool', name: 'MCP', summary: short([str(item.server), str(item.tool)].filter(Boolean).join('.'))});
      else if (item.type === 'web_search') out.events.push({kind: 'tool', name: 'Search', summary: short(str(item.query) ?? '')});
      break;
    case 'turn.completed':
      out.result = {isError: false, message: null, costUsd: null, durationMs: null, http429: false};
      break;
    case 'turn.failed':
    case 'error': {
      const msg = str(obj(e.error)?.message) ?? str(e.message) ?? 'Codex báo lỗi';
      if (LIMIT_RE.test(msg)) out.limit = {status: 'rejected', resetsAt: null, utilization: null, type: null};
      if (e.type === 'turn.failed') out.result = {isError: true, message: msg, costUsd: null, durationMs: null, http429: false};
      else out.note = msg; // may be a retry notice; only shown if the process dies without a result
      break;
    }
  }
  return out;
}
