import {describe, expect, it} from 'vitest';
import {acceptImages, uploadName} from './chatImages.ts';

const png = (size = 1024) => ({name: 'a.png', type: 'image/png', size});

describe('acceptImages', () => {
  it('accepts png and jpeg', () => {
    const r = acceptImages(0, [png(1024), {name: 'b.jpg', type: 'image/jpeg', size: 2048}]);
    expect(r.ok).toHaveLength(2);
    expect(r.error).toBeNull();
  });
  it('refuses svg', () => {
    expect(acceptImages(0, [{name: 'x.svg', type: 'image/svg+xml', size: 1}])).toEqual({ok: [], error: 'Chỉ nhận ảnh png, jpg, webp, gif'});
  });
  it('refuses over 10 MB', () => {
    expect(acceptImages(0, [png(10 * 1024 * 1024 + 1)])).toEqual({ok: [], error: 'Ảnh quá 10 MB'});
  });
  it('caps at 4 per message', () => {
    const r = acceptImages(3, [png(), png()]);
    expect(r.ok).toHaveLength(1);
    expect(r.error).toBe('Tối đa 4 ảnh mỗi tin');
  });
});

describe('uploadName', () => {
  it('keeps a real image name', () => expect(uploadName({name: 'image.png', type: 'image/png'})).toBe('image.png'));
  it('names an empty one by type', () => expect(uploadName({name: '', type: 'image/jpeg'})).toBe('anh.jpg'));
  it('replaces a name without extension', () => expect(uploadName({name: 'blob', type: 'image/webp'})).toBe('anh.webp'));
});
