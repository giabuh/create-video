const tails = new Map<string, Promise<unknown>>();

export function withSlugLock<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  const next = (tails.get(slug) ?? Promise.resolve()).catch(() => {}).then(fn);
  tails.set(slug, next);
  void next.then(() => {}, () => {}).then(() => { if (tails.get(slug) === next) tails.delete(slug); });
  return next;
}
