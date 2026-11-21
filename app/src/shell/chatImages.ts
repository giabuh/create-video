export const CHAT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
export const MAX_CHAT_IMAGES = 4;
export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif'};

/** Which of `incoming` fit next to `have` already attached images, and the first reason any were refused. */
export function acceptImages<F extends {type: string; size: number}>(have: number, incoming: F[]): {ok: F[]; error: string | null} {
  const ok: F[] = [];
  let error: string | null = null;
  for (const f of incoming) {
    if (!EXT[f.type]) error ??= 'Chỉ nhận ảnh png, jpg, webp, gif';
    else if (f.size > MAX_CHAT_IMAGE_BYTES) error ??= 'Ảnh quá 10 MB';
    else if (have + ok.length >= MAX_CHAT_IMAGES) error ??= 'Tối đa 4 ảnh mỗi tin';
    else ok.push(f);
  }
  return {ok, error};
}

/** File name sent to the server: pasted images are often called "image.png" or have no usable name. */
export function uploadName(f: {name: string; type: string}): string {
  return /\.(png|jpe?g|webp|gif)$/i.test(f.name) ? f.name : `anh.${EXT[f.type] ?? 'png'}`;
}
