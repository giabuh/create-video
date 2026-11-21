import {randomUUID} from 'node:crypto';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {chatDir} from './store.ts';

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES: Readonly<Record<string, string>> = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'};
export const IMAGE_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/;

export const imageDir = (chatId: string): string => path.join(chatDir(), 'images', chatId);
export const imagePath = (chatId: string, name: string): string => path.join(imageDir(chatId), name);
export const newImageName = (ext: string): string => `${randomUUID()}${ext}`;

export async function imageExists(chatId: string, name: string): Promise<boolean> {
  if (!IMAGE_NAME_RE.test(name)) return false;
  try { return (await stat(imagePath(chatId, name))).isFile(); } catch { return false; }
}

/** The prompt the CLI gets: the user's text, then the absolute paths of the attached images. */
export function promptWithImages(text: string, paths: string[]): string {
  if (!paths.length) return text;
  const block = `Attached images (open each file to look at it):\n${paths.map(p => `- ${p}`).join('\n')}`;
  return text ? `${text}\n\n${block}` : block;
}
