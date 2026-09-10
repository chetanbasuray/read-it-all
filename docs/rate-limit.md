# Rate Limiting

Fixed-window rate limiting over the same Redis connection used for article caching. Fails open: a Redis outage degrades to no rate limiting rather than taking the app down.

## getClientIp

`getClientIp(request: NextRequest): string`

Extracts the original client IP from `x-forwarded-for` (first entry) or `x-real-ip`, defaulting to `unknown`.

## checkRateLimit

`checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>`

Checks a fixed-window counter (single `INCR` plus a one-time `EXPIRE` per window) and returns whether the request is allowed along with the seconds until the window resets.
