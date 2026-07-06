import type { Browser, BrowserContext } from 'playwright';

let browserInstance: Browser | null = null;

async function getLocalHtml(url: string, cookies?: string): Promise<string> {
  const { chromium } = await import('playwright');

  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }

  const context: BrowserContext = await browserInstance.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (cookies) {
    try {
      const parsed = cookies.split(';').filter(Boolean).map((pair) => {
        const [name, ...rest] = pair.trim().split('=');
        return { name: name.trim(), value: rest.join('=').trim() };
      });
      const domain = new URL(url).hostname;
      await context.addCookies(
        parsed.map((c) => ({
          name: c.name,
          value: c.value,
          domain,
          path: '/',
        })),
      );
    } catch {
      // cookie setting failed silently
    }
  }

  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 3000)));

  const html = await page.content();
  await page.close();
  await context.close();
  return html;
}

async function getCloudHtml(url: string, cookies?: string): Promise<string> {
  const baseUrl =
    process.env.BROWSERLESS_URL || 'https://chrome.browserless.io';
  const token = process.env.BROWSERLESS_API_KEY;

  const response = await fetch(`${baseUrl}/content?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      options: {
        waitFor: 5000,
        waitUntil: 'networkidle',
        ...(cookies
          ? { cookies: [{ name: 'Cookie', value: cookies }] }
          : {}),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Browserless error (${response.status}): ${text}`);
  }

  return await response.text();
}

export async function renderPage(
  url: string,
  cookies?: string,
): Promise<string> {
  if (process.env.BROWSERLESS_API_KEY) {
    return getCloudHtml(url, cookies);
  }
  return getLocalHtml(url, cookies);
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
