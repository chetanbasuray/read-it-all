// Manual regression check against a curated set of real sites (scripts/regression-sites.json).
//
// Not run in CI on purpose: real external sites change their markup, rate-limit, or
// temporarily block repeated automated requests, and a flaky external site failing CI on
// an unrelated PR would be worse than not having this check at all. Run manually before
// and after scraper changes:
//
//   npx tsx scripts/regression-check.ts
//
// Runs scrapeArticle() directly against real local Node + local Chrome, so it can't
// reproduce Vercel-specific behavior (the CNN datacenter-IP block, the serverless
// Chromium path). Check those in production separately; see each entry's "note".
import { scrapeArticle, isPaywallBoilerplate, ScrapeError } from '../src/lib/scraper';
import sites from './regression-sites.json';

interface Site {
  domain: string;
  url: string;
  status: 'known-good' | 'known-hard';
  note?: string;
}

interface CheckResult {
  site: Site;
  success: boolean;
  ok: boolean;
  title?: string;
  byline?: string | null;
  contentLength?: number;
  error?: string;
}

const MIN_REAL_CONTENT_LENGTH = 500;

async function checkSite(site: Site): Promise<CheckResult> {
  try {
    const article = await scrapeArticle(site.url);
    const plainText = article.content.replace(/<[^>]*>/g, '').trim();
    const ok = !isPaywallBoilerplate(article) && plainText.length > MIN_REAL_CONTENT_LENGTH;
    return {
      site,
      success: true,
      ok,
      title: article.title,
      byline: article.byline,
      contentLength: article.content.length,
    };
  } catch (error) {
    const message =
      error instanceof ScrapeError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return { site, success: false, ok: false, error: message };
  }
}

async function main() {
  const list = sites as Site[];
  let regressions = 0;
  let improvements = 0;

  for (const site of list) {
    const result = await checkSite(site);
    const expectedGood = site.status === 'known-good';

    let flag = 'as expected';
    if (expectedGood && !result.ok) {
      flag = 'REGRESSION';
      regressions += 1;
    } else if (!expectedGood && result.ok) {
      flag = 'IMPROVED (consider promoting to known-good)';
      improvements += 1;
    }

    console.log(`[${site.status}] ${site.domain} — ${flag}`);
    if (result.success) {
      console.log(`  title: ${result.title}`);
      console.log(`  byline: ${result.byline}`);
      console.log(`  content length: ${result.contentLength}`);
    } else {
      console.log(`  error: ${result.error}`);
    }
    if (site.note) console.log(`  note: ${site.note}`);
    console.log('');
  }

  console.log(
    `Done: ${regressions} regression(s), ${improvements} improvement(s) out of ${list.length} sites.`,
  );
  if (regressions > 0) {
    process.exitCode = 1;
  }
}

main();
