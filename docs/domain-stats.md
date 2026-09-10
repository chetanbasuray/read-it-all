# Domain Stats

Per-domain scrape outcomes recorded in Redis, powering admin dashboards and letting failure messages state something true about a specific publisher instead of generic boilerplate.

## ScrapeTier

`type ScrapeTier = | 'direct-fetch' | 'warmup' | 'amp' | 'feed' | 'browser-render' | 'google-cache' | 'wayback' | 'failed'`

The retrieval tier that produced (or failed to produce) an article.

## recordDomainOutcome

`recordDomainOutcome(url: string, tier: ScrapeTier): Promise<void>`

Records one scrape outcome for the URL's domain. Fire-and-forget: a failed stats write never affects the scrape response.

## DomainStats

`interface DomainStats { domain: string;; total: number;; tiers: Record<ScrapeTier, number>;; successRate: number; }`

Aggregated per-domain counters, including the ratio of successful scrapes to total attempts.

## getDomainSuccessRate

`getDomainSuccessRate(url: string): Promise<{ total: number; successRate: number } | null>`

Returns how many scrapes a domain has seen and its success rate, or `null` when nothing has ever been recorded for it.

## getAllDomainStats

`getAllDomainStats(): Promise<DomainStats[]>`

Returns stats for every recorded domain, sorted by request volume so frequently-requested but poorly-supported domains surface first.
