import type { MetadataRoute } from 'next';

const SITE_URL = 'https://read-it-all-omega.vercel.app';

// /reader/ is disallowed on purpose: those pages republish other publishers'
// paywalled article content under our own URLs, and letting search engines
// index full copies of that content is a meaningfully bigger exposure than
// the tool itself existing
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/reader/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
