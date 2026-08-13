import type {
  ProviderMonitor,
  RawVpsOffer,
  VpsOffer
} from '@/monitors/types';
import { fetchHtml, loadHtml } from '@/lib/crawler/fetch';
import { logger } from '@/lib/utils/logger';
import {
  parseCpu,
  parseRamMb,
  parseStorageGb,
  detectStorageType,
  detectDedicatedIpv4,
  parseBillingPeriod,
  parseSmtp25,
  parsePriceUsd
} from '@/lib/crawler/parse';

export interface WhmcsProviderConfig {
  slug: string;
  name: string;
  enabled: boolean;

  baseUrl: string;

  categories: string[];

  /**
   * WHMCS configoption id used for Location (fallback selector
   * when the id is unknown per plan).
   */
  locationConfigOptionIds?: string[];

  /** Selector for the Location <select>, overrides configoption ids. */
  locationSelector?: string;

  /**
   * Country detection from config text. Return ISO code (JP/KR/HK/SG/US/...)
   * or null if not identifiable.
   */
  matchCountry(text: string): string | null;

  /** Map a country code + config text to a city label. */
  resolveCity(text: string, countryCode: string): string;

  /** Optional override for cycle value that means "annual". */
  annualCycleValues?: string[];

  /**
   * Custom list-page parser. Defaults to `.package` card parsing.
   * Used when a provider's list page is not the standard WHMCS card grid.
   */
  parseList?(
    html: string,
    baseUrl: string
  ): PackageCard[];

  /**
   * When true, attempts a Playwright checkout verification after the HTTP
   * confproduct step succeeds. On success the plan is upgraded to level A
   * and the final annual price read from the order summary is used.
   * Playwright must be available; otherwise it degrades to level B.
   */
  enableCheckoutUpgrade?: boolean;
}

export interface PackageCard {
  name: string;
  contentText: string;
  priceAmount: string;
  priceCycle: string;
  qtyText: string;
  orderUrl: string;
}

const ORDER_TIMEOUT_MS = 30_000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language':
    'en-US,en;q=0.9'
};

export function parsePackages(
  html: string,
  baseUrl: string
): PackageCard[] {
  const $ = loadHtml(html);
  const packages: PackageCard[] = [];

  $('.package').each((_, el) => {
    const $card = $(el);

    const name =
      $card
        .find('h3.package-title')
        .first()
        .text()
        .trim();

    const contentText =
      $card
        .find('.package-content')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    const priceAmount =
      $card
        .find('.price-amount')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    const priceCycle =
      $card
        .find('.price-cycle')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    const qtyText =
      $card
        .find('.package-qty')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    const orderUrl =
      $card
        .find('a.btn-order-now')
        .first()
        .attr('href') ??
      '';

    if (!name || !contentText) {
      return;
    }

    packages.push({
      name,
      contentText,
      priceAmount,
      priceCycle,
      qtyText,
      orderUrl: orderUrl.startsWith('http')
        ? orderUrl
        : `${baseUrl}${orderUrl}`
    });
  });

  return packages;
}

export interface CycleInfo {
  value: string;
  price: string;
}

export interface ConfInfo {
  cycles: CycleInfo[];
  locationOptions: string[];
  configText: string;
}

export function parseConfProduct(
  html: string,
  config: WhmcsProviderConfig
): ConfInfo {
  const $ = loadHtml(html);
  const cycles: CycleInfo[] = [];

  $(
    'input[name="billingcycle"]'
  ).each((_, el) => {
    const value =
      $(el).attr('value') ??
      '';

    if (!value) return;

    const label = $(el)
      .closest('label')
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    cycles.push({
      value,
      price:
        label.match(
          /\$[\d,.]+/
        )?.[0] ??
        ''
    });
  });

  if (cycles.length === 0) {
    $('.check-cycle').each(
      (_, el) => {
        const $l = $(el).find('label');

        const value =
          $l.attr(
            'data-config-val'
          ) ??
          '';

        if (!value) return;

        const label = $l
          .text()
          .replace(/\s+/g, ' ')
          .trim();

        cycles.push({
          value,
          price:
            label.match(
              /\$[\d,.]+/
            )?.[0] ??
            ''
        });
      }
    );
  }

  const locationOptions: string[] =
    [];

  const locationSelectors =
    config.locationSelector
      ? [config.locationSelector]
      : (
          config.locationConfigOptionIds ??
          []
        ).map(
          (id) =>
            `#inputConfigOption${id}`
        );

  for (const selector of locationSelectors) {
    $(`${selector} option`).each(
      (_, el) => {
        const text = $(el)
          .text()
          .replace(/\s+/g, ' ')
          .trim();

        if (text) {
          locationOptions.push(text);
        }
      }
    );

    if (locationOptions.length > 0) {
      break;
    }
  }

  const configText =
    $('.product-info')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

  return {
    cycles,
    locationOptions,
    configText
  };
}

function findAnnualCycle(
  cycles: CycleInfo[],
  annualValues: string[]
): CycleInfo | undefined {
  return cycles.find(
    (cycle) =>
      annualValues.includes(
        cycle.value
      )
  );
}

function parseQty(
  qtyText: string
): number {
  const match =
    qtyText.match(/\d+/);

  if (!match) return 0;

  return Number(match[0]);
}

export function createWhmcsProvider(
  config: WhmcsProviderConfig
): ProviderMonitor {
  const annualValues =
    config.annualCycleValues ??
    ['annually', 'annual'];

  return {
    slug: config.slug,
    enabled: config.enabled,

    async discover(): Promise<string[]> {
      return config.categories.map(
        (category) =>
          `${config.baseUrl}${category}`
      );
    },

    async verify(
      url: string
    ): Promise<RawVpsOffer[]> {
      const html =
        await fetchHtml(url);

      const cards =

        (config.parseList ??
          parsePackages)(
          html,
          config.baseUrl
        );

      if (cards.length === 0) {
        logger.warn(
          {
            provider: config.slug,
            url
          },
          'no packages parsed'
        );

        return [];
      }

      const offers: RawVpsOffer[] = [];

      for (const card of cards) {
        const cookieJar = new Map<
          string,
          string
        >();

        const jarHeader = () =>
          [
            ...cookieJar.entries()
          ]
            .map(
              ([k, v]) =>
                `${k}=${v}`
            )
            .join('; ');

        const storeCookies = (
          headers: Headers
        ) => {
          const setCookies =
            headers.getSetCookie?.() ??
            [];

          for (const cookie of setCookies) {
            const [pair] =
              cookie.split(';');

            const [key, value] =
              pair.split('=');

            if (key) {
              cookieJar.set(
                key.trim(),
                value.trim()
              );
            }
          }
        };

        let finalPrice =
          parsePriceUsd(
            card.priceAmount
          ) ?? 0;

        let billingPeriod: VpsOffer['billingPeriod'] =
          parseBillingPeriod(
            card.priceCycle
          ) ?? 'monthly';

        let configText =
          card.contentText;

        let confReached =
          false;

        let checkoutVerified =
          false;

        try {
          let controller =
            new AbortController();

          let timer = setTimeout(
            () => controller.abort(),
            ORDER_TIMEOUT_MS
          );

          let response: Response;

          try {
            response = await fetch(
              card.orderUrl,
              {
                headers: {
                  ...BROWSER_HEADERS,
                  Cookie: jarHeader()
                },
                redirect: 'manual',
                signal:
                  controller.signal
              }
            );
          } finally {
            clearTimeout(timer);
          }

          storeCookies(
            response.headers
          );

          let nextUrl = card.orderUrl;

          if (
            response.status >= 300 &&
            response.status < 400
          ) {
            const location =
              response.headers.get(
                'location'
              );

            if (location) {
              nextUrl =
                location.startsWith(
                  'http'
                )
                  ? location
                  : new URL(
                      location,
                      config.baseUrl
                    ).href;
            }
          }

          controller =
            new AbortController();
          timer = setTimeout(
            () => controller.abort(),
            ORDER_TIMEOUT_MS
          );

          let confResponse: Response;

          try {
            confResponse =
              await fetch(
                nextUrl,
                {
                  headers: {
                    ...BROWSER_HEADERS,
                    Cookie: jarHeader()
                  },
                  redirect: 'follow',
                  signal:
                    controller.signal
                }
              );
          } finally {
            clearTimeout(timer);
          }

          storeCookies(
            confResponse.headers
          );

          const confHtml =
            await confResponse.text();

          const $ =
            loadHtml(confHtml);

          const isConfProduct =
            $('.check-cycle').length >
              0 ||
            $('#sectionCycles').length >
              0 ||
            confHtml.includes(
              'confproduct'
            );

          if (isConfProduct) {
            confReached = true;

            const conf =
              parseConfProduct(
                confHtml,
                config
              );

            if (conf.configText) {
              configText =
                conf.configText;
            }

            // locationOptions are ALL selectable datacenter locations,
            // not the plan's fixed location. They must NOT be treated as
            // the plan's country (would cause false positives). They serve
            // only as evidence that a target location is selectable (level A).
            void conf.locationOptions;

            const annual =
              findAnnualCycle(
                conf.cycles,
                annualValues
              );

            if (annual) {
              const annualPrice =
                parsePriceUsd(
                  annual.price
                );

              if (annualPrice) {
                finalPrice =
                  annualPrice;
                billingPeriod =
                  'annual';
              }
            }

            if (
              config.enableCheckoutUpgrade
            ) {
              // Only spend a browser launch on plans that could qualify
              // (hardware minimums). Cheap pre-filter avoids 30x Playwright
              // launches for high-end or under-spec plans.
              const cpu =
                parseCpu(configText);
              const ramMb =
                parseRamMb(configText);
              const storageGb =
                parseStorageGb(configText);
              const ipv4 =
                detectDedicatedIpv4(configText);

              const passesHardware =
                (cpu ?? 0) >= 2 &&
                (ramMb ?? 0) >= 2048 &&
                (storageGb ?? 0) >= 15 &&
                ipv4.dedicated;

              if (passesHardware) {
                const { verifyCheckout } =
                  await import(
                    '@/lib/crawler/checkout'
                  );

                const checkout =
                  await verifyCheckout(
                    card.orderUrl,
                    finalPrice
                  );

                if (
                  checkout.reached
                ) {
                  checkoutVerified = true;

                  if (
                    checkout.finalPriceUsd
                  ) {
                    finalPrice =
                      checkout.finalPriceUsd;
                  }

                  if (
                    checkout.billingPeriod
                  ) {
                    billingPeriod =
                      checkout.billingPeriod;
                  }
                }
              }
            }
          }
        } catch (error) {
          logger.warn(
            {
              provider: config.slug,
              plan: card.name,
              err:
                error instanceof Error
                  ? error.message
                  : String(error)
            },
            'conf product open failed'
          );
        }

        const cpu =
          parseCpu(configText);
        const ramMb =
          parseRamMb(configText);
        const storageGb =
          parseStorageGb(configText);
        const storageType =
          detectStorageType(configText);
        const ipv4 =
          detectDedicatedIpv4(configText);
        const country =
          config.matchCountry(
            configText
          );

        if (
          !cpu ||
          !ramMb ||
          !storageGb ||
          !country
        ) {
          logger.info(
            {
              provider: config.slug,
              plan: card.name,
              cpu,
              ramMb,
              storageGb,
              country
            },
            'plan info incomplete'
          );

          continue;
        }

        const qty =
          parseQty(card.qtyText);

        offers.push({
          provider: config.name,
          planName: card.name,
          countryCode: country,
          city: config.resolveCity(
            configText,
            country
          ),
          cpu,
          ramMb,
          storageGb,
          storageType,
          ipv4Count: ipv4.count,
          dedicatedIpv4:
            ipv4.dedicated,
          rdnsStatus: 'unknown',
          smtp25Policy:
            parseSmtp25(configText),
          currency: 'USD',
          price: finalPrice,
          billingPeriod,
          available: qty > 0,
          stock: qty,
          productUrl:
            card.orderUrl,
          orderUrl:
            card.orderUrl,
          verificationLevel:
            checkoutVerified
              ? 'A'
              : confReached
                ? 'B'
                : 'C',
          verifiedAt:
            new Date()
        });
      }

      return offers;
    }
  };
}