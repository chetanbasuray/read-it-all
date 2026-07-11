import { validateUrl } from './urlSafety';

type Browser = any;
type BrowserContext = any;

let browserInstance: Browser | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
  }, IDLE_TIMEOUT_MS);
}

process.on('SIGTERM', async () => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
});

function parseCookies(cookieString: string, domain: string): { name: string; value: string; domain: string; path?: string }[] {
  return cookieString.split(';').filter(Boolean).map((pair) => {
    const [name, ...rest] = pair.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim(), domain, path: '/' };
  });
}

let _chromium: any = null;
async function getChromium() {
  if (!_chromium) {
    // Function()-wrapped import hides this from webpack's static bundler, which
    // otherwise packages playwright's native binary loader in a way that breaks at runtime.
    const pw = await Function(
      'return import("playwright")',
    )() as { chromium: any };
    _chromium = pw.chromium;
  }
  return _chromium;
}

async function getLocalHtml(url: string, cookies?: string): Promise<string> {
  const chromium = await getChromium();

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
  resetIdleTimer();

  const context: BrowserContext = await browserInstance.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // a redirect or client-side navigation inside the page could otherwise steer
  // this browser at an internal address that was never checked by validateUrl
  await context.route('**/*', async (route: any) => {
    const req = route.request();
    if (req.isNavigationRequest()) {
      try {
        await validateUrl(req.url());
      } catch {
        await route.abort();
        return;
      }
    }
    await route.continue();
  });

  if (cookies) {
    try {
      const domain = new URL(url).hostname;
      await context.addCookies(parseCookies(cookies, domain));
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

// unlike getLocalHtml, redirects here are followed by Browserless itself, outside
// our process, so validateUrl can't intercept a redirect to an internal address
async function getCloudHtml(url: string, cookies?: string): Promise<string> {
  const baseUrl =
    process.env.BROWSERLESS_URL || 'https://chrome.browserless.io';
  const token = process.env.BROWSERLESS_API_KEY;

  const body: Record<string, unknown> = {
    url,
    options: {
      waitFor: 5000,
      waitUntil: 'networkidle',
    },
  };

  if (cookies) {
    try {
      const domain = new URL(url).hostname;
      body.options = { ...(body.options as Record<string, unknown>), cookies: parseCookies(cookies, domain) };
    } catch {
      // cookie parsing failed
    }
  }

  const response = await fetch(`${baseUrl}/content?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
