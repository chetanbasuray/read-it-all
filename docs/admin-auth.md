# Admin Authentication

Bearer-token gate shared by every internal (not linked from the UI) endpoint that re-scrapes or administers content.

## isAuthorizedAdminRequest

`isAuthorizedAdminRequest(request: NextRequest): boolean`

Accepts a `NextRequest` and returns whether its `Authorization` header carries one of the valid admin tokens (`RESCRAPE_TOKEN` or the independently revocable `RESCRAPE_TOKEN_AGENT`). Comparison is constant-time via `timingSafeEqual`.
