import { describe, it, expect } from 'vitest';
import { extractFromJsonLd } from '@/lib/scraper';

function withScript(json: string): string {
  return `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;
}

describe('extractFromJsonLd', () => {
  it('extracts from a well-formed NewsArticle object', () => {
    const html = withScript(
      JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'Title',
        articleBody: 'a'.repeat(250),
        author: { name: 'Author Name' },
      }),
    );
    const result = extractFromJsonLd(html);
    expect(result?.title).toBe('Title');
    expect(result?.byline).toBe('Author Name');
    expect(result?.textContent.length).toBe(250);
  });

  it('extracts from an item nested under @graph', () => {
    const html = withScript(
      JSON.stringify({
        '@graph': [{ '@type': 'WebPage' }, { '@type': 'NewsArticle', headline: 'Graph Title', articleBody: 'b'.repeat(250) }],
      }),
    );
    const result = extractFromJsonLd(html);
    expect(result?.title).toBe('Graph Title');
  });

  it('extracts from a bare top-level array not wrapped in @graph', () => {
    const html = withScript(JSON.stringify([{ '@type': 'NewsArticle', headline: 'Array Title', articleBody: 'c'.repeat(250) }]));
    const result = extractFromJsonLd(html);
    expect(result?.title).toBe('Array Title');
  });

  it('recovers from a literal newline inside a JSON string value', () => {
    const malformed = `{"@type":"NewsArticle","headline":"Broken Title","articleBody":"${'d'.repeat(250)}\n${'e'.repeat(10)}"}`;
    const html = withScript(malformed);
    const result = extractFromJsonLd(html);
    expect(result?.title).toBe('Broken Title');
    expect(result?.textContent.length).toBeGreaterThan(200);
  });

  it('returns null when no script has a usable articleBody', () => {
    const html = withScript(JSON.stringify({ '@type': 'BreadcrumbList' }));
    expect(extractFromJsonLd(html)).toBeNull();
  });

  it('returns null when JSON is unrecoverably malformed', () => {
    const html = withScript('{not json at all');
    expect(extractFromJsonLd(html)).toBeNull();
  });

  it('ignores an articleBody shorter than the minimum length', () => {
    const html = withScript(JSON.stringify({ '@type': 'NewsArticle', headline: 'Too Short', articleBody: 'short' }));
    expect(extractFromJsonLd(html)).toBeNull();
  });
});
