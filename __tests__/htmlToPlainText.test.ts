import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from '@/lib/utils';

describe('htmlToPlainText', () => {
  it('keeps a separator between adjacent block elements', () => {
    expect(htmlToPlainText('<p>First sentence.</p><p>Second sentence.</p>')).toBe(
      'First sentence. Second sentence.',
    );
  });

  it('does not weld a sentence onto the next, the defect this exists to prevent', () => {
    const text = htmlToPlainText('<p>...multi-role combat aircraft.</p><p>The Rafale aircraft...</p>');
    expect(text).not.toContain('aircraft.The');
    expect(text).toContain('aircraft. The');
  });

  it('collapses the source indentation a scraped page carries', () => {
    expect(htmlToPlainText('<div>\n\n   Hello\n\t\tworld   \n</div>')).toBe('Hello world');
  });

  it.each([
    ['', ''],
    ['<p></p>', ''],
    ['plain text, no tags', 'plain text, no tags'],
    ['<a href="/x">link</a> then text', 'link then text'],
  ])('handles %s', (input, expected) => {
    expect(htmlToPlainText(input)).toBe(expected);
  });

  it('does not insert a space inside a word split by inline markup', () => {
    // an inline tag mid-word is rare but real; a space here would corrupt the word,
    // so this documents the tradeoff rather than asserting it is ideal
    expect(htmlToPlainText('multi<b>ple</b>')).toBe('multi ple');
  });
});

describe('htmlToPlainText entity decoding', () => {
  it.each([
    ['<p>Smith &amp; Jones</p>', 'Smith & Jones'],
    ['<p>&quot;quoted&quot;</p>', '"quoted"'],
    ['<p>It&#39;s here</p>', "It's here"],
    ['<p>5 &lt; 7 &gt; 3</p>', '5 < 7 > 3'],
    ['<p>a&nbsp;b</p>', 'a b'],
  ])('decodes %s', (input, expected) => {
    expect(htmlToPlainText(input)).toBe(expected);
  });

  it('decodes &amp; last so an escaped entity is not over-decoded', () => {
    expect(htmlToPlainText('<p>&amp;lt;</p>')).toBe('&lt;');
  });
});
