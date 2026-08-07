export interface FeedRule {
  // one domain can publish several feeds (per-section or per-region), and an
  // article only ever appears in one of them, so these are tried in order
  feedUrls: string[];
}

export interface FeedEntry {
  // the entry's own link, already absolute; used to match against the target URL
  link: string | null;
  // RSS <guid> / Atom <id>, which on some feeds is the canonical article URL and
  // on others an opaque tag: URI, so it is only a match candidate, never trusted as one
  guid: string | null;
  title: string | null;
  // full body from content:encoded (RSS) or <content> (Atom); null when the feed
  // only carries a summary, which is the common case and must not be used as article text
  content: string | null;
  // <description> / <summary>, kept solely to detect that content is just a repeat of it
  summary: string | null;
  // dc:creator (RSS) or Atom author/name, so a feed-sourced article still gets a byline
  author: string | null;
}
