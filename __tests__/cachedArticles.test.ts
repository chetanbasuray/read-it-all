import { describe, it, expect, vi, beforeEach } from 'vitest';

const scan = vi.fn();
const mget = vi.fn();
vi.mock('@vercel/kv', () => ({ kv: { scan: (...a: unknown[]) => scan(...a), mget: (...a: unknown[]) => mget(...a) } }));
vi.mock('@vercel/functions', () => ({ waitUntil: () => {} }));

const ORIGINAL = process.env.KV_REST_API_URL;
process.env.KV_REST_API_URL = 'https://kv.test';

const { listCachedArticles } = await import('@/lib/redis');

beforeEach(() => {
  scan.mockReset();
  mget.mockReset();
});

describe('listCachedArticles', () => {
  it('uses SCAN rather than KEYS, which would block the live database', async () => {
    scan.mockResolvedValue(['0', []]);
    await listCachedArticles('0', 100);
    expect(scan).toHaveBeenCalledWith('0', { match: 'mapping:*', count: 100 });
  });

  it('pairs each mapping with its article scrapedAt', async () => {
    scan.mockResolvedValue(['17', ['mapping:aaa', 'mapping:bbb']]);
    mget
      .mockResolvedValueOnce([{ url: 'https://a.com/1' }, { url: 'https://b.com/2' }])
      .mockResolvedValueOnce([{ scrapedAt: 111 }, { scrapedAt: 222 }]);

    const page = await listCachedArticles('0', 2);
    expect(page.cursor).toBe('17');
    expect(page.items).toEqual([
      { id: 'aaa', url: 'https://a.com/1', scrapedAt: 111 },
      { id: 'bbb', url: 'https://b.com/2', scrapedAt: 222 },
    ]);
  });

  it('reports scrapedAt null when the content entry has expired but the mapping survives', async () => {
    scan.mockResolvedValue(['0', ['mapping:aaa']]);
    mget.mockResolvedValueOnce([{ url: 'https://a.com/1' }]).mockResolvedValueOnce([null]);
    const page = await listCachedArticles('0', 1);
    expect(page.items[0].scrapedAt).toBeNull();
  });

  it('drops an id whose mapping is missing rather than emitting an undefined url', async () => {
    scan.mockResolvedValue(['0', ['mapping:aaa', 'mapping:bbb']]);
    mget.mockResolvedValueOnce([null, { url: 'https://b.com/2' }]).mockResolvedValueOnce([null, null]);
    const page = await listCachedArticles('0', 2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].url).toBe('https://b.com/2');
  });

  it('skips the follow-up reads entirely when a page is empty', async () => {
    scan.mockResolvedValue(['5', []]);
    const page = await listCachedArticles('0', 100);
    expect(page).toEqual({ cursor: '5', items: [] });
    expect(mget).not.toHaveBeenCalled();
  });
});

process.env.KV_REST_API_URL = ORIGINAL;
