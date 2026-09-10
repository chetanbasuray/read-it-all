# Headless Browser

Playwright-based rendering fallback used when direct fetches are blocked. Locally it launches real Chrome through Playwright; on Vercel it uses `@sparticuz/chromium` via `playwright-core`. A module-level browser singleton is reused across pages and closed after an idle timeout or on `SIGTERM`.

## renderPage

`renderPage(url: string, cookies?: string): Promise<string>`

Renders a URL to its post-JavaScript HTML. When `BROWSERLESS_API_KEY` is set it delegates to the Browserless cloud endpoint, otherwise it renders locally. Local rendering patches common headless-automation tells, validates every navigation request with `validateUrl` to stop internal-address redirects, and applies session cookies when supplied.

## closeBrowser

`closeBrowser(): Promise<void>`

Closes the shared browser instance and drops the module-level reference.
