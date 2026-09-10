# Utilities

Small shared helpers used across the scraper, cache, and rules layers: URL cleaning/hashing, HTML-to-text conversion, hostname comparison, and regexes that several modules depend on.

## WWW_PREFIX_REGEX

`const WWW_PREFIX_REGEX = regex().start().literal('www.').toRegExp()`

Matches a leading `www.` prefix on a hostname, shared everywhere a hostname is normalized.

## HTML_TAG_REGEX

`const HTML_TAG_REGEX = regex().literal('<').noneOf('>').zeroOrMore().literal('>').toRegExp('g')`

Matches HTML tags so they can be stripped down to plain text.

## WHITESPACE_RUN_REGEX

`const WHITESPACE_RUN_REGEX = regex().whitespace().oneOrMore().toRegExp('g')`

Matches runs of whitespace so they can be collapsed to a single space.

## htmlToPlainText

`htmlToPlainText(html: string): string`

Converts HTML to plain text by substituting tags with spaces and decoding common entities, so excerpts read as real characters instead of markup escapes.

## cleanTrackingParams

`cleanTrackingParams(url: string): string`

Removes known tracking parameters (UTM, `fbclid`, `gclid`, `ref`, `*_ga`, and friends) from a URL so identical articles map to the same cache key.

## hashUrl

`hashUrl(url: string): string`

Returns a short SHA-256 hex digest of a URL, used as the storage id for articles and mappings.

## isSameSite

`isSameSite(a: string, b: string): boolean`

Compares two URLs' hostnames ignoring a leading `www.`.

## normalizeCookieInput

`normalizeCookieInput(input: string): string`

Rebuilds a real `name=value; ...` Cookie header from the tab-separated DevTools cookie table users paste, so control characters never reach a fetch request.
