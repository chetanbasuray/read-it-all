# Feeds

RSS/Atom fallback for a small set of publishers whose feeds carry the full article body. Looked up before the expensive browser-render tier so sites that block direct fetches still get a working path.

## FEED_RULES

`const FEED_RULES: Record<string, FeedRule> = { 'bylinetimes.com': { feedUrls: ['https://bylinetimes.com/feed/'] }, 'mashable.com': { feedUrls: ['https://mashable.com/feeds/rss/all'] }, 'pressinsider.com': { feedUrls: ['https://pressinsider.com/feed/'] }, }`

Domain-to-feed mapping for publishers whose feeds expose full article bodies.

## FeedRule

`interface FeedRule { feedUrls: string[]; }`

The feed URLs to try for a domain.

## FeedEntry

`interface FeedEntry { link: string | null;; guid: string | null;; title: string | null;; content: string | null;; summary: string | null;; author: string | null; }`

A normalized entry from a parsed feed, with content/summary as HTML strings.

## getFeedRule

`getFeedRule(url: string): FeedRule | null`

Returns the feed rule for a URL's domain, or `null` when the domain has no feed fallback.

## parseFeed

`parseFeed(xml: string): FeedEntry[]`

Parses an RSS or Atom document into normalized `FeedEntry` items.

## normalizeForMatch

`normalizeForMatch(rawUrl: string): string | null`

Normalizes a URL (lowercasing host, stripping protocol, trailing slash, and `www`) so an entry's link can be matched against the requested article URL.

## findEntryForUrl

`findEntryForUrl(entries: FeedEntry[], targetUrl: string): FeedEntry | null`

Finds the feed entry whose link best matches the target URL.
