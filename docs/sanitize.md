# HTML Sanitization

DOMPurify-based sanitizer applied to every piece of remote HTML that will be stored or rendered, so untrusted page markup cannot inject scripts into the reader view.

## sanitizeHtml

`sanitizeHtml(dirty: string): string`

Sanitizes raw HTML against an explicit allowlist of tags and attributes. Also strips common junk unrelated to article content: screen-reader-only helper nodes and OneTrust consent widgets.
