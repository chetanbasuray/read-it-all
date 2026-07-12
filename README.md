# Read It All

Paste a paywalled article URL, get a clean, distraction-free reading view, and share the link with anyone. No account, no login required to read.

Live at [read-it-all-omega.vercel.app](https://read-it-all-omega.vercel.app/). Built with Next.js 14 (App Router), deployed on Vercel.

## Features

- **Paste a URL** on the homepage to bypass a paywall, using a chain of fallback strategies: direct fetch with rotating bot user agents, JSON-LD structured data, an AMP variant of the page, headless browser rendering (Playwright locally, Browserless in production), Google Cache, and the Wayback Machine.
- **Bookmarklet** for sites that need your own logged-in session: it extracts the article straight from the page DOM in your browser and hands it to the reader, no server-side scraping needed.
- **Session cookies** (advanced option) let the server authenticate as you for a single request, for sites like WSJ that need a subscription.
- **Reader view** with dark mode, adjustable font size, and a share button that copies or natively shares the link.
- **Shareable links**: every article gets a permanent `/reader/<id>` link with real Open Graph and Twitter Card metadata, so it unfurls with the article's actual title, image, and description on Slack, iMessage, or social media instead of a generic site preview.
- **Caching**: identical URLs (tracking parameters stripped) map to the same link and reuse the cached scrape.

## How caching and freshness work

Two concerns are handled separately:

- **Link permanence**: a small, permanent record maps a `/reader/<id>` link to its original URL, so the link itself never dies.
- **Content freshness**: the actual scraped content has a sliding 60-day cache, refreshed on every view, so popular articles stay cached indefinitely and cold ones get reclaimed. Content older than 7 days gets silently re-scraped in the background on the next visit, so a page that has genuinely changed does not stay stale forever. If the content has been evicted entirely, opening the link transparently re-scrapes it under the same id, so the reader never sees a dead link, just a brief loading state.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Redis configured, the app still runs and scrapes on demand, it just will not cache anything between requests.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `KV_URL` / `KV_REST_API_URL` | No | Vercel KV (Upstash Redis) connection. Enables caching; without it every request is scraped fresh. |
| `BROWSERLESS_API_KEY` | No | Uses [Browserless](https://www.browserless.io/) for the headless-browser fallback instead of a local Playwright/Chromium install. Needed in most serverless deployments. |
| `BROWSERLESS_URL` | No | Overrides the default Browserless endpoint, for a self-hosted instance. |

### Testing

```bash
npm run lint
npm test
npm run build
```

## Contributing

Issues labeled [`good first issue`](https://github.com/chetanbasuray/read-it-all/labels/good%20first%20issue) or [`help wanted`](https://github.com/chetanbasuray/read-it-all/labels/help%20wanted) are good places to start. See the [issue tracker](https://github.com/chetanbasuray/read-it-all/issues) for the current roadmap.

- Branch names: `feat/<description>` or `fix/<description>`.
- Commit messages and PR titles: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `build:`, `ci:`, `perf:`, `style:`, `revert:`).
- `main` requires a pull request; CI (lint, test, build) must pass before merging.
- Deploys are skipped for `docs:`/`ci:`/`chore:`/`style:`/`test:` commits via Vercel's Ignored Build Step (`scripts/vercel-ignore-build.sh`), since those do not change runtime behavior.

## License

MIT
