import { chromium, type Page } from 'playwright';
import { logger } from '@/lib/utils/logger';
import {
  parseBillingPeriod
} from '@/lib/crawler/parse';
import type { VpsOffer } from '@/monitors/types';

const NAV_TIMEOUT_MS = 40_000;

export interface CheckoutResult {
  reached: boolean;
  /** Final price read from the order summary after selecting annual. */
  finalPriceUsd: number | null;
  billingPeriod: VpsOffer['billingPeriod'] | null;
  /** Hostname/plan confirmation text from the summary. */
  summaryText: string;
  locationOptions: string[];
  error?: string;
}

/**
 * Returns true when Playwright Chromium is usable (browser installed).
 * Keeps Playwright as an optional enhancement: without a browser we fall
 * back to B-level verification (no false positives from unverified data).
 */
export async function canUsePlaywright(): Promise<boolean> {
  try {
    await chromium.launch({
      headless: true
    });
    return true;
  } catch {
    return false;
  }
}

async function selectAnnual(
  page: Page
): Promise<void> {
  const annualLabel = page.locator(
    'label[data-config-val="annually"], label[data-config-val="annual"]'
  ).first();

  try {
    if ((await annualLabel.count()) > 0) {
      await annualLabel.click({
        force: true
      });
      await page.waitForTimeout(3000);
      return;
    }
  } catch {
    // label not clickable; try radio fallback below
  }

  // Fallback: find radio with annual-ish value
  const radio = page.locator(
    'input[name="billingcycle"][value="annually"], input[name="billingcycle"][value="annual"], input[name="billingcycle"][value="yearly"]'
  ).first();

  if ((await radio.count()) > 0) {
    const label = radio.locator(
      'xpath=ancestor::label'
    ).first();

    try {
      await label.click({
        force: true
      });
      await page.waitForTimeout(3000);
    } catch {
      // no annual cycle available; keep current cycle
    }
  }
}

async function readSummary(
  page: Page
): Promise<string> {
  const total = page.locator(
    '#producttotal'
  ).first();

  if ((await total.count()) > 0) {
    return (await total.innerHTML())
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
}

function extractPrice(
  summary: string,
  current: number | null
): number | null {
  // Prefer the /year cycle price
  const yearMatch =
    summary.match(
      /\$([\d,]+(?:\.\d{1,2})?)\s*USD\s*\/\s*年|\$([\d,]+(?:\.\d{1,2})?)\s*USD\s*\/\s*year/i
    );

  if (yearMatch) {
    return Number(
      (yearMatch[1] ?? yearMatch[2])
        .replace(/,/g, '')
    );
  }

  // Fallback to any price in the summary
  const anyPrice =
    summary.match(
      /\$([\d,]+(?:\.\d{1,2})?)\s*USD/
    );

  if (anyPrice) {
    return Number(
      anyPrice[1].replace(/,/g, '')
    );
  }

  return current;
}

/**
 * Opens the order URL in a real browser, selects the annual cycle and reads
 * the final order summary price. Confirms the plan is reachable through the
 * checkout flow (level A evidence).
 */
export async function verifyCheckout(
  orderUrl: string,
  currentPriceUsd?: number | null
): Promise<CheckoutResult> {
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

    await page.goto(orderUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS
    });

    const isConfProduct =
      (await page.locator('.check-cycle').count()) > 0 ||
      (await page.locator('#sectionCycles').count()) > 0 ||
      page.url().includes('confproduct');

    if (!isConfProduct) {
      await browser.close();
      return {
        reached: false,
        finalPriceUsd: null,
        billingPeriod: null,
        summaryText: '',
        locationOptions: [],
        error: 'checkout page not reached'
      };
    }

    await selectAnnual(page);

    const summaryText =
      await readSummary(page);

    const locationOptions: string[] =
      [];

    // Find the configoption select whose options look like locations.
    // Do NOT fall back to an arbitrary select (would mislabel OS/network).
    const locSelects =
      page.locator(
        'select[name^="configoption"]'
      );

    const count =
      await locSelects.count();

    let chosen:
      | import('playwright').Locator
      | null = null;

    for (
      let i = 0;
      i < count;
      i += 1
    ) {
      const select =
        locSelects.nth(i);

      const opts =
        await select
          .locator('option')
          .allTextContents();

      const joined =
        opts.join(' ');

      if (
        /Tokyo|Osaka|Singapore|Hong Kong|HongKong|Seoul|Seattle|Dallas|Los Angeles|Amsterdam|London|New York|Sydney|Chicago|Atlanta|Frankfurt/i.test(
          joined
        )
      ) {
        chosen = select;
        break;
      }
    }

    if (chosen) {
      const opts =
        await chosen
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

    const finalPrice =
      extractPrice(
        summaryText,
        currentPriceUsd ?? null
      );

    const billingPeriod: VpsOffer['billingPeriod'] | null =
      /年|year/i.test(summaryText)
        ? 'annual'
        : parseBillingPeriod(
            summaryText
          );

    await browser.close();

    return {
      reached: true,
      finalPriceUsd: finalPrice,
      billingPeriod,
      summaryText,
      locationOptions
    };
  } catch (error) {
    logger.warn(
      {
        url: orderUrl,
        err:
          error instanceof Error
            ? error.message
            : String(error)
      },
      'checkout verification failed'
    );

    if (browser) {
      await browser.close().catch(
        () => undefined
      );
    }

    return {
      reached: false,
      finalPriceUsd: null,
      billingPeriod: null,
      summaryText: '',
      locationOptions: [],
      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}