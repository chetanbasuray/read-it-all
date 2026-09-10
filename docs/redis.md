# Redis Cache

Vercel KV (Upstash Redis) layer behind article caching. Two keyspaces back every `/reader/<id>` link: a content entry keyed by a URL hash, and a permanent id-to-URL mapping that survives content eviction.

## getCacheKey

`getCacheKey(url: string): string`

Returns the Redis key for an article's cached content: `article:` plus the SHA-256 URL hash.

## refreshIfStale

`refreshIfStale(article: CachedArticle): Promise<void>`

Re-scrapes the article in the background when its `scrapedAt` is older than the staleness threshold. A short-lived Redis lock (`nx` + TTL) prevents concurrent visits from all triggering a re-scrape; failures keep serving the stale copy.

## getCachedArticle

`getCachedArticle(url: string): Promise<ArticleData | null>`

Reads the cached article for a URL, bumping its sliding TTL and triggering a stale refresh via `waitUntil`. Returns `null` when Redis is unconfigured, the entry is absent, or a read fails.

## setCachedArticle

`setCachedArticle(url: string, article: ArticleData): Promise<void>`

Stores an article under its URL hash with the sliding TTL, re-sanitizing its content, and records the permanent url mapping. Cache failures are swallowed as non-critical.

## forceRescrapeArticle

`forceRescrapeArticle(url: string): Promise<ArticleData>`

Scrapes fresh whether or not a cache entry exists, resets `scrapedAt`, and replaces the cached content. On failure it evicts the cached article so known-wrong content is never served.

## CachedArticleSummary

`interface CachedArticleSummary { id: string;; url: string;; scrapedAt: number | null;; canonicalUrl: string | null; }`

Lightweight listing entry for the admin view: the mapping id and url, the content's scrape time (null once the content entry expired), and the canonical url used to detect duplicate entries for one piece.

## listCachedArticles

`listCachedArticles(cursor: string, limit: number): Promise<{ cursor: string; items: CachedArticleSummary[] }>`

Pages through the permanent `mapping:` index with `SCAN` (never `KEYS`, which blocks the live database), joining each mapping with its content entry's scrape time and canonical url.

## refreshCachedArticle

`refreshCachedArticle(url: string): Promise<ArticleData>`

Scrapes and re-caches an article for a sweep, unconditionally replacing content even when a site happens to be blocking, rather than evicting it like a forced rescrape would.

## evictCachedArticle

`evictCachedArticle(url: string): Promise<void>`

Removes the cached content entry for a URL, leaving the permanent mapping alone so an expired link can be re-scraped under the same id.

## getArticleById

`getArticleById(id: string): Promise<ArticleData | null>`

Reads a cached article directly by its mapping id, with the same TTL bump and stale-refresh behavior as `getCachedArticle`.

## getUrlForId

`getUrlForId(id: string): Promise<string | null>`

Looks up the original URL for a mapping id. Survives content eviction, so an expired link can be silently re-scraped under the same id.

## getArticleViews

`getArticleViews(id: string): Promise<number>`

Reads the view counter for an article id, returning `0` when Redis is unconfigured or the counter is absent.

## incrementArticleViews

`incrementArticleViews(id: string): Promise<number>`

Atomically increments and returns the view counter for an article id, returning `0` on failure.
