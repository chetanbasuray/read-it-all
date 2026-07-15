import { describe, it, expect } from 'vitest';
import { matchTakedown, getTakedown } from '@/lib/takedowns';

describe('matchTakedown', () => {
  const urlEntry = { requestId: 'gh-1', link: 'https://github.com/x/y/issues/1', date: '2026-07-15' };
  const domainEntry = { requestId: 'gh-2', link: 'https://github.com/x/y/issues/2', date: '2026-07-15' };
  const fixture = {
    urls: { 'https://example.com/article': urlEntry },
    domains: { 'blocked.com': domainEntry },
  };

  it('matches an exact URL entry', () => {
    expect(matchTakedown(fixture, 'https://example.com/article')).toEqual(urlEntry);
  });

  it('strips tracking params before matching a URL entry', () => {
    expect(matchTakedown(fixture, 'https://example.com/article?utm_source=x')).toEqual(urlEntry);
  });

  it('matches a domain-level entry regardless of path', () => {
    expect(matchTakedown(fixture, 'https://blocked.com/some/other/article')).toEqual(domainEntry);
  });

  it('matches a domain-level entry with a www prefix', () => {
    expect(matchTakedown(fixture, 'https://www.blocked.com/article')).toEqual(domainEntry);
  });

  it('matches a domain-level entry on a subdomain', () => {
    expect(matchTakedown(fixture, 'https://sports.blocked.com/article')).toEqual(domainEntry);
  });

  it('does not match an unrelated domain that merely contains the blocked one', () => {
    expect(matchTakedown(fixture, 'https://notblocked.com/article')).toBeNull();
  });

  it('returns null for a URL that is not listed', () => {
    expect(matchTakedown(fixture, 'https://clean-site.com/article')).toBeNull();
  });

  it('returns null for an invalid URL', () => {
    expect(matchTakedown(fixture, 'not a url')).toBeNull();
  });
});

describe('getTakedown', () => {
  it('returns null when the real takedown list has no matching entry', () => {
    expect(getTakedown('https://example.com/definitely-not-taken-down')).toBeNull();
  });
});
