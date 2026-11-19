import type {ChatEvent, LimitInfo} from '../../shared/types.ts';

export type Parsed = {
  events: ChatEvent[];
  init?: true;
  limit?: LimitInfo;
  result?: {isError: boolean; message: string | null; costUsd: number | null; durationMs: number | null; http429: boolean};
};
type R = Record<string, unknown>;
const obj = (v: unknown): R | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as R : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt'];
export function toolSummary(input: unknown): string {
  const o = obj(input);
  const v = o && SUMMARY_KEYS.map(k => str(o[k])).find(Boolean);
  if (!v) return '';
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > 80 ? s.slice(0, 79) + '…' : s;
}

export function parseLine(line: string): Parsed | null {
  let e: R | null;
  try { e = obj(JSON.parse(line)); } catch { return null; }
  if (!e) return null;
  const out: Parsed = {events: []};
  const top = e.parent_tool_use_id == null; // subagent traffic is not shown
  switch (e.type) {
    case 'system':
      if (e.subtype === 'init') out.init = true;
      break;
    case 'stream_event': {
      const ev = obj(e.event), d = obj(ev?.delta);
      if (top && ev?.type === 'content_block_delta' && d?.type === 'text_delta' && str(d.text)) out.events.push({kind: 'delta', text: d.text as string});
      break;
    }
    case 'assistant': {
      const content = obj(e.message)?.content;
      if (!top || !Array.isArray(content)) break;
      for (const b of content.map(obj)) {
        if (b?.type === 'text' && str(b.text)) out.events.push({kind: 'text', text: b.text as string});
        else if (b?.type === 'tool_use') out.events.push({kind: 'tool', name: str(b.name) ?? '?', summary: toolSummary(b.input)});
      }
      break;
    }
    case 'rate_limit_event': {
      const i = obj(e.rate_limit_info) ?? {};
      out.limit = {status: str(i.status) ?? 'unknown', resetsAt: num(i.resetsAt), utilization: num(i.utilization), type: str(i.rateLimitType)};
      break;
    }
    case 'result': {
      const errors = Array.isArray(e.errors) ? e.errors.map(String) : [];
      out.result = {
        isError: e.is_error === true || e.subtype !== 'success',
        message: str(e.result) || (errors.length ? errors.join('\n') : null),
        costUsd: num(e.total_cost_usd), durationMs: num(e.duration_ms), http429: e.api_error_status === 429,
      };
      break;
    }
  }
  return out;
}
