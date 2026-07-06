import type { Browser } from 'puppeteer';

let browserInstance: Browser | null = null;

function parseCookies(cookieString: string): Array<{ name: string; value: string; domain?: string }> {
  return cookieString.split(';').filter(Boolean).map((pair) => {
    const [name, ...rest] = pair.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim() };
  });
}

async function getLocalHtml(url: string, cookies?: string): Promise<string> {
  const puppeteer = await import('puppeteer');

  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
    });
  }

  const page = await browserInstance.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  if (cookies) {
    try {
      const parsed = parseCookies(cookies);
      const domain = new URL(url).hostname;
      await page.setCookie(
        ...parsed.map((c) => ({ name: c.name, value: c.value, domain })),
      );
    } catch {
      // cookie setting failed silently
    }
  }

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => document.dispatchEvent(new Event('readystatechange')));
  await new Promise((r) => setTimeout(r, 2000));

  const html = await page.content();
  await page.close();
  return html;
}

async function getCloudHtml(url: string, cookies?: string): Promise<string> {
  const baseUrl =
    process.env.BROWSERLESS_URL || 'https://chrome.browserless.io';
  const token = process.env.BROWSERLESS_API_KEY;

  const response = await fetch(
    `${baseUrl}/content?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: {
          waitFor: 3000,
          waitUntil: 'networkidle2',
          ...(cookies ? { cookies: [{ name: 'Cookie', value: cookies }] } : {}),
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Browserless error (${response.status}): ${text}`);
  }

  return await response.text();
}

export async function renderPage(url: string, cookies?: string): Promise<string> {
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
