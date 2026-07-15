import type { MetadataRoute } from 'next';

const SITE_URL = 'https://read-it-all-omega.vercel.app';

// only the static pages: /reader/[id] pages are disallowed in robots.ts and
// have no fixed list to enumerate anyway (they only exist once someone submits a URL)
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/privacy', '/terms', '/report', '/bookmarklet'].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date('2026-07-15'),
  }));
}
