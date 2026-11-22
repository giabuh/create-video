import {toast} from '../ui/Toast.tsx';

type Failure = {status?: number; message: string};

export const toastConflict = (title = 'File vừa được sửa bên ngoài — đã tải lại'): void => { toast({title, tone: 'info'}); };

/** Shared toast for a failed save/delete: 409 = file changed outside (`conflict: false` = not a conflict here), 423 = ingest holds the library, else `fail` (nothing when omitted). */
export function toastSaveError(e: Failure, fail?: string, opts: {conflict?: string | false} = {}): void {
  if (e.status === 409 && opts.conflict !== false) toastConflict(opts.conflict);
  else if (e.status === 423) toast({title: 'Đang nạp media vào thư viện — thử lại sau khi xong', tone: 'info'});
  else if (fail) toast({title: fail, description: e.message, tone: 'error'});
}
