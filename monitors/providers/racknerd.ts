import type {
  ProviderMonitor,
  RawVpsOffer
} from '@/monitors/types';
import { fetchHtml, loadHtml } from '@/lib/crawler/fetch';
import {
  parseCpu,
  parseRamMb,
  parseStorageGb,
  detectStorageType,
  detectDedicatedIpv4,
  parseSmtp25
} from '@/lib/crawler/parse';
import { verifyRackNerdCheckout } from '@/lib/crawler/racknerd-checkout';
import { logger } from '@/lib/utils/logger';

export interface RackNerdCard {
  name: string;
  contentText: string;
  priceAmount: string;
  priceCycle: string;
  qtyText: string;
  orderUrl: string;
}

export function parseTableList(
  html: string,
  baseUrl: string
): RackNerdCard[] {
  const $ = loadHtml(html);
  const cards: RackNerdCard[] = [];

  $('table.plan-list tr').each(
    (_, el) => {
      const $cells = $(el).find('td');

      if ($cells.length < 6) {
        return;
      }

      const planCell =
        $cells.eq(0).text()
          .replace(/\s+/g, ' ')
          .trim();

      const cpuCell =
        $cells.eq(1).text()
          .replace(/\s+/g, ' ')
          .trim();

      const storageCell =
        $cells.eq(2).text()
          .replace(/\s+/g, ' ')
          .trim();

      const ipv4Cell =
        $cells.eq(4).text()
          .replace(/\s+/g, ' ')
          .trim();

      const priceCell =
        $cells.eq(5).text()
          .replace(/\s+/g, ' ')
          .trim();

      const orderUrl =
        $cells.eq(6).find('a').attr('href') ??
        '';

      const name =
        `${planCell} VPS`;

      const contentText =
        `${cpuCell} ${planCell} ${storageCell} ${ipv4Cell}`
          .replace(/\s+/g, ' ')
          .trim();

      if (!name || !contentText) {
        return;
      }

      cards.push({
        name,
        contentText,
        priceAmount: priceCell,
        priceCycle: priceCell,
        qtyText: '',
        orderUrl: orderUrl.startsWith('http')
          ? orderUrl
          : `${baseUrl}${orderUrl}`
      });
    }
  );

  return cards;
}

const LIST_URL =
  'https://www.racknerd.com/kvm-vps';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function matchCountry(
  text: string
): string | null {
  if (/Tokyo|Japan/i.test(text)) {
    return 'JP';
  }

  if (/Seoul|Korea/i.test(text)) {
    return 'KR';
  }

  if (/Singapore/i.test(text)) {
    return 'SG';
  }

  if (/Hong ?Kong/i.test(text)) {
    return 'HK';
  }

  if (
    /Los Angeles|San Jose|Seattle|Dallas|Utah|Chicago|New York|Atlanta|Ashburn|Tampa|Miami|Montreal|Toronto|London|Amsterdam|Dublin|Frankfurt|Strasbourg|France/i.test(
      text
    )
  ) {
    return 'US';
  }

  return null;
}

function resolveCity(
  text: string
): string {
  if (/Tokyo/.test(text)) return 'Tokyo';
  if (/Seoul/.test(text)) return 'Seoul';
  if (/Singapore/.test(text)) return 'Singapore';
  if (/Hong Kong/.test(text)) return 'Hong Kong';
  if (/Los Angeles/.test(text)) return 'Los Angeles';
  if (/San Jose/.test(text)) return 'San Jose';
  if (/Seattle/.test(text)) return 'Seattle';
  if (/Dallas/.test(text)) return 'Dallas';
  if (/Chicago/.test(text)) return 'Chicago';
  if (/New York/.test(text)) return 'New York';
  return '';
}

function isTargetRegion(
  text: string
): boolean {
  return /Tokyo|Japan|Seoul|Korea|Singapore|Hong ?Kong/i.test(
    text
  );
}

export const racknerdMonitor: ProviderMonitor = {
  slug: 'racknerd',
  enabled: true,

  async discover(): Promise<string[]> {
    return [LIST_URL];
  },

  async verify(
    url: string
  ): Promise<RawVpsOffer[]> {
    const html = await fetchHtml(
      url,
      BROWSER_UA
    );

    const cards = parseTableList(
      html,
      'https://www.racknerd.com'
    );

    if (cards.length === 0) {
      logger.warn(
        {
          provider: 'racknerd',
          url
        },
        'no packages parsed'
      );

      return [];
    }

    const offers: RawVpsOffer[] = [];

    for (const card of cards) {
      let conf:
        | Awaited<
            ReturnType<
              typeof verifyRackNerdCheckout
            >
          >
        | null = null;

      try {
        conf = await verifyRackNerdCheckout(
          card.orderUrl
        );
      } catch (error) {
        logger.warn(
          {
            provider: 'racknerd',
            plan: card.name,
            err:
              error instanceof Error
                ? error.message
                : String(error)
          },
          'checkout failed'
        );
      }

      // Plan info: prefer confproduct summary, fall back to list text.
      const configText =
        conf?.configText ??
        card.contentText;

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

      if (
        !cpu ||
        !ramMb ||
        !storageGb
      ) {
        logger.info(
          {
            provider: 'racknerd',
            plan: card.name,
            cpu,
            ramMb,
            storageGb
          },
          'plan info incomplete'
        );

        continue;
      }

      // Billing cycle: prefer the annual price from checkout.
      let price =
        Number(
          card.priceAmount.match(
            /[\d.]+/
          )?.[0] ?? 0
        );

      let billing: RawVpsOffer['billingPeriod'] =
        card.priceAmount.includes(
          'month'
        )
          ? 'monthly'
          : card.priceAmount.includes(
              'year'
            )
            ? 'annual'
            : 'monthly';

      let checkoutVerified =
        false;

      if (conf?.reached) {
        checkoutVerified = true;

        const annual =
          conf.cycles.find(
            (c) =>
              c.value === 'annual'
          );

        if (annual) {
          price = annual.price;
          billing = 'annual';
        }
      }

      // Determine target locations.
      const fixedCountry =
        matchCountry(configText);

      let targets: Array<{
        countryCode: string;
        city: string;
      }>;

      if (fixedCountry) {
        targets = [
          {
            countryCode:
              fixedCountry,
            city: resolveCity(
              configText
            )
          }
        ];
      } else if (conf?.locationOptions) {
        targets = conf.locationOptions
          .filter(isTargetRegion)
          .map((label) => ({
            countryCode:
              /Tokyo|Japan/i.test(label)
                ? 'JP'
                : /Seoul|Korea/i.test(label)
                  ? 'KR'
                  : /Singapore/i.test(label)
                    ? 'SG'
                    : 'HK',
            city: resolveCity(label)
          }));
      } else {
        targets = [];
      }

      if (targets.length === 0) {
        logger.info(
          {
            provider: 'racknerd',
            plan: card.name,
            fixedCountry,
            locationOptions:
              conf?.locationOptions
          },
          'no target region'
        );

        continue;
      }

      for (const target of targets) {
        offers.push({
          provider: 'RackNerd',
          planName: card.name,
          countryCode:
            target.countryCode,
          city: target.city,
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
          price,
          billingPeriod: billing,
          available: true,
          productUrl:
            card.orderUrl,
          orderUrl:
            card.orderUrl,
          verificationLevel:
            checkoutVerified
              ? 'A'
              : 'C',
          verifiedAt:
            new Date()
        });
      }
    }

    return offers;
  }
};