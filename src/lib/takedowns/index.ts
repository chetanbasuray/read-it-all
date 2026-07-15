import data from './data.json';
import { cleanTrackingParams } from '../utils';

// git-tracked instead of Redis on purpose: a takedown must outlive a cache
// flush or a Redis outage, and each entry going through a commit/PR is itself
// the audit trail (the GitHub issue link doubles as immutable proof of the request)
export interface TakedownEntry {
  requestId: string;
  link: string;
  date: string;
  note?: string;
}

interface TakedownsData {
  urls: Record<string, TakedownEntry>;
  domains: Record<string, TakedownEntry>;
}

// exported separately from getTakedown so the matching logic can be unit
// tested against a fixture, without mocking the real (usually empty) data.json
export function matchTakedown(takedowns: TakedownsData, url: string): TakedownEntry | null {
  let parsed: URL;
  try {
    parsed = new URL(cleanTrackingParams(url));
  } catch {
    return null;
  }

  const urlEntry = takedowns.urls[parsed.href];
  if (urlEntry) return urlEntry;

  // a domain-level takedown covers subdomains too ("all content from their site"),
  // unlike a URL-level one, which is about one specific article
  const hostname = parsed.hostname.replace(/^www\./, '');
  for (const [domain, entry] of Object.entries(takedowns.domains)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return entry;
    }
  }

  return null;
}

export function getTakedown(url: string): TakedownEntry | null {
  return matchTakedown(data as TakedownsData, url);
}
