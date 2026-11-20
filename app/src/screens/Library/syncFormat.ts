import type {SyncFolder, SyncStatus} from '../../../shared/types.ts';

export const FOLDER_LABEL: Record<SyncFolder, string> = {library: 'Ảnh & video', music: 'Nhạc', sfx: 'Hiệu ứng âm thanh', reference: 'Tham khảo'};

/** "Chưa từng" / "hôm nay hh:mm" / "dd/mm hh:mm". */
export function fmtWhen(ms: number | null, now: number = Date.now()): string {
  if (ms == null) return 'Chưa từng';
  const d = new Date(ms), n = new Date(now);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === n.toDateString()) return `hôm nay ${hm}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
}

/** Totals across folders, for the "N file cần đẩy / kéo" hint. */
export function syncTotals(st: SyncStatus): {localOnly: number; driveOnly: number; differ: number} {
  return st.folders.reduce((a, f) => ({localOnly: a.localOnly + f.localOnly, driveOnly: a.driveOnly + f.driveOnly, differ: a.differ + f.differ}), {localOnly: 0, driveOnly: 0, differ: 0});
}
