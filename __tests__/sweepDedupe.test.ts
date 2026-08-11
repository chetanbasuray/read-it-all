import { describe, it, expect } from 'vitest';
import { dedupeByArticle } from '../scripts/reextract-sweep';

const item = (id: string, url: string, canonicalUrl: string | null) => ({
  id, url, canonicalUrl, scrapedAt: 1,
});

const WRAP = 'https://site.com/europe/?url=x';
const CANON = 'https://site.com/world/story';

describe('dedupeByArticle', () => {
  it('collapses the wrapper and canonical copies of one article into a single job', () => {
    const { kept, dropped } = dedupeByArticle([item('a', WRAP, CANON), item('b', CANON, CANON)]);
    expect(kept).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it('keeps the copy whose own url is the canonical, being likeliest to resolve', () => {
    const { kept } = dedupeByArticle([item('a', WRAP, CANON), item('b', CANON, CANON)]);
    expect(kept[0].url).toBe(CANON);
  });

  it('does not depend on the order the two copies arrive in', () => {
    const { kept } = dedupeByArticle([item('b', CANON, CANON), item('a', WRAP, CANON)]);
    expect(kept[0].url).toBe(CANON);
  });

  it('leaves distinct articles alone', () => {
    const { kept, dropped } = dedupeByArticle([
      item('a', 'https://site.com/one', 'https://site.com/one'),
      item('b', 'https://site.com/two', 'https://site.com/two'),
    ]);
    expect(kept).toHaveLength(2);
    expect(dropped).toBe(0);
  });

  it('falls back to the mapping url when the content entry has expired', () => {
    const { kept } = dedupeByArticle([item('a', WRAP, null)]);
    expect(kept).toHaveLength(1);
    expect(kept[0].url).toBe(WRAP);
  });
});
