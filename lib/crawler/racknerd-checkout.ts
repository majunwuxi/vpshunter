import { chromium } from 'playwright';
import { logger } from '@/lib/utils/logger';

const NAV_TIMEOUT_MS = 60_000;

export interface RackNerdCycle {
  value: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  price: number;
}

export interface RackNerdConf {
  reached: boolean;
  cloudflare: 'passed' | 'failed';
  cycles: RackNerdCycle[];
  locationOptions: string[];
  configText: string;
  error?: string;
}

function parseCycle(value: string): RackNerdCycle['value'] | null {
  const v = value.toLowerCase();
  if (v.includes('annual')) return 'annual';
  if (v.includes('semi-annual') || v.includes('semi annual') || v.includes('semiannual')) return 'semiannual';
  if (v.includes('quarter')) return 'quarterly';
  if (v.includes('month')) return 'monthly';
  return null;
}

/**
 * Opens the RackNerd cart page in a real browser (needed to pass the
 * Cloudflare check), reads billing cycles, location options and the plan
 * summary text.
 */
export async function verifyRackNerdCheckout(
  cartUrl: string
): Promise<RackNerdConf> {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true
    });

    const context =
      await browser.newContext({
        userAgent:
          process.env.MONITOR_USER_AGENT ??
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      });

    const page =
      await context.newPage();

    await page.goto(cartUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS
    });

    // Allow Cloudflare to complete.
    await page.waitForTimeout(6000);

    const url = page.url();
    const isConf = url.includes('confproduct');

    if (!isConf) {
      await browser.close();
      return {
        reached: false,
        cloudflare: 'passed',
        cycles: [],
        locationOptions: [],
        configText: '',
        error: 'confproduct not reached'
      };
    }

    const body =
      (await page.textContent('body')) ??
      '';

    // Billing cycles: "$17.99 USD Monthly" ... "$215.88 USD Annually"
    const cycles: RackNerdCycle[] = [];

    const cycleMatches =
      body.match(
        /\$([\d,]+(?:\.\d{1,2})?)\s*USD\s+(Monthly|Quarterly|Semi-Annually|Annually)/g
      ) ?? [];

    for (const match of cycleMatches) {
      const parsed =
        match.match(
          /\$([\d,]+(?:\.\d{1,2})?)\s*USD\s+(\w[\w-]*\w)/
        );

      if (!parsed) continue;

      const period =
        parseCycle(parsed[2]);

      if (!period) continue;

      cycles.push({
        value: period,
        price: Number(
          parsed[1].replace(/,/g, '')
        )
      });
    }

    // Location options from select[name="configoption[1]"]
    const locationOptions: string[] =
      [];

    const locSelect = page.locator(
      'select[name="configoption[1]"]'
    );

    if ((await locSelect.count()) > 0) {
      const opts =
        await locSelect
          .locator('option')
          .allTextContents();

      for (const opt of opts) {
        const text = opt
          .replace(/\s+/g, ' ')
          .trim();

        if (text) {
          locationOptions.push(text);
        }
      }
    }

    // Plan summary text (the header box describing the plan).
    const configText = body
      .replace(/\s+/g, ' ')
      .replace(/Login Register View Cart/g, '')
      .trim();

    await browser.close();

    return {
      reached: true,
      cloudflare: 'passed',
      cycles,
      locationOptions,
      configText
    };
  } catch (error) {
    logger.warn(
      {
        url: cartUrl,
        err:
          error instanceof Error
            ? error.message
            : String(error)
      },
      'racknerd checkout failed'
    );

    if (browser) {
      await browser.close().catch(() => undefined);
    }

    return {
      reached: false,
      cloudflare: /403|challenge|turnstile|cloudflare/i.test(
        error instanceof Error ? error.message : String(error)
      ) ? 'failed' : 'failed',
      cycles: [],
      locationOptions: [],
      configText: '',
      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}
