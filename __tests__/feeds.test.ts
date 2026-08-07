import { describe, it, expect } from 'vitest';
import { parseFeed, findEntryForUrl, normalizeForMatch } from '@/lib/feeds/parse';
import { getFeedRule, FEED_RULES } from '@/lib/feeds';
import { articleFromFeedEntry } from '@/lib/scraper';

const prose =
  'The committee published its findings on Tuesday after a review lasting several months. ' +
  'Investigators examined thousands of documents and interviewed dozens of former staff. ' +
  'The report concludes that oversight was inadequate throughout the period in question. ' +
  'Officials said they would respond to each recommendation in turn before the end of the year. ' +
  'Campaigners welcomed the findings but argued that the proposed remedies do not go far enough. ';

// long enough to clear MIN_FEED_TEXT_LENGTH without the fixture being unreadable
const fullBody = `<p>${prose.repeat(4)}</p>`;

function rss(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>Example</title>${items}</channel>
</rss>`;
}

describe('parseFeed', () => {
  it('reads RSS items including namespaced content:encoded and dc:creator', () => {
    const entries = parseFeed(
      rss(`<item>
        <title>A headline</title>
        <link>https://example.com/story</link>
        <guid>https://example.com/story</guid>
        <description>A short teaser.</description>
        <content:encoded><![CDATA[<p>Full body here.</p>]]></content:encoded>
        <dc:creator>Jane Doe</dc:creator>
      </item>`),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('A headline');
    expect(entries[0].link).toBe('https://example.com/story');
    expect(entries[0].content).toBe('<p>Full body here.</p>');
    expect(entries[0].summary).toBe('A short teaser.');
    expect(entries[0].author).toBe('Jane Doe');
  });

  it('reads Atom entries, preferring rel=alternate over self and replies links', () => {
    const entries = parseFeed(`<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom headline</title>
          <link rel="self" href="https://example.com/feed"/>
          <link rel="replies" href="https://example.com/comments"/>
          <link rel="alternate" href="https://example.com/atom-story"/>
          <id>tag:example.com,2026:1234</id>
          <summary>Teaser</summary>
          <content type="html">Atom body</content>
          <author><name>Sam Smith</name></author>
        </entry>
      </feed>`);

    expect(entries[0].link).toBe('https://example.com/atom-story');
    expect(entries[0].content).toBe('Atom body');
    expect(entries[0].author).toBe('Sam Smith');
  });

  it('returns an empty list for XML that is not a feed', () => {
    expect(parseFeed('<?xml version="1.0"?><root><thing/></root>')).toEqual([]);
  });
});

describe('normalizeForMatch', () => {
  it.each([
    ['https://www.example.com/a/b', 'example.com/a/b'],
    ['http://example.com/a/b/', 'example.com/a/b'],
    ['https://EXAMPLE.com/a/b///', 'example.com/a/b'],
    ['https://example.com/a/b?utm_source=rss#top', 'example.com/a/b'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeForMatch(input)).toBe(expected);
  });

  it('returns null for a non-http URI such as an opaque guid', () => {
    expect(normalizeForMatch('tag:example.com,2026:1234')).toBeNull();
  });
});

describe('findEntryForUrl', () => {
  const entries = parseFeed(
    rss(`<item><link>https://www.example.com/story/</link><guid>tag:example.com,2026:9</guid></item>
         <item><link>https://www.example.com/other</link><guid>tag:example.com,2026:10</guid></item>`),
  );

  it('matches across www, scheme, trailing slash and tracking params', () => {
    expect(findEntryForUrl(entries, 'http://example.com/story?utm_medium=x')?.link).toBe(
      'https://www.example.com/story/',
    );
  });

  it('returns null when the article is not in the feed', () => {
    expect(findEntryForUrl(entries, 'https://example.com/absent')).toBeNull();
  });

  it('does not match on an opaque tag: guid', () => {
    expect(findEntryForUrl(entries, 'tag:example.com,2026:9')).toBeNull();
  });
});

describe('articleFromFeedEntry', () => {
  const base = { title: 'Headline', author: 'Jane Doe', summary: 'Teaser' };

  it('builds an article from a genuine full-text body', () => {
    const article = articleFromFeedEntry({ ...base, content: fullBody }, 'https://example.com/a');
    expect(article).not.toBeNull();
    expect(article!.title).toBe('Headline');
    expect(article!.byline).toBe('Jane Doe');
    expect(article!.textContent.length).toBeGreaterThan(1200);
  });

  it('rejects a short teaser body', () => {
    expect(
      articleFromFeedEntry({ ...base, content: '<p>Only a sentence or two here.</p>' }, 'https://example.com/a'),
    ).toBeNull();
  });

  it('rejects content that merely repeats the summary', () => {
    const repeated = `<p>${prose.repeat(4)}</p>`;
    expect(
      articleFromFeedEntry(
        { ...base, content: repeated, summary: prose.repeat(4) },
        'https://example.com/a',
      ),
    ).toBeNull();
  });

  it('rejects a body that is not prose, such as a link list', () => {
    const links = Array.from({ length: 60 }, (_, i) => `<a href="/p/${i}">/p/${i}</a>`).join(' ');
    expect(articleFromFeedEntry({ ...base, content: links }, 'https://example.com/a')).toBeNull();
  });

  it('returns null when the entry carries no content at all', () => {
    expect(articleFromFeedEntry({ ...base, content: null }, 'https://example.com/a')).toBeNull();
  });

  it('strips scripts from feed HTML, which is as untrusted as a scraped page', () => {
    const withScript = `<p>${prose.repeat(4)}</p><script>alert(1)</script>`;
    const article = articleFromFeedEntry({ ...base, content: withScript }, 'https://example.com/a');
    expect(article!.content).not.toContain('<script');
    expect(article!.content).not.toContain('alert(1)');
  });

  it('takes the lead image from the body when one is present', () => {
    const withImage = `<img src="https://example.com/hero.jpg"><p>${prose.repeat(4)}</p>`;
    const article = articleFromFeedEntry({ ...base, content: withImage }, 'https://example.com/a');
    expect(article!.image).toBe('https://example.com/hero.jpg');
  });
});

describe('getFeedRule', () => {
  it('resolves a registered domain regardless of www', () => {
    expect(getFeedRule('https://www.mashable.com/article/x')).not.toBeNull();
    expect(getFeedRule('https://mashable.com/article/x')).not.toBeNull();
  });

  it('returns null for unregistered domains and malformed input', () => {
    expect(getFeedRule('https://bbc.com/news/x')).toBeNull();
    expect(getFeedRule('not a url')).toBeNull();
  });

  it('registers only absolute https feed urls', () => {
    for (const rule of Object.values(FEED_RULES)) {
      expect(rule.feedUrls.length).toBeGreaterThan(0);
      for (const u of rule.feedUrls) expect(u).toMatch(/^https:\/\//);
    }
  });
});
