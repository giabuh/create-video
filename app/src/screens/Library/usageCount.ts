/** usage ("<slug> · <sceneId>" per scene) -> number of distinct projects using each media file */
export function projectCounts(usage: Record<string, string[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(usage).map(([n, u]) => [n, new Set(u.map((x) => x.split(' · ')[0])).size]));
}

/** least-used first; stable, so the index order breaks ties */
export const byUsage = (counts: Record<string, number>) => ([a]: [string, unknown], [b]: [string, unknown]) => (counts[a] ?? 0) - (counts[b] ?? 0);

export const usageLabel = (n: number) => (n ? `Dùng ${n}` : 'Mới');
