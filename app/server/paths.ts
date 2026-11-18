import path from 'node:path';

let root: string | null = null;
export function repoRoot(): string {
  return root ?? process.env.REEL_ROOT ?? path.resolve(import.meta.dirname, '..', '..');
}
export function setRepoRoot(p: string): void { root = p; }

export const ROOT_DIRS = {projects: 'projects', library: 'library', music: 'music', brands: 'brands', voices: 'voices', inbox: 'inbox'} as const;
export type RootKey = keyof typeof ROOT_DIRS;
export class PathError extends Error {}

export function safeJoin(rootKey: RootKey, ...parts: string[]): string {
  const base = path.join(repoRoot(), ROOT_DIRS[rootKey]);
  for (const p of parts) {
    if (typeof p !== 'string' || p === '' || p.includes('\0') || path.isAbsolute(p) || p.startsWith('/') || p.startsWith('\\')) throw new PathError(`bad path part: ${JSON.stringify(p)}`);
    if (p.split(/[\\/]/).some(x => x === '..' || x === '.')) throw new PathError(`bad path part: ${JSON.stringify(p)}`);
  }
  const abs = path.resolve(base, ...parts);
  if (!abs.startsWith(base + path.sep)) throw new PathError('path escapes root');
  return abs;
}

export const rel = (abs: string): string => path.relative(repoRoot(), abs).split(path.sep).join('/');

export const SLUG_RE = /^[a-z0-9_][a-z0-9_-]{0,63}$/;
export function slugify(s: string): string {
  const a = s.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase();
  return a.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
}

export const MEDIA_EXTS: readonly string[] = ['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi', '.3gp', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
export const MUSIC_EXTS: readonly string[] = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
export const AUDIO_REF_EXTS: readonly string[] = ['.wav', '.mp3', '.m4a', '.ogg', '.flac'];
export const IMAGE_EXTS: readonly string[] = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

export function sanitizeFilename(name: string, allowedExts: readonly string[]): string {
  if (/[\\/\0]/.test(name)) throw new PathError('bad filename');
  const ext = path.extname(name).toLowerCase();
  if (!allowedExts.includes(ext)) throw new PathError(`extension not allowed: ${ext}`);
  return slugify(name.slice(0, name.length - ext.length)) + ext;
}
