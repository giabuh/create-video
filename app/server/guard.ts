import type {MiddlewareHandler} from 'hono';

export function hostGuard(ports: number[]): MiddlewareHandler {
  const hosts = new Set(ports.flatMap(p => [`127.0.0.1:${p}`, `localhost:${p}`]));
  const origins = new Set([...hosts].map(h => `http://${h}`));
  return async (c, next) => {
    if (!hosts.has(c.req.header('host') ?? '')) return c.json({error: 'forbidden host'}, 403);
    const origin = c.req.header('origin');
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && origin !== undefined && !origins.has(origin)) return c.json({error: 'forbidden origin'}, 403);
    await next();
  };
}
