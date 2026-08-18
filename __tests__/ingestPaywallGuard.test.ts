import { describe, it, expect } from 'vitest';
import { isPaywallBoilerplate } from '@/lib/scraper';

// the shape a bookmarklet capture of a subscription wall actually has: ft.com
// serves a barrier page whose title is "Subscribe to read"
const barrier = {
  content: '<div id="barrier-page"><h1>Subscribe to read</h1><p>Choose your plan.</p></div>',
  textContent: 'Subscribe to read Choose your plan.',
};

const realArticle = {
  content: '<p>Genuine reporting that happens to mention a subscription in passing.</p>',
  textContent: 'Genuine reporting that happens to mention a subscription in passing.',
};

describe('paywall wall detection on the ingest path', () => {
  it('flags an ft barrier page by its structural marker', () => {
    expect(isPaywallBoilerplate(barrier)).toBe(true);
  });

  it('does not flag an article that merely mentions subscriptions', () => {
    expect(isPaywallBoilerplate(realArticle)).toBe(false);
  });

  it.each([
    'Subscribe to unlock this article and read on.',
    'Register to unlock this article now.',
    'To read this article for free, register today.',
  ])('flags the copy variant: %s', (text) => {
    expect(isPaywallBoilerplate({ content: '<p>x</p>', textContent: text })).toBe(true);
  });

  it('flags a wall regardless of the content wrapper, since text patterns also apply', () => {
    expect(
      isPaywallBoilerplate({
        content: '<article><p>Subscribe to unlock this article</p></article>',
        textContent: 'Subscribe to unlock this article',
      }),
    ).toBe(true);
  });
});
