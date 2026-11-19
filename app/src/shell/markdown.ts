import DOMPurify from 'dompurify';
import {marked} from 'marked';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Agent output is untrusted text: raw HTML is shown escaped and only http(s) links stay clickable.
marked.use({gfm: true, breaks: true, renderer: {
  html: ({text}) => esc(text),
  link({href, tokens}) {
    const label = this.parser.parseInline(tokens);
    return /^https?:\/\//i.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noreferrer">${label}</a>` : label;
  },
  image: ({text}) => esc(text),
}});

// DOMPurify is the real guard; the renderer overrides above are defense in depth.
export const mdToHtml = (src: string): string => DOMPurify.sanitize(marked.parse(src, {async: false}), {
  FORBID_TAGS: ['style', 'img', 'iframe', 'form', 'svg', 'math'], FORBID_ATTR: ['style'], ADD_ATTR: ['target'],
});
