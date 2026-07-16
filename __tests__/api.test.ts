import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrapeError, TakedownError, extractFirstImage, extractAuthor, extractArticle, isPaywallBoilerplate } from '@/lib/scraper';
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
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    hincrby: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    hgetall: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/scraper', async () => {
  const actual = await vi.importActual<typeof import('@/lib/scraper')>('@/lib/scraper');
  return {
    ...actual,
    scrapeArticle: vi.fn(),
  };
});

vi.mock('@/lib/takedowns', async () => {
  const actual = await vi.importActual<typeof import('@/lib/takedowns')>('@/lib/takedowns');
  return {
    ...actual,
    getTakedown: vi.fn(actual.getTakedown),
  };
});

const { POST } = await import('@/app/api/bypass/route');
const { POST: rescrapePOST } = await import('@/app/api/rescrape/route');
const { POST: ingestPOST } = await import('@/app/api/ingest/route');
const { GET: domainStatsGET } = await import('@/app/api/domain-stats/route');
const { scrapeArticle } = await import('@/lib/scraper');
const { getTakedown } = await import('@/lib/takedowns');

function createRequest(body: unknown, url = 'http://localhost:3000/api/bypass', headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
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

  it('logs scrape details server-side but does not expose them in the response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(data.details).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'scrape failed',
      expect.objectContaining({
        details: [
          'HTTP 403 with Googlebot',
          'HTTP 403 with Bingbot',
          'Wayback Machine has no accessible snapshots',
        ],
      }),
    );

    consoleSpy.mockRestore();
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

    expect(kv.set).toHaveBeenCalledTimes(2);
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

describe('rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(scrapeArticle).mockResolvedValue({
      title: 'T', content: '<p>c</p>', textContent: 'c', excerpt: 'c', byline: null, image: null,
      url: 'https://example.com/article',
    });
  });

  it('allows a request under the per-IP limit on /api/bypass', async () => {
    const { kv } = await import('@vercel/kv');
    vi.mocked(kv.incr).mockResolvedValue(5);

    const response = await POST(
      createRequest({ url: 'https://example.com/article' }, 'http://localhost:3000/api/bypass', {
        'x-forwarded-for': '1.2.3.4',
      }),
    );

    expect(response.status).not.toBe(429);
  });

  it('blocks a client that exceeds the per-IP limit on /api/bypass', async () => {
    const { kv } = await import('@vercel/kv');
    vi.mocked(kv.incr).mockResolvedValue(11);

    const response = await POST(
      createRequest({ url: 'https://example.com/article' }, 'http://localhost:3000/api/bypass', {
        'x-forwarded-for': '1.2.3.4',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toMatch(/too many requests/i);
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(scrapeArticle).not.toHaveBeenCalled();
  });

  it('blocks a client that exceeds the per-IP limit on /api/ingest', async () => {
    const { kv } = await import('@vercel/kv');
    vi.mocked(kv.incr).mockResolvedValue(11);

    const response = await ingestPOST(
      createRequest(
        { url: 'https://example.com/article', content: `<p>${'x'.repeat(250)}</p>` },
        'http://localhost:3000/api/ingest',
        { 'x-forwarded-for': '5.6.7.8' },
      ),
    );

    expect(response.status).toBe(429);
  });

  it('fails open (does not rate limit) when Redis is unavailable', async () => {
    const { kv } = await import('@vercel/kv');
    vi.mocked(kv.incr).mockRejectedValue(new Error('redis down'));

    const response = await POST(
      createRequest({ url: 'https://example.com/article' }, 'http://localhost:3000/api/bypass', {
        'x-forwarded-for': '9.9.9.9',
      }),
    );

    expect(response.status).not.toBe(429);
  });
});

describe('POST /api/rescrape', () => {
  const RESCRAPE_URL = 'http://localhost:3000/api/rescrape';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESCRAPE_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.RESCRAPE_TOKEN;
    delete process.env.RESCRAPE_TOKEN_AGENT;
  });

  it('returns 401 when no token is configured', async () => {
    delete process.env.RESCRAPE_TOKEN;
    const response = await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer test-token' }),
    );
    expect(response.status).toBe(401);
  });

  it('returns 401 when the token is missing', async () => {
    const response = await rescrapePOST(createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL));
    expect(response.status).toBe(401);
  });

  it('returns 401 when the token is wrong', async () => {
    const response = await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer wrong-token' }),
    );
    expect(response.status).toBe(401);
  });

  it('accepts the secondary agent token when it is configured', async () => {
    process.env.RESCRAPE_TOKEN_AGENT = 'agent-token';
    vi.mocked(scrapeArticle).mockResolvedValue({
      title: 'T', content: '<p>c</p>', textContent: 'c', excerpt: 'c', byline: null, image: null,
      url: 'https://example.com/article',
    });

    const response = await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer agent-token' }),
    );
    expect(response.status).toBe(200);
  });

  it('still accepts the primary token when a secondary agent token is also configured', async () => {
    process.env.RESCRAPE_TOKEN_AGENT = 'agent-token';
    vi.mocked(scrapeArticle).mockResolvedValue({
      title: 'T', content: '<p>c</p>', textContent: 'c', excerpt: 'c', byline: null, image: null,
      url: 'https://example.com/article',
    });

    const response = await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer test-token' }),
    );
    expect(response.status).toBe(200);
  });

  it('rejects a token that matches neither the primary nor the secondary secret', async () => {
    process.env.RESCRAPE_TOKEN_AGENT = 'agent-token';
    const response = await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer someone-elses-token' }),
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when URL is missing', async () => {
    const response = await rescrapePOST(createRequest({}, RESCRAPE_URL, { Authorization: 'Bearer test-token' }));
    expect(response.status).toBe(400);
  });

  it('scrapes and overwrites the cache even when a cache entry already exists', async () => {
    const { kv } = await import('@vercel/kv');
    const freshArticle = {
      title: 'Fresh Title',
      content: '<p>Fresh content</p>',
      textContent: 'Fresh content',
      excerpt: 'Fresh',
      byline: 'Fresh Author',
      image: null,
      url: 'https://example.com/article',
    };
    vi.mocked(scrapeArticle).mockResolvedValue(freshArticle);

    const response = await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer test-token' }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe('Fresh Title');
    expect(scrapeArticle).toHaveBeenCalledTimes(1);
    expect(kv.set).toHaveBeenCalledTimes(2);
    expect(kv.get).not.toHaveBeenCalled();
  });

  it('returns 502 when scraping fails', async () => {
    vi.mocked(scrapeArticle).mockRejectedValue(new Error('Scraping failed'));
    const response = await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer test-token' }),
    );
    expect(response.status).toBe(502);
  });

  it('evicts an existing cache entry when the rescrape fails, instead of leaving known-wrong content in place', async () => {
    const { kv } = await import('@vercel/kv');
    vi.mocked(scrapeArticle).mockRejectedValue(new Error('Scraping failed'));

    await rescrapePOST(
      createRequest({ url: 'https://example.com/article' }, RESCRAPE_URL, { Authorization: 'Bearer test-token' }),
    );

    expect(kv.del).toHaveBeenCalledWith(expect.stringMatching(/^article:/));
  });

  it('evicts the cache entry without scraping when evictOnly is set, for takedown requests', async () => {
    const { kv } = await import('@vercel/kv');

    const response = await rescrapePOST(
      createRequest(
        { url: 'https://example.com/article', evictOnly: true },
        RESCRAPE_URL,
        { Authorization: 'Bearer test-token' },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.evicted).toBe(true);
    expect(scrapeArticle).not.toHaveBeenCalled();
    expect(kv.del).toHaveBeenCalledWith(expect.stringMatching(/^article:/));
  });
});

describe('takedowns integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.mocked(getTakedown).mockReset();
  });

  it('POST /api/bypass returns 451 when scrapeArticle reports a takedown', async () => {
    const { kv } = await import('@vercel/kv');
    vi.mocked(kv.get).mockResolvedValue(null);
    const entry = { requestId: 'gh-1', link: 'https://github.com/x/y/issues/1', date: '2026-07-15' };
    vi.mocked(scrapeArticle).mockRejectedValue(new TakedownError(entry));

    const response = await POST(createRequest({ url: 'https://example.com/taken-down-article' }));
    const data = await response.json();

    expect(response.status).toBe(451);
    expect(data.error).toContain('gh-1');
  });

  it('POST /api/ingest returns 451 without extracting when the URL is on the takedown list', async () => {
    const entry = { requestId: 'gh-2', link: 'https://github.com/x/y/issues/2', date: '2026-07-15' };
    vi.mocked(getTakedown).mockReturnValue(entry);

    const response = await ingestPOST(
      createRequest(
        { url: 'https://example.com/taken-down-article', content: `<p>${'x'.repeat(250)}</p>` },
        'http://localhost:3000/api/ingest',
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(451);
    expect(data.error).toContain('gh-2');
  });
});

describe('GET /api/domain-stats', () => {
  const STATS_URL = 'http://localhost:3000/api/domain-stats';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESCRAPE_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.RESCRAPE_TOKEN;
  });

  it('returns 401 without a token', async () => {
    const response = await domainStatsGET(new Request(STATS_URL));
    expect(response.status).toBe(401);
  });

  it('returns 401 with the wrong token', async () => {
    const response = await domainStatsGET(
      new Request(STATS_URL, { headers: { Authorization: 'Bearer wrong' } }),
    );
    expect(response.status).toBe(401);
  });

  it('returns domain stats with a valid token', async () => {
    const { kv } = await import('@vercel/kv');
    vi.mocked(kv.smembers).mockResolvedValueOnce(['example.com']);
    vi.mocked(kv.hgetall).mockResolvedValueOnce({ total: 5, 'direct-fetch': 5 });

    const response = await domainStatsGET(
      new Request(STATS_URL, { headers: { Authorization: 'Bearer test-token' } }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.domains).toEqual([
      {
        domain: 'example.com',
        total: 5,
        tiers: { 'direct-fetch': 5, warmup: 0, amp: 0, 'browser-render': 0, 'google-cache': 0, wayback: 0, failed: 0 },
        successRate: 1,
      },
    ]);
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

  it('strips screen-reader-only accessibility labels', () => {
    const result = sanitizeHtml(
      '<span class="visually-hidden">Image source, </span>Getty Images' +
        '<span class="sr-only">Image caption, </span><p>A real caption.</p>',
    );
    expect(result).not.toContain('Image source,');
    expect(result).not.toContain('Image caption,');
    expect(result).toContain('Getty Images');
    expect(result).toContain('A real caption.');
  });

  it('strips OneTrust cookie-consent widgets regardless of site', () => {
    const result = sanitizeHtml(
      '<p>Real paragraph.</p>' +
        '<div id="onetrust-consent-sdk"><div id="onetrust-banner-sdk">' +
        '<h2 id="onetrust-policy-title">Our use of cookies</h2></div></div>',
    );
    expect(result).not.toContain('Our use of cookies');
    expect(result).toContain('Real paragraph.');
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

describe('extractAuthor', () => {
  it('picks meta[name=author] over class-based selectors', () => {
    const result = extractAuthor('<meta name="author" content="Jane Doe" /><div class="byline">Someone Else</div>');
    expect(result).toBe('Jane Doe');
  });

  it('matches class names case-insensitively', () => {
    const result = extractAuthor('<div class="Byline-styles__BylineStyled-sc-1">Helen Sullivan, BBC News</div>');
    expect(result).toBe('Helen Sullivan, BBC News');
  });

  it('returns null when no author found', () => {
    expect(extractAuthor('<p>no byline here</p>')).toBeNull();
  });
});

describe('isPaywallBoilerplate', () => {
  it('flags NYT-style AI-training/data-mining legal notices', () => {
    const content =
      '<h2>New York Times content is made available for your personal, non-commercial use subject to our Terms of Service.</h2>' +
      '<p>Use of any device, tool, or process designed to data mine or scrape the content using automated means is prohibited without prior written permission from The New York Times Company.</p>' +
      '<ol><li>text and data mining activities under Art. 4 of the EU Directive on Copyright in the Digital Single Market;</li>' +
      '<li>the development of any software, machine learning, artificial intelligence (AI), and/or large language models (LLMs);</li></ol>';
    expect(isPaywallBoilerplate({ content, textContent: content.replace(/<[^>]*>/g, '') })).toBe(true);
  });

  it('flags FT-style subscription barrier pages by structural marker', () => {
    const content = '<div id="barrier-page"><span>Subscribe to unlock this article</span></div>';
    expect(isPaywallBoilerplate({ content, textContent: 'Subscribe to unlock this article' })).toBe(true);
  });

  it('flags FT-style paywall copy even without the structural marker', () => {
    const textContent = 'To read this article for free, Register now. Standard Digital: $45 per month.';
    expect(isPaywallBoilerplate({ content: `<p>${textContent}</p>`, textContent })).toBe(true);
  });

  it('does not flag a real article', () => {
    const textContent =
      'Taslima Nasreen\'s planned return to Kolkata after nearly two decades has triggered a political face-off in West Bengal.';
    expect(isPaywallBoilerplate({ content: `<p>${textContent}</p>`, textContent })).toBe(false);
  });
});

describe('extractArticle rejects paywall/legal boilerplate', () => {
  it('falls through to null when JSON-LD articleBody is an AI-training legal notice', () => {
    const html =
      '<html><head><script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'How Putin Turned Japan Into a Den of Spies',
        articleBody:
          'New York Times content is made available for your personal, non-commercial use subject to our Terms of Service. ' +
          'Use of any device, tool, or process designed to data mine or scrape the content using automated means is ' +
          'prohibited without prior written permission from The New York Times Company. This includes text and data ' +
          'mining activities under Art. 4 of the EU Directive on Copyright in the Digital Single Market and the ' +
          'development of any software, machine learning, artificial intelligence (AI), and/or large language models (LLMs).',
      }) +
      '</script></head><body></body></html>';

    expect(extractArticle(html, 'https://www.nytimes.com/2026/07/12/example.html')).toBeNull();
  });

  it('falls through to null when Readability extracts an FT-style subscription barrier', () => {
    const html =
      '<html><body><article><div id="barrier-page">' +
      '<h2>Subscribe to unlock this article</h2>' +
      '<p>Try unlimited access for just 1 for 4 weeks, then 69 per month. Complete digital access to quality FT journalism on any device.</p>' +
      '</div></article></body></html>';

    expect(extractArticle(html, 'https://www.ft.com/content/example')).toBeNull();
  });

  it('still extracts a real article normally', () => {
    const html =
      '<html><body><article><h1>Real headline</h1><p>' +
      'This is a real article body with enough substance to be extracted correctly. '.repeat(10) +
      '</p></article></body></html>';

    const article = extractArticle(html, 'https://example.com/article');
    expect(article).not.toBeNull();
    expect(article?.textContent).toContain('real article body');
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
    expect(kv.set).toHaveBeenCalledTimes(3);
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

describe('getUrlForId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the mapped url when present', async () => {
    const { kv } = await import('@vercel/kv');
    const { getUrlForId } = await import('@/lib/redis');

    vi.mocked(kv.get).mockResolvedValueOnce({ url: 'https://example.com/permanent' });

    await expect(getUrlForId('some-id')).resolves.toBe('https://example.com/permanent');
  });

  it('returns null when no mapping exists', async () => {
    const { kv } = await import('@vercel/kv');
    const { getUrlForId } = await import('@/lib/redis');

    vi.mocked(kv.get).mockResolvedValueOnce(null);

    await expect(getUrlForId('unknown-id')).resolves.toBeNull();
  });
});

describe('ReaderPage recovery from expired content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /reader/bypass when content expired but the url mapping survives', async () => {
    const { kv } = await import('@vercel/kv');
    const ReaderPageModule = await import('@/app/reader/[id]/page');

    vi.mocked(kv.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ url: 'https://example.com/expired-article' });

    await expect(
      ReaderPageModule.default({ params: { id: 'expired-id' } }),
    ).rejects.toThrow('NEXT_REDIRECT:/reader/bypass?url=https%3A%2F%2Fexample.com%2Fexpired-article');
  });

  it('shows the not-found page when neither content nor mapping exist', async () => {
    const { kv } = await import('@vercel/kv');
    const ReaderPageModule = await import('@/app/reader/[id]/page');

    vi.mocked(kv.get).mockResolvedValue(null);

    const result = await ReaderPageModule.default({ params: { id: 'totally-unknown' } });
    expect(result).toBeTruthy();
  });
});
