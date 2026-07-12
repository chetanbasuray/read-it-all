import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrapeError, extractFirstImage } from '@/lib/scraper';
import { sanitizeHtml } from '@/lib/sanitize';
import { validateUrl, safeFetch } from '@/lib/urlSafety';

vi.hoisted(() => {
  process.env.KV_URL = 'https://dummy-redis.example.com';
  process.env.KV_REST_API_URL = 'https://dummy-rest.example.com';
  process.env.KV_REST_API_TOKEN = 'dummy-token';
});

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('@/lib/scraper', async () => {
  const actual = await vi.importActual<typeof import('@/lib/scraper')>('@/lib/scraper');
  return {
    ...actual,
    scrapeArticle: vi.fn(),
  };
});

const { POST } = await import('@/app/api/bypass/route');
const { scrapeArticle } = await import('@/lib/scraper');

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/bypass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when URL is missing', async () => {
    const response = await POST(createRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('URL is required');
  });

  it('returns 400 when URL is empty string', async () => {
    const response = await POST(createRequest({ url: '' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when URL is invalid', async () => {
    const response = await POST(createRequest({ url: 'not-a-valid-url' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when URL has unsupported protocol', async () => {
    const response = await POST(createRequest({ url: 'ftp://example.com' }));
    expect(response.status).toBe(400);
  });

  it('returns 502 when scraping fails', async () => {
    vi.mocked(scrapeArticle).mockRejectedValue(new Error('Scraping failed'));

    const response = await POST(
      createRequest({ url: 'https://example.com/article' }),
    );
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toBe('Scraping failed');
  });

  it('returns scrape details with 502 when ScrapeError is thrown', async () => {
    vi.mocked(scrapeArticle).mockRejectedValue(
      new ScrapeError('Could not extract content', [
        'HTTP 403 with Googlebot',
        'HTTP 403 with Bingbot',
        'Wayback Machine has no accessible snapshots',
      ]),
    );

    const response = await POST(
      createRequest({ url: 'https://example.com/paywalled' }),
    );
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toBe('Could not extract content');
    expect(data.details).toEqual([
      'HTTP 403 with Googlebot',
      'HTTP 403 with Bingbot',
      'Wayback Machine has no accessible snapshots',
    ]);
  });

  it('returns article data on successful scrape', async () => {
    const mockArticle = {
      title: 'Test Article',
      content: '<p>Test content</p>',
      textContent: 'Test content',
      excerpt: 'Test excerpt',
      byline: 'Test Author',
      image: 'https://example.com/image.jpg',
      url: 'https://example.com/article',
    };

    vi.mocked(scrapeArticle).mockResolvedValue(mockArticle);

    const response = await POST(
      createRequest({ url: 'https://example.com/article' }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Test Article');
    expect(data.content).toBe('<p>Test content</p>');
    expect(data.byline).toBe('Test Author');
    expect(data.image).toBe('https://example.com/image.jpg');
    expect(data.cached).toBe(false);
    expect(data.url).toBe('https://example.com/article');
  });

  it('caches the article after scraping', async () => {
    const { kv } = await import('@vercel/kv');
    const mockArticle = {
      title: 'Test Article',
      content: '<p>Test content</p>',
      textContent: 'Test content',
      excerpt: 'Test',
      byline: null,
      image: null,
      url: 'https://example.com/article',
    };

    vi.mocked(scrapeArticle).mockResolvedValue(mockArticle);

    await POST(createRequest({ url: 'https://example.com/article' }));

    expect(kv.set).toHaveBeenCalledOnce();
  });

  it('returns cached article without scraping', async () => {
    const { kv } = await import('@vercel/kv');
    const cachedArticle = {
      title: 'Cached Article',
      content: '<p>Cached content</p>',
      textContent: 'Cached content',
      excerpt: 'Cached',
      byline: 'Cached Author',
      image: null,
      url: 'https://example.com/cached',
      scrapedAt: Date.now(),
    };

    vi.mocked(kv.get).mockResolvedValue(cachedArticle);

    const response = await POST(
      createRequest({ url: 'https://example.com/cached' }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe('Cached Article');
    expect(data.cached).toBe(true);
    expect(scrapeArticle).not.toHaveBeenCalled();
  });
});

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<p>safe</p><script>alert(1)</script>')).toBe(
      '<p>safe</p>',
    );
  });

  it('strips event handlers', () => {
    expect(sanitizeHtml('<p onclick="alert(1)">text</p>')).toBe('<p>text</p>');
  });

  it('strips javascript: href', () => {
    expect(
      sanitizeHtml('<a href="javascript:alert(1)">click</a>'),
    ).toBe('<a>click</a>');
  });

  it('strips iframe and object tags', () => {
    expect(
      sanitizeHtml('<iframe src="https://evil.com"></iframe><p>ok</p>'),
    ).toBe('<p>ok</p>');
  });

  it('allows safe inline elements', () => {
    expect(
      sanitizeHtml('<strong>bold</strong> <em>italic</em> <a href="https://x.com">link</a>'),
    ).toBe('<strong>bold</strong> <em>italic</em> <a href="https://x.com">link</a>');
  });
});

describe('validateUrl', () => {
  it('rejects loopback 127.0.0.1', async () => {
    await expect(validateUrl('http://127.0.0.1:3000/api')).rejects.toThrow(
      'loopback address',
    );
  });

  it('rejects metadata IP 169.254.169.254', async () => {
    await expect(validateUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      'private IP',
    );
  });

  it('rejects private 10.x.x.x', async () => {
    await expect(validateUrl('http://10.0.0.1/admin')).rejects.toThrow(
      'private IP',
    );
  });

  it('lets public URLs pass', async () => {
    await expect(validateUrl('https://www.example.com/article')).resolves.toBeUndefined();
  });

  it('rejects invalid URLs', async () => {
    await expect(validateUrl('')).rejects.toThrow('Invalid URL');
  });

  it('rejects IPv6 unique local addresses', async () => {
    await expect(validateUrl('http://[fd00::1]/')).rejects.toThrow('private IP');
  });
});

describe('safeFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a redirect to a private IP instead of following it', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: 'http://169.254.169.254/latest/meta-data/' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('https://example.com/redirect')).rejects.toThrow('private IP');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a redirect to another public URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: 'https://example.com/final' } }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await safeFetch('https://example.com/start');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after too many redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: 'https://example.com/loop' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('https://example.com/loop')).rejects.toThrow('Too many redirects');
  });
});

describe('extractFirstImage', () => {
  it('picks og:image', () => {
    const result = extractFirstImage(
      '<meta property="og:image" content="https://example.com/og.jpg" /><img src="first.jpg" />',
      'https://example.com/article',
    );
    expect(result).toBe('https://example.com/og.jpg');
  });

  it('picks twitter:image over img src', () => {
    const result = extractFirstImage(
      '<meta name="twitter:image" content="https://example.com/tw.jpg" /><img src="first.jpg" />',
      'https://example.com/article',
    );
    expect(result).toBe('https://example.com/tw.jpg');
  });

  it('resolves relative img src against baseUrl', () => {
    const result = extractFirstImage(
      '<article><img src="/images/hero.jpg" /></article>',
      'https://example.com/article',
    );
    expect(result).toBe('https://example.com/images/hero.jpg');
  });

  it('resolves protocol-relative img src against baseUrl', () => {
    const result = extractFirstImage(
      '<article><img src="//cdn.example.com/hero.jpg" /></article>',
      'https://example.com/article',
    );
    expect(result).toBe('https://cdn.example.com/hero.jpg');
  });

  it('returns null when no image found', () => {
    const result = extractFirstImage(
      '<p>no images here</p>',
      'https://example.com/article',
    );
    expect(result).toBeNull();
  });
});

describe('generateMetadata (reader/[id])', () => {
  it('returns article-specific OG tags when cached', async () => {
    const { kv } = await import('@vercel/kv');
    const { generateMetadata } = await import('@/app/reader/[id]/page');

    vi.mocked(kv.get).mockResolvedValueOnce({
      title: 'Big News Story',
      content: '<p>Body</p>',
      textContent: 'Body',
      excerpt: 'A short summary',
      byline: 'Jane Doe',
      image: 'https://example.com/hero.jpg',
      url: 'https://example.com/article',
    });

    const metadata = await generateMetadata({ params: { id: 'abc123' } });

    expect(metadata.title).toBe('Big News Story');
    expect(metadata.description).toBe('A short summary');
    expect(metadata.openGraph?.title).toBe('Big News Story');
    expect(metadata.openGraph?.images).toEqual([{ url: 'https://example.com/hero.jpg' }]);
    expect(metadata.twitter?.card).toBe('summary_large_image');
  });

  it('falls back to a generic title when the article is missing', async () => {
    const { kv } = await import('@vercel/kv');
    const { generateMetadata } = await import('@/app/reader/[id]/page');

    vi.mocked(kv.get).mockResolvedValueOnce(null);

    const metadata = await generateMetadata({ params: { id: 'missing' } });
    expect(metadata.title).toBe('Article not found - Read It All');
  });
});

describe('refreshIfStale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function fakeArticle(scrapedAt: number) {
    return {
      title: 'Old Title',
      content: '<p>old</p>',
      textContent: 'old',
      excerpt: 'old',
      byline: null,
      image: null,
      url: 'https://example.com/refresh-me',
      scrapedAt,
    };
  }

  it('does nothing for a recently scraped article', async () => {
    const { kv } = await import('@vercel/kv');
    const { refreshIfStale } = await import('@/lib/redis');

    await refreshIfStale(fakeArticle(Date.now()));

    expect(kv.set).not.toHaveBeenCalled();
    expect(scrapeArticle).not.toHaveBeenCalled();
  });

  it('re-scrapes and updates the cache for a stale article once the lock is acquired', async () => {
    const { kv } = await import('@vercel/kv');
    const { refreshIfStale } = await import('@/lib/redis');
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

    vi.mocked(kv.set).mockResolvedValueOnce('OK');
    vi.mocked(scrapeArticle).mockResolvedValueOnce({
      title: 'New Title',
      content: '<p>new</p>',
      textContent: 'new',
      excerpt: 'new',
      byline: null,
      image: null,
      url: 'https://example.com/refresh-me',
    });

    await refreshIfStale(fakeArticle(eightDaysAgo));

    expect(scrapeArticle).toHaveBeenCalledWith('https://example.com/refresh-me');
    expect(kv.set).toHaveBeenCalledTimes(2);
    expect(vi.mocked(kv.set).mock.calls[0][2]).toMatchObject({ nx: true });
  });

  it('skips the re-scrape when another instance already holds the lock', async () => {
    const { kv } = await import('@vercel/kv');
    const { refreshIfStale } = await import('@/lib/redis');
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

    vi.mocked(kv.set).mockResolvedValueOnce(null);

    await refreshIfStale(fakeArticle(eightDaysAgo));

    expect(scrapeArticle).not.toHaveBeenCalled();
    expect(kv.set).toHaveBeenCalledTimes(1);
  });

  it('treats a missing scrapedAt (pre-migration cache entry) as stale', async () => {
    const { kv } = await import('@vercel/kv');
    const { refreshIfStale } = await import('@/lib/redis');

    vi.mocked(kv.set).mockResolvedValueOnce('OK');
    vi.mocked(scrapeArticle).mockResolvedValueOnce(fakeArticle(Date.now()));

    await refreshIfStale({ ...fakeArticle(Date.now()), scrapedAt: undefined as unknown as number });

    expect(scrapeArticle).toHaveBeenCalled();
  });
});
