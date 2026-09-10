# URL Safety

## validateUrl

`validateUrl(rawUrl: string): Promise<void>`

Validates that a URL does not resolve to a loopback, private, or link-local IP address. Throws on invalid URLs, unsupported protocols, and internal addresses.

## normalizeAndValidateUrl

`normalizeAndValidateUrl(rawUrl: string): Promise<string>`

Normalizes a user-supplied URL, enforces the http/https protocol allowlist, and re-validates it with `validateUrl`. Shared by every route that accepts a scrape URL so the normalize/protocol/SSRF checks cannot drift out of sync between them.

## safeFetch

`safeFetch(url: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response>`

Like `fetch` but validates every redirect hop with `validateUrl` to prevent SSRF via open redirect.
