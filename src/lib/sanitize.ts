import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'ul', 'ol', 'li', 'em', 'strong', 'figure', 'figcaption',
  'br', 'hr', 'pre', 'code', 'span', 'div', 'sup', 'sub',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'id',
  'width', 'height',
];

// screen-reader-only labels (visually-hidden/sr-only, a standard accessibility
// convention across many sites, not specific to any one domain) are invisible to
// sighted readers via CSS we never apply, so left in they show up as literal text
const SR_ONLY_CLASS_PATTERN = /(^|\s)(visually-hidden|sr-only|screen-reader-text|a11y-hidden)(\s|$)/i;

DOMPurify.addHook('uponSanitizeElement', (node) => {
  if (node.nodeType !== 1) return;
  const className = (node as Element).getAttribute('class');
  if (className && SR_ONLY_CLASS_PATTERN.test(className)) {
    node.parentNode?.removeChild(node);
  }
});

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
