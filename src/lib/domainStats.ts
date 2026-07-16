import { kv } from '@vercel/kv';

export type ScrapeTier =
  | 'direct-fetch'
  | 'amp'
  | 'browser-render'
  | 'google-cache'
  | 'wayback'
  | 'failed';

const ALL_TIERS: ScrapeTier[] = [
  'direct-fetch',
  'amp',
  'browser-render',
  'google-cache',
  'wayback',
  'failed',
];

const isRedisConfigured = !!(process.env.KV_URL || process.env.KV_REST_API_URL);

const DOMAINS_SET_KEY = 'domain-stats:domains';

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getDomainStatsKey(domain: string): string {
  return `domain-stats:${domain}`;
}

// called from scrapeArticle as fire-and-forget: a failed stats write should
// never affect the actual scrape response
export async function recordDomainOutcome(url: string, tier: ScrapeTier): Promise<void> {
  if (!isRedisConfigured) return;
  const domain = getDomain(url);
  if (!domain) return;
  try {
    await kv.sadd(DOMAINS_SET_KEY, domain);
    await kv.hincrby(getDomainStatsKey(domain), tier, 1);
    await kv.hincrby(getDomainStatsKey(domain), 'total', 1);
  } catch {
    // best-effort; a dropped stats write is not worth surfacing to the caller
  }
}

export interface DomainStats {
  domain: string;
  total: number;
  tiers: Record<ScrapeTier, number>;
  successRate: number;
}

// sorted by request volume: the issue this backs is specifically about
// surfacing "frequently requested but poorly supported" domains
export async function getAllDomainStats(): Promise<DomainStats[]> {
  if (!isRedisConfigured) return [];
  try {
    const domains = await kv.smembers(DOMAINS_SET_KEY);
    const results: DomainStats[] = [];
    for (const domain of domains) {
      const hash = (await kv.hgetall<Record<string, number>>(getDomainStatsKey(domain))) ?? {};
      const total = hash.total ?? 0;
      const tiers = Object.fromEntries(ALL_TIERS.map((tier) => [tier, hash[tier] ?? 0])) as Record<
        ScrapeTier,
        number
      >;
      const successRate = total > 0 ? Number(((total - tiers.failed) / total).toFixed(3)) : 0;
      results.push({ domain, total, tiers, successRate });
    }
    return results.sort((a, b) => b.total - a.total);
  } catch {
    return [];
  }
}
