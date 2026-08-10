import { createHash } from 'crypto';
import { regex } from 'shorol';

// shared across every place that strips a leading "www." from a hostname
export const WWW_PREFIX_REGEX = regex().start().literal('www.').toRegExp();

// shared across every place that strips HTML tags down to plain text
export const HTML_TAG_REGEX = regex().literal('<').noneOf('>').zeroOrMore().literal('>').toRegExp('g');

// shared across every place that collapses runs of whitespace to a single space
export const WHITESPACE_RUN_REGEX = regex().whitespace().oneOrMore().toRegExp('g');

// plain text should carry real characters, not markup escapes, or an excerpt
// reads "Smith &amp; Jones". Done by substitution rather than an HTML parse,
// which drops everything after a stray "<". &amp; is decoded last so that
// "&amp;lt;" yields "&lt;" instead of "<".
const ENTITY_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [regex().literal('&lt;').toRegExp('g'), '<'],
  [regex().literal('&gt;').toRegExp('g'), '>'],
  [regex().literal('&quot;').toRegExp('g'), '"'],
  [regex().literal('&apos;').toRegExp('g'), "'"],
  [regex().literal('&#').literal('0').zeroOrMore().literal('39;').toRegExp('g'), "'"],
  [regex().literal('&nbsp;').toRegExp('g'), ' '],
  [regex().literal('&amp;').toRegExp('g'), '&'],
];

// dropping tags outright welds block elements together ("<p>One.</p><p>Two</p>"
// becomes "One.Two"), which corrupts excerpts and, worse, makes looksLikeProse
// see "One.Two" as one non-word token and under-count real prose
export function htmlToPlainText(html: string): string {
  const stripped = html.replace(HTML_TAG_REGEX, ' ');
  const decoded = ENTITY_SUBSTITUTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    stripped,
  );
  return decoded.replace(WHITESPACE_RUN_REGEX, ' ').trim();
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'twclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'ref_url',
  'link_source',
  'taid',
  'source',
  'ei',
  'yclid',
  '_ga',
  '_gl',
  'trk',
  'trkCampaign',
  'sc_campaign',
  'sc_channel',
  'sc_content',
  'sc_geo',
  'sc_country',
  'email',
]);

export function cleanTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    const clean = new URL(parsed.origin + parsed.pathname);
    for (const [key, value] of parsed.searchParams) {
      if (!TRACKING_PARAMS.has(key)) {
        clean.searchParams.set(key, value);
      }
    }
    return clean.href;
  } catch {
    return url;
  }
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').substring(0, 16);
}

export function isSameSite(a: string, b: string): boolean {
  try {
    const stripWww = (hostname: string) => hostname.replace(WWW_PREFIX_REGEX, '');
    return stripWww(new URL(a).hostname) === stripWww(new URL(b).hostname);
  } catch {
    return false;
  }
}

// the app's own instructions tell users to select-all + copy from DevTools'
// Application > Cookies panel, which produces a tab-separated table (one row
// per cookie: name, value, domain, path, ...), not a `name=value; ...` Cookie
// header -- passing that raw table straight into a Cookie header throws
// (control characters aren't valid header bytes), so every fetch attempt
// silently fails; rebuild a real Cookie header from that table shape here
export function normalizeCookieInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || !trimmed.includes('\t')) return trimmed;

  const pairs = trimmed
    .split('\n')
    .map((line) => line.split('\t'))
    .filter(([name, value]) => name && value)
    .map(([name, value]) => `${name.trim()}=${value.trim()}`);

  return pairs.length > 0 ? pairs.join('; ') : trimmed;
}
