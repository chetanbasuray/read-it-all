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

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
