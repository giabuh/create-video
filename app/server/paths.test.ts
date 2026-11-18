import {describe, expect, it} from 'vitest';
import {MEDIA_EXTS, PathError, SLUG_RE, safeJoin, sanitizeFilename, slugify} from './paths.ts';

describe('paths', () => {
  it('safeJoin ok', () => expect(safeJoin('projects', 'p1', 'storyboard.json')).toMatch(/\/projects\/p1\/storyboard\.json$/));
  it.each([['..'], ['a/../../x'], ['/etc/passwd'], [''], ['a\0b'], ['a\\..\\x'], ['.'], ['a/.']])('safeJoin rejects %j', p => {
    expect(() => safeJoin('projects', p)).toThrow(PathError);
  });
  it('slugify', () => expect(slugify('Ảnh Lớp 05 (đẹp)')).toBe('anh-lop-05-dep'));
  it('slugify empty', () => expect(slugify('!!!')).toBe('media'));
  it('sanitizeFilename', () => {
    expect(sanitizeFilename('IMG 2041.MOV', MEDIA_EXTS)).toBe('img-2041.mov');
    expect(() => sanitizeFilename('x.exe', MEDIA_EXTS)).toThrow(PathError);
    expect(() => sanitizeFilename('../x.mov', MEDIA_EXTS)).toThrow(PathError);
    expect(() => sanitizeFilename('a\\b.mov', MEDIA_EXTS)).toThrow(PathError);
  });
  it('SLUG_RE', () => { expect(SLUG_RE.test('_smoke')).toBe(true); expect(SLUG_RE.test('../x')).toBe(false); });
});
