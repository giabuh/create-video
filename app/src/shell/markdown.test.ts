// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import {mdToHtml} from './markdown.ts';

describe('mdToHtml', () => {
  it('renders bold and tables', () => {
    const h = mdToHtml('**a**\n\n|x|y|\n|-|-|\n|1|2|');
    expect(h).toContain('<strong>a</strong>');
    expect(h).toContain('<table>');
  });
  it('escapes raw html and drops unsafe links', () => {
    const h = mdToHtml('<script>alert(1)</script> <img src=x onerror=1>\n\nxem [c](javascript:alert(1)) [d](https://x.vn) ![i](https://x.vn/a.png)');
    expect(h).not.toContain('<script');
    expect(h).not.toContain('<img');
    expect(h).not.toContain('href="javascript');
    expect(h).toContain('href="https://x.vn"');
    expect(h).toContain('target="_blank"');
  });
});
