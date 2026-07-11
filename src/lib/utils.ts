import { createHash } from 'crypto';

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
