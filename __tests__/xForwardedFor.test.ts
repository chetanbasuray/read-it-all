import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrapeArticle } from '@/lib/scraper';

const ARTICLE_HTML =
  '<html><body><article><h1>Real headline</h1><p>' +
  'This is a real article body with enough substance to be extracted correctly. '.repeat(10) +
  '</p></article></body></html>';

describe('X-Forwarded-For spoofing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a real Googlebot crawler IP alongside the Googlebot user agent on the first attempt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(ARTICLE_HTML, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await scrapeArticle('https://example.com/article');

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('Googlebot');
    expect(headers['X-Forwarded-For']).toBe('66.249.66.1');
  });
});
