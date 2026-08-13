import {
  scanVanillaCategory,
  parseVanillaOffers
} from '@/discovery/vanilla';
import type { DiscoveryItem } from '@/lib/discovery/store';

const FORUM_URL =
  'https://lowendspirit.com/categories/offers';

export const parseLowEndSpiritOffers =
  (html: string) =>
    parseVanillaOffers(
      html,
      'lowendspirit'
    );

/**
 * Scans the LowEndSpirit Offers category for new deal discussions.
 * Discovery-only: saved as leads, never notified directly.
 */
export async function scanLowEndSpirit(): Promise<
  DiscoveryItem[]
> {
  return scanVanillaCategory(
    FORUM_URL,
    'lowendspirit'
  );
}