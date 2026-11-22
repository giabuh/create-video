export function slugify(s: string): string {
  const a = s.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase();
  return a.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
}
