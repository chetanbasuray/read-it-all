# URL Safety

## validateUrl

```typescript
validateUrl(rawUrl: string): Promise<void>
```

Validates that a URL does not resolve to a loopback, private, or link-local IP address. Throws on invalid URLs, unsupported protocols, and internal addresses.

## safeFetch

```typescript
safeFetch(url: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response>
```

Like `fetch` but validates every redirect hop with `validateUrl` to prevent SSRF via open redirect.
