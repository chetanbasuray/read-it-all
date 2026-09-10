# Scraper

Core article-extraction pipeline. Fetches a URL through a chain of fallback tiers (direct fetch with rotating bot user agents, JSON-LD, DOM metadata, Readability, warmup cookies, AMP, feeds, browser render, Google Cache, Wayback Machine) and returns a sanitized `ArticleData`.

## ArticleData

`interface ArticleData { title: string;; content: string;; textContent: string;; excerpt: string;; byline: string | null;; image: string | null;; url: string;; views?: number; }`

The normalized shape every extraction tier returns, and the shape the reader and cache store.

## ScrapeError

`class ScrapeError`

Error thrown when every retrieval tier fails, with a `details` array naming each source actually tried.

## TakedownError

`class TakedownError`

Error thrown when the requested URL matches a publisher takedown notice; carries the `TakedownEntry` describing the request.

## isPaywallBoilerplate

`isPaywallBoilerplate(article: Pick<ArticleData, 'content' | 'textContent'>): boolean`

Detects subscription/marketing boilerplate ("subscribe to unlock") or the FT barrier widget in a candidate article, indicating a paywall wall rather than real content.

## declaresPaywalledContent

`declaresPaywalledContent(string): boo)ean { r`

Returns whether any JSON-LD on the page declares `isAccessibleForFree: false`, either on the article node or a named walled section.

## walledSectionTextLength

`walledSectionTextLength(ring, walled, lectors: string[]): numbe)| null { if`

Measures the text actually inside the sections the page's paywall markup names as walled, distinguishing a full subscriber page from a logged-out stub.

## extractFromJsonLd

`extractFromJsonLd(ring, ): Pic)rticleData, 'title' | 'content' | 'textContent' | 'byline' | 'image'> | null { con`

Extracts a complete article from `application/ld+json` `articleBody`, normalizing double-escaped entities and sanitizing the output. Returns `null` when no usable body exists.

## extractCanonicalUrl

`extractCanonicalUrl(ring, baseUr, string): strin)| null { con`

Resolves the page's canonical URL from `<link rel="canonical">` or `og:url`, rejecting non-http(s) protocols so a tracking wrapper never becomes the stored identity.

## extractFirstImage

`extractFirstImage(ring, baseUr, string): strin)| null { con`

Returns the lead image from `og:image`, `twitter:image`, or the first in-body `<img>`, resolving relative URLs against the page base.

## extractTitle

`extractTitle(): string |)ull { const $`

Extracts the article title from `og:title`, `twitter:title`, first `h1`, or `<title>`, stripping the publisher's `og:site_name` suffix.

## extractAuthor

`extractAuthor(): string |)ull { const s`

Extracts the byline from structured author metadata or DOM byline/author selectors, rejecting CMS placeholder names and unrendered timestamp widgets.

## articleFromFeedEntry

`articleFromFeedEntry(tent: string | null; summary: string | null; title: string | null; author: string | null }, url: str, ): Article)a | null { if (!en`

Builds an `ArticleData` from a feed entry when its body is long enough to be the full article rather than the summary/teaser, rejecting feeds that merely repeat their description.

## parseWithReadability

`parseWithReadability(, url: strin, : ArticleDa)a | null { try {`

Runs Mozilla Readability over the page DOM, then sanitizes, dedupes the lead image, and resolves the byline from the most trustworthy available source.

## extractArticle

`extractArticle(fetchUrl: st, ng, canonicalUrl, string = fetchUrl): ArticleData)| null { const pre`

Top-level extraction: applies site rules, resolves the canonical URL, and tries JSON-LD, metadata, and Readability tiers in order, rejecting paywalled teasers at each step.

## unreachableMessage

`unreachableMessage(cked: boole, , paywalled = fa, e): Promise<strin)> { let domain`

Builds the user-facing failure message, naming the publisher and the retrieval sources actually tried. A declared paywall and a blocked/unreachable page get distinct explanations.

## scrapeArticle

`scrapeArticle(kies?: stri, ): Promise<Artic)eData> { try { c`

Full scrape entry point: runs `attemptScrape`, records the outcome tier for domain stats, and lets `TakedownError`s pass through without counting as a scraping failure.
