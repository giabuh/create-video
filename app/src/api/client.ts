import type {ApiError} from '../../shared/types.ts';

export class HttpError extends Error {
  status: number;
  body: ApiError | null;
  constructor(status: number, body: ApiError | null) {
    super(body?.error ?? `HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(path: string, init: {method?: string; body?: unknown; signal?: AbortSignal} = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (hasBody ? 'POST' : 'GET'),
    headers: hasBody ? {'Content-Type': 'application/json'} : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) { try { json = JSON.parse(text); } catch { /* non-JSON error page from a proxy */ } }
  if (!res.ok) throw new HttpError(res.status, json && typeof json === 'object' && 'error' in json ? (json as ApiError) : null);
  return json as T;
}
