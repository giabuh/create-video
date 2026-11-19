import type {ChatEvent} from '../../shared/types.ts';

export const draftAfter = (draft: string, e: ChatEvent): string => (e.kind === 'delta' ? draft + e.text : '');
export function isInterrupted(events: ChatEvent[], running: boolean): boolean {
  const k = events.at(-1)?.kind;
  return !running && (k === 'user' || k === 'text' || k === 'tool');
}
export function limitText(l: {account: string; resetsAt: number | null}): string {
  if (l.resetsAt == null) return `${l.account} hết limit`;
  const t = new Date(l.resetsAt * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', hour12: false});
  return `${l.account} hết limit (reset ${t})`;
}
