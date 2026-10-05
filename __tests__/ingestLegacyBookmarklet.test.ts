import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.KV_URL = 'https://dummy-redis.example.com';
  process.env.KV_REST_API_URL = 'https://dummy-rest.example.com';
  process.env.KV_REST_API_TOKEN = 'dummy-token';
});

const get = vi.fn();
const set = vi.fn();
const incr = vi.fn();
const expire = vi.fn();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: (...a: unknown[]) => get(...a),
    set: (...a: unknown[]) => set(...a),
    incr: (...a: unknown[]) => incr(...a),
    expire: (...a: unknown[]) => expire(...a),
  },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: () => {} }));

const { POST } = await import('@/app/api/ingest/route');
const { htmlToPlainText } = await import('@/lib/utils');

function ingestRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  get.mockReset().mockResolvedValue(null);
  set.mockReset().mockResolvedValue('OK');
  incr.mockReset().mockResolvedValue(1);
  expire.mockReset().mockResolvedValue(1);
});

const SENTENCE =
  'A serious data breach has occurred at one of the largest universities in the country, where an unknown attacker accessed personal data submitted during enrollment.';

const V1_CONTAINER =
  '<ol class="crumbs"><li><a href="https://www.sueddeutsche.de">Home</a></li><li><a href="https://www.sueddeutsche.de/muenchen">Munich</a></li></ol>' +
  '<style>.css-1eosz7k{font:var(--sz-art-paragraph-font);-webkit-hyphens:auto}</style>' +
  '<h1>LMU Munich: Hacker attack on matriculation data</h1>' +
  '<ul class="toolbar"><li><span>Listen</span></li><li><span>Remember</span></li><li><span>Split</span></li></ul>' +
  Array.from({ length: 6 }, (_, i) => `<p class="css-1eosz7k">${SENTENCE} Paragraph ${i + 1}.</p>`).join('') +
  '<a class="home" href="https://www.sueddeutsche.de">Go to the SZ homepage</a>';

// exactly what the v1 bookmarklet computed: tags stripped with no separator,
// so the style block's CSS and the breadcrumbs end up in the text
const V1_TEXT = V1_CONTAINER.replace(/<[^>]*>/g, '');

const V1_PAYLOAD = {
  url: 'https://www.sueddeutsche.de/muenchen/muenchen-lmu-hackerangriff-daten-immatrikulation-li.3550811',
  title: 'LMU Munich: Hacker attack on enrollment data - Munich - SZ.de',
  content: V1_CONTAINER,
  textContent: V1_TEXT,
  byline: '',
  excerpt: V1_TEXT.substring(0, 200),
  image: '',
};

describe('v1 bookmarklet payloads on /api/ingest', () => {
  it('responds 200 and stores the article', async () => {
    const response = await POST(ingestRequest(V1_PAYLOAD) as never);

    expect(response.status).toBe(200);
    expect(set.mock.calls.some(([key]) => String(key).startsWith('article:'))).toBe(true);
  });

  it('the stored text carries no CSS', async () => {
    const response = await POST(ingestRequest(V1_PAYLOAD) as never);
    const data = await response.json();

    expect(data.textContent).not.toContain('css-1eosz7k');
    expect(data.textContent).not.toContain('font:var');
  });

  it('breadcrumbs are not welded into the text', async () => {
    const response = await POST(ingestRequest(V1_PAYLOAD) as never);
    const data = await response.json();

    expect(data.textContent).not.toContain('HomeMunich');
  });

  it('the stored text always matches the stored markup', async () => {
    const response = await POST(ingestRequest(V1_PAYLOAD) as never);
    const data = await response.json();

    expect(data.textContent).toBe(htmlToPlainText(data.content));
  });

  it("the excerpt is the article's lead, not the caller's welded text", async () => {
    const response = await POST(ingestRequest(V1_PAYLOAD) as never);
    const data = await response.json();

    expect(data.excerpt.startsWith('Home')).toBe(false);
    expect(data.excerpt).toContain('serious data breach');
  });

  it('the article body survives', async () => {
    const response = await POST(ingestRequest(V1_PAYLOAD) as never);
    const data = await response.json();

    expect(data.textContent).toContain('Paragraph 6');
  });

  it("the caller's own textContent is never stored verbatim", async () => {
    const response = await POST(ingestRequest(V1_PAYLOAD) as never);
    const data = await response.json();

    expect(data.textContent).not.toBe(V1_TEXT);
  });
});
