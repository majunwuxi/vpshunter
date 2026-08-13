import { chromium, type Browser } from 'playwright';

const NAVIGATION_TIMEOUT_MS = 30_000;

export async function openBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true
  });
}

export async function gotoPage(
  browser: Browser,
  url: string
) {
  const context =
    await browser.newContext({
      userAgent:
        process.env.MONITOR_USER_AGENT ??
        'VPS-Hunter/1.0'
    });

  const page = await context.newPage();

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: NAVIGATION_TIMEOUT_MS
  });

  return page;
}