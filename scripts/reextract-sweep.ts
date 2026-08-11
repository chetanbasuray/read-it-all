/**
 * Re-extracts every cached article so entries scraped by an older extractor pick
 * up later fixes. Runs from a workstation against the deployed app: the listing
 * endpoint supplies the work, /api/rescrape does one article at a time.
 *
 * Pacing is per domain, not global. A single domain is only ever hit once per
 * PER_DOMAIN_GAP_MS, while distinct domains run concurrently, so a cache holding
 * 300 articles from one publisher does not turn into 300 rapid requests at it.
 *
 *   npx tsx scripts/reextract-sweep.ts --dry-run
 *   npx tsx scripts/reextract-sweep.ts --limit 50
 *   npx tsx scripts/reextract-sweep.ts --domain theprint.in
 *   npx tsx scripts/reextract-sweep.ts --older-than 7
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import { regex } from 'shorol';
import { WWW_PREFIX_REGEX } from '../src/lib/utils';

const BASE_URL = process.env.SWEEP_BASE_URL ?? 'https://read-it-all-omega.vercel.app';
const PER_DOMAIN_GAP_MS = Number(process.env.SWEEP_DOMAIN_GAP_MS ?? 6000);
const MAX_CONCURRENT_DOMAINS = Number(process.env.SWEEP_CONCURRENCY ?? 3);
const REQUEST_TIMEOUT_MS = 180_000;
const PROGRESS_FILE = '.sweep-progress.json';

interface Item {
  id: string;
  url: string;
  scrapedAt: number | null;
  canonicalUrl: string | null;
}

// one article is cached under both its requested and canonical url on purpose,
// so sweeping the raw list scrapes it twice and lets the copies drift
export function dedupeByArticle(items: Item[]): { kept: Item[]; dropped: number } {
  const byArticle = new Map<string, Item>();
  for (const item of items) {
    const key = item.canonicalUrl ?? item.url;
    const held = byArticle.get(key);
    if (!held || (item.url === key && held.url !== key)) byArticle.set(key, item);
  }
  return { kept: [...byArticle.values()], dropped: items.length - byArticle.size };
}

interface Outcome {
  url: string;
  domain: string;
  status: 'refreshed' | 'failed' | 'skipped';
  detail?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const TOKEN_LINE_REGEX = regex()
  .start()
  .literal('RESCRAPE_TOKEN_AGENT=')
  .group((b) => b.noneOf(['\r', '\n']).zeroOrMore())
  .toRegExp('m');

function token(): string {
  const match = readFileSync('.env.local', 'utf8').match(TOKEN_LINE_REGEX);
  if (!match) throw new Error('RESCRAPE_TOKEN_AGENT missing from .env.local');
  return match[1].trim();
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(WWW_PREFIX_REGEX, '').toLowerCase();
  } catch {
    return 'invalid';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAllItems(auth: string): Promise<Item[]> {
  const items: Item[] = [];
  let cursor = '0';
  do {
    const res = await fetch(`${BASE_URL}/api/cached-articles?cursor=${cursor}&limit=500`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
    if (!res.ok) throw new Error(`listing failed: HTTP ${res.status} ${await res.text()}`);
    const page = (await res.json()) as { cursor: string; items: Item[] };
    items.push(...page.items);
    cursor = page.cursor;
    process.stdout.write(`\r  discovered ${items.length} articles...`);
  } while (cursor !== '0');
  process.stdout.write('\n');
  return items;
}

async function rescrapeOne(url: string, auth: string): Promise<Outcome> {
  const domain = domainOf(url);
  try {
    const res = await fetch(`${BASE_URL}/api/rescrape`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      // never evict on failure: an entry older than the current extractor is
      // still better than no entry at all
      body: JSON.stringify({ url, keepOnFailure: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return { url, domain, status: 'refreshed' };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { url, domain, status: 'failed', detail: `HTTP ${res.status} ${body.error ?? ''}`.trim() };
  } catch (e) {
    return { url, domain, status: 'failed', detail: e instanceof Error ? e.message : 'unknown' };
  }
}

// one worker per domain, each walking its own queue with a gap between requests;
// the pool bounds how many domains are in flight at once
async function runDomainQueues(
  queues: Map<string, Item[]>,
  auth: string,
  onResult: (o: Outcome) => void,
): Promise<void> {
  const domains = [...queues.keys()];
  let next = 0;

  const worker = async () => {
    while (next < domains.length) {
      const domain = domains[next++];
      const queue = queues.get(domain)!;
      for (let i = 0; i < queue.length; i++) {
        onResult(await rescrapeOne(queue[i].url, auth));
        // jitter so parallel domain workers do not fall into lockstep
        if (i < queue.length - 1) await sleep(PER_DOMAIN_GAP_MS + Math.random() * 1000);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_DOMAINS, domains.length) }, worker),
  );
}

async function main() {
  const auth = token();
  const dryRun = hasFlag('dry-run');
  const onlyDomain = arg('domain');
  const limit = Number(arg('limit') ?? '0');
  const olderThanDays = Number(arg('older-than') ?? '0');

  console.log(`Sweep target: ${BASE_URL}`);
  console.log('Discovering cached articles...');
  let items = await fetchAllItems(auth);

  const deduped = dedupeByArticle(items);
  if (deduped.dropped > 0) {
    console.log(`  ${deduped.dropped} entries are second copies of an article already queued`);
  }
  items = deduped.kept;

  if (onlyDomain) items = items.filter((i) => domainOf(i.url) === onlyDomain);
  if (olderThanDays > 0) {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    items = items.filter((i) => i.scrapedAt === null || i.scrapedAt < cutoff);
  }

  // resume support: a previous run's completed urls are not repeated
  const done = new Set<string>(
    existsSync(PROGRESS_FILE) ? JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')).done ?? [] : [],
  );
  if (done.size) console.log(`Resuming: ${done.size} already done in a previous run`);
  items = items.filter((i) => !done.has(i.url));

  if (limit > 0) items = items.slice(0, limit);

  const queues = new Map<string, Item[]>();
  for (const item of items) {
    const d = domainOf(item.url);
    if (!queues.has(d)) queues.set(d, []);
    queues.get(d)!.push(item);
  }

  const biggest = [...queues.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  const slowest = biggest.length ? biggest[0][1].length : 0;
  console.log(`\n${items.length} articles across ${queues.size} domains`);
  console.log('Largest queues:', biggest.map(([d, q]) => `${d}(${q.length})`).join(', ') || 'none');
  console.log(
    `Pacing: ${PER_DOMAIN_GAP_MS}ms between hits on a domain, ${MAX_CONCURRENT_DOMAINS} domains at once`,
  );
  console.log(
    `Floor on wall time, set by the largest single domain: ~${Math.round((slowest * PER_DOMAIN_GAP_MS) / 60000)} min\n`,
  );

  if (dryRun) {
    console.log('Dry run, nothing was rescraped.');
    return;
  }

  const outcomes: Outcome[] = [];
  const started = Date.now();
  await runDomainQueues(queues, auth, (o) => {
    outcomes.push(o);
    if (o.status === 'refreshed') done.add(o.url);
    const n = outcomes.length;
    const mark = o.status === 'refreshed' ? 'ok  ' : 'FAIL';
    console.log(`[${n}/${items.length}] ${mark} ${o.domain} ${o.detail ?? ''}`);
    if (n % 10 === 0) writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...done] }, null, 2));
  });

  writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...done] }, null, 2));

  const failed = outcomes.filter((o) => o.status === 'failed');
  console.log(`\nDone in ${Math.round((Date.now() - started) / 60000)} min`);
  console.log(`  refreshed: ${outcomes.filter((o) => o.status === 'refreshed').length}`);
  console.log(`  failed   : ${failed.length}`);
  if (failed.length) {
    const byDomain = new Map<string, number>();
    for (const f of failed) byDomain.set(f.domain, (byDomain.get(f.domain) ?? 0) + 1);
    console.log('  failures by domain:');
    for (const [d, n] of [...byDomain].sort((a, b) => b[1] - a[1])) console.log(`    ${d}: ${n}`);
    console.log('  (cache entries for these were left intact)');
  }
}

// only when run directly: importing this for its helpers must not start a sweep
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
