import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const get = vi.fn();
const set = vi.fn();
const del = vi.fn();
const expire = vi.fn();
vi.mock('@vercel/kv', () => ({ kv: { get: (...a: unknown[]) => get(...a), set: (...a: unknown[]) => set(...a), del: (...a: unknown[]) => del(...a), expire: (...a: unknown[]) => expire(...a) } }));
vi.mock('@vercel/functions', () => ({ waitUntil: () => {} }));
vi.mock('@/lib/scraper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scraper')>();
  return { ...actual, scrapeArticle: vi.fn() };
});

const ORIGINAL = process.env.KV_REST_API_URL;
process.env.KV_REST_API_URL = 'https://kv.test';

const { scrapeArticle } = await import('@/lib/scraper');
const { tombstoneArticle, isArticleEvicted, setCachedArticle, forceRescrapeArticle } = await import('@/lib/redis');
const { hashUrl } = await import('@/lib/utils');

const TEST_URL = 'https://example.com/article';
const ID = hashUrl(TEST_URL);
const TOMBSTONE_KEY = `evicted:${ID}`;
const ARTICLE_KEY = `article:${ID}`;

const article = () => ({
  title: 't',
  content: '<p>c</p>',
  textContent: 'c',
  excerpt: 'c',
  byline: null,
  image: null,
  url: TEST_URL,
});

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  del.mockReset();
  expire.mockReset();
  vi.mocked(scrapeArticle).mockReset();
  get.mockResolvedValue(null);
  set.mockResolvedValue('OK');
  del.mockResolvedValue(1);
});

afterAll(() => {
  process.env.KV_REST_API_URL = ORIGINAL;
});

describe('tombstoneArticle', () => {
  it('writes evicted:<id> with a numeric evictedAt and deletes article:<id>', async () => {
    await tombstoneArticle(TEST_URL);

    expect(set).toHaveBeenCalledWith(TOMBSTONE_KEY, expect.objectContaining({ evictedAt: expect.any(Number) }));
    // no options argument at all: the tombstone must never carry a TTL, or the
    // removal quietly expires back into recoverability
    expect(set.mock.calls[0]).toHaveLength(2);
    expect(del).toHaveBeenCalledWith(ARTICLE_KEY);
  });

  it('sets the tombstone before deleting the article', async () => {
    await tombstoneArticle(TEST_URL);

    // dying between the two must leave a tombstone next to a still-present
    // article (unservable), never a deleted article without a tombstone
    // (silently re-scraped)
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(del.mock.invocationCallOrder[0]);
  });
});

describe('isArticleEvicted', () => {
  it('resolves true when the tombstone key holds a value', async () => {
    get.mockResolvedValue({ evictedAt: 1 });
    expect(await isArticleEvicted(ID)).toBe(true);
    expect(get).toHaveBeenCalledWith(TOMBSTONE_KEY);
  });

  it('resolves false when the tombstone key is absent', async () => {
    get.mockResolvedValue(null);
    expect(await isArticleEvicted(ID)).toBe(false);
  });
});

describe('setCachedArticle write barrier', () => {
  it('skips every write while a tombstone exists', async () => {
    get.mockResolvedValue({ evictedAt: 1 });
    await setCachedArticle(TEST_URL, article());

    expect(set).not.toHaveBeenCalled();
  });

  it('writes the content key with a TTL and the mapping key when no tombstone exists', async () => {
    get.mockResolvedValue(null);
    await setCachedArticle(TEST_URL, article());

    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[0][0]).toBe(ARTICLE_KEY);
    expect(set.mock.calls[0][2]).toHaveProperty('ex');
    expect(set.mock.calls[1][0]).toBe(`mapping:${ID}`);
  });
});

describe('forceRescrapeArticle', () => {
  it('clears the tombstone before caching on scrape success', async () => {
    vi.mocked(scrapeArticle).mockResolvedValue(article());

    await forceRescrapeArticle(TEST_URL);

    // the operator explicitly re-adding the article is the undo for a
    // takedown eviction; clearing after the set would let the write barrier
    // discard the fresh content
    expect(del).toHaveBeenCalledWith(TOMBSTONE_KEY);
    expect(set).toHaveBeenCalledWith(ARTICLE_KEY, expect.any(Object), expect.objectContaining({ ex: expect.any(Number) }));
    expect(del.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
  });

  it('evicts only the article key and leaves the tombstone alone when the scrape fails', async () => {
    vi.mocked(scrapeArticle).mockRejectedValue(new Error('blocked'));

    await expect(forceRescrapeArticle(TEST_URL)).rejects.toThrow('blocked');

    expect(del).toHaveBeenCalledWith(ARTICLE_KEY);
    expect(del).not.toHaveBeenCalledWith(TOMBSTONE_KEY);
  });
});
