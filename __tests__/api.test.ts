import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScrapeError, extractFirstImage } from '@/lib/scraper';
import { sanitizeHtml } from '@/lib/sanitize';
import { validateUrl } from '@/lib/urlSafety';

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
