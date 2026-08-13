import {
  createWhmcsProvider,
  type PackageCard
} from '@/lib/crawler/whmcs';
import { loadHtml } from '@/lib/crawler/fetch';

export function parseTableList(
  html: string,
  baseUrl: string
): PackageCard[] {
  const $ = loadHtml(html);
  const cards: PackageCard[] = [];

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

const racknerdConfig = {
  slug: 'racknerd',
  name: 'RackNerd',
  // Disabled: my.racknerd.com cart flow returns HTTP 403 (Cloudflare).
  // List page parses fine; checkout confirmation requires Playwright.
  enabled: false,

  baseUrl: 'https://www.racknerd.com',

  categories: [
    '/kvm-vps'
  ],

  parseList: parseTableList,

  annualCycleValues: [
    'annually',
    'annual',
    'yearly'
  ],

  matchCountry(
    text: string
  ): string | null {
    if (
      /Tokyo|Japan|Seoul|Korea|Singapore|Hong ?Kong/i.test(
        text
      )
    ) {
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
    }

    if (/Los Angeles|San Jose|Seattle|Dallas|Utah|Chicago|New York|Atlanta|Ashburn|Tampa|Miami|Montreal|Toronto|London|Amsterdam|Dublin|Frankfurt|Strasbourg|France/i.test(text)) {
      return 'US';
    }

    return null;
  },

  resolveCity(
    text: string
  ): string {
    const city =
      /Los Angeles/.test(text)
        ? 'Los Angeles'
        : /San Jose/.test(text)
          ? 'San Jose'
          : /Seattle/.test(text)
            ? 'Seattle'
            : /Dallas/.test(text)
              ? 'Dallas'
              : /Tokyo/.test(text)
                ? 'Tokyo'
                : /Seoul/.test(text)
                  ? 'Seoul'
                  : /Singapore/.test(text)
                    ? 'Singapore'
                    : /Hong Kong/.test(text)
                      ? 'Hong Kong'
                      : '';

    return city;
  }
};

export const racknerdMonitor =
  createWhmcsProvider(
    racknerdConfig
  );