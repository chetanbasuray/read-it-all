import { describe, it, expect, vi } from 'vitest';

const rate = vi.fn();
vi.mock('@/lib/domainStats', () => ({
  recordDomainOutcome: vi.fn(),
  getDomainSuccessRate: (u: string) => rate(u),
}));

const { unreachableMessage } = await import('@/lib/scraper');
const FT = 'https://www.ft.com/content/abc';

describe('unreachableMessage', () => {
  it('names the publisher and the sources tried', async () => {
    rate.mockResolvedValue({ total: 8, successRate: 0 });
    const m = await unreachableMessage(FT, true);
    expect(m).toContain('We could not reach ft.com for this article.');
    expect(m).toContain('Google Cache and the Wayback Machine');
  });

  it('offers the cookie route only where nothing has ever succeeded', async () => {
    rate.mockResolvedValue({ total: 8, successRate: 0 });
    expect(await unreachableMessage(FT, true)).toContain('paste your session cookies');
  });

  it('calls a usually-working publisher temporary instead, with no cookie pitch', async () => {
    rate.mockResolvedValue({ total: 20, successRate: 0.9 });
    const m = await unreachableMessage('https://www.bbc.com/news/x', true);
    expect(m).toContain('bbc.com usually works here');
    expect(m).not.toContain('session cookies');
  });

  it('claims no history when the publisher has never been recorded', async () => {
    rate.mockResolvedValue(null);
    const m = await unreachableMessage(FT, true);
    expect(m).not.toContain('not yet successfully read');
    expect(m).not.toContain('usually works');
  });

  it('distinguishes a page we reached but could not parse from one we could not reach', async () => {
    rate.mockResolvedValue(null);
    expect(await unreachableMessage(FT, false)).toContain('could not find the article text');
  });

  it('degrades to a generic noun for an unparseable url rather than throwing', async () => {
    rate.mockResolvedValue(null);
    expect(await unreachableMessage('not a url', true)).toContain('this site');
  });
});
