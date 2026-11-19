import {useQueryClient} from '@tanstack/react-query';
import type {Config} from '../../../shared/types.ts';
import {qk, useConfig, useSaveConfig} from '../../api/hooks.ts';
import type {HttpError} from '../../api/client.ts';
import {toast} from '../../ui/index.ts';

/** Saves `mut(latest config)` with the loaded mtime. A 409 reloads config.json and tells the user to retry. */
export function useConfigEdit() {
  const cfg = useConfig();
  const save = useSaveConfig();
  const qc = useQueryClient();
  const run = (mut: (c: Config) => Config, o: {ok?: string; onDone?(): void; onConflict?(): void} = {}) => {
    if (!cfg.data) return;
    save.mutate({config: mut(cfg.data.data), baseMtime: cfg.data.mtime}, {
      onSuccess: () => { if (o.ok) toast({title: o.ok, tone: 'success'}); o.onDone?.(); },
      onError: (e: HttpError) => {
        if (e.status === 409) {
          void qc.invalidateQueries({queryKey: qk.config});
          o.onConflict?.();
          toast({title: 'config.json vừa được sửa ở nơi khác — đã tải lại, hãy thử lại', tone: 'info'});
        } else toast({title: 'Không lưu được config.json', description: e.message, tone: 'error'});
      },
    });
  };
  return {cfg, saving: save.isPending, run};
}
