import { getSupabaseAdmin } from '@/lib/db/supabase';
import { fetchHtml, loadHtml } from '@/lib/crawler/fetch';
import { createWhmcsProvider } from '@/lib/crawler/whmcs';
import { logger } from '@/lib/utils/logger';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * Detect whether a site is a WHMCS store by fetching its /index.php/store/
 * (or root) and looking for WHMCS markers. Returns the store URL when found.
 */
export async function detectWhmcsStore(
  baseUrl: string
): Promise<string | null> {
  const candidates = [
    `${baseUrl}/index.php/store/`,
    `${baseUrl}/store/`,
    baseUrl
  ];

  for (const url of candidates) {
    try {
      const html = await fetchHtml(
        url,
        BROWSER_UA
      );

      const $ = loadHtml(html);

      const isWhmcs =
        html.includes('cart.php') ||
        html.includes('clientarea.php') ||
        html.includes('whmcs') ||
        $('a[href*="cart.php"]').length >
          0 ||
        $('a[href*="clientarea.php"]')
          .length > 0 ||
        $('.package, .product').length >
          0;

      if (isWhmcs) {
        return url;
      }
    } catch (error) {
      logger.info(
        {
          url,
          err:
            error instanceof Error
              ? error.message
              : String(error)
        },
        'whmcs probe failed'
      );
    }
  }

  return null;
}

function slugify(
  name: string
): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function countryFromText(
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
    /Dallas|Los Angeles|Atlanta|Chicago|New York|Washington|Seattle|San Jose|Ashburn/i.test(
      text
    )
  ) {
    return 'US';
  }

  if (
    /London|Amsterdam|Paris|Frankfurt/i.test(
      text
    )
  ) {
    return 'DE';
  }

  return null;
}

function cityFromText(
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

/**
 * Builds a WHMCS provider config for a discovered store. Uses sensible
 * defaults (card-list parsing, browser UA, common location configoption
 * ids) so it can start monitoring immediately.
 */
export function buildAutoWhmcsConfig(
  name: string,
  baseUrl: string,
  storeUrl: string,
  sourceUrl: string
) {
  const slug = slugify(name);

  // Convert e.g. "https://bill.hostdare.com/index.php/store/" -> "/index.php/store/"
  let category = '/index.php/store/';

  try {
    const storePath = new URL(
      storeUrl
    ).pathname;

    if (storePath) {
      category = storePath;
    }
  } catch {
    // keep default
  }

  return {
    slug,
    name,
    enabled: true,
    baseUrl,
    categories: [category],
    userAgent: BROWSER_UA,
    // Common WHMCS location configoption ids across providers.
    locationConfigOptionIds: [
      '61',
      '63'
    ],
    sourceUrl,
    matchCountry: countryFromText,
    matchLocationOption(
      label: string
    ): {
      countryCode: string;
      city: string;
    } | null {
      const country = countryFromText(
        label
      );

      if (!country) {
        return null;
      }

      return {
        countryCode: country,
        city: cityFromText(label)
      };
    },
    resolveCity: cityFromText
  };
}

export interface AutoProviderRow {
  id: string;
  slug: string;
  name: string;
  base_url: string;
  categories: string[];
  user_agent: string | null;
  source_url: string | null;
  enabled: boolean;
}

/**
 * Upserts an auto-discovered provider and returns it. Uses the source URL
 * as a dedupe hint via the unique slug.
 */
export async function upsertAutoProvider(
  config: ReturnType<
    typeof buildAutoWhmcsConfig
  >
): Promise<AutoProviderRow | null> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from('auto_providers')
    .upsert(
      {
        slug: config.slug,
        name: config.name,
        base_url: config.baseUrl,
        categories: config.categories,
        user_agent: config.userAgent,
        source_url: config.sourceUrl
      },
      {
        onConflict: 'slug'
      }
    )
    .select(
      'id, slug, name, base_url, categories, user_agent, source_url, enabled'
    )
    .single();

  if (error) {
    logger.error(
      {
        slug: config.slug,
        err: error.message
      },
      'auto provider upsert failed'
    );

    return null;
  }

  return data as unknown as AutoProviderRow;
}

/**
 * Loads all enabled auto-discovered providers.
 */
export async function listAutoProviders(): Promise<
  AutoProviderRow[]
> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return [];
  }

  const { data, error } = await admin
    .from('auto_providers')
    .select(
      'id, slug, name, base_url, categories, user_agent, source_url, enabled'
    )
    .eq('enabled', true);

  if (error) {
    logger.error(
      {
        err: error.message
      },
      'auto providers list failed'
    );

    return [];
  }

  return (
    (data as unknown as AutoProviderRow[]) ??
    []
  );
}

/**
 * Converts a stored auto-provider row into a runnable ProviderMonitor.
 */
export function monitorFromAutoProvider(
  row: AutoProviderRow
): import('@/monitors/types').ProviderMonitor {
  return createWhmcsProvider({
    slug: row.slug,
    name: row.name,
    enabled: row.enabled,
    baseUrl: row.base_url,
    categories: row.categories ?? [
      '/index.php/store/'
    ],
    userAgent:
      row.user_agent ?? undefined,
    locationConfigOptionIds: [
      '61',
      '63'
    ],
    matchCountry: countryFromText,
    matchLocationOption(
      label: string
    ): {
      countryCode: string;
      city: string;
    } | null {
      const country = countryFromText(
        label
      );

      if (!country) {
        return null;
      }

      return {
        countryCode: country,
        city: cityFromText(label)
      };
    },
    resolveCity: cityFromText
  });
}