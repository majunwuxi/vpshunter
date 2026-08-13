import {
  scanVanillaCategory,
  parseVanillaOffers
} from '@/discovery/vanilla';
import type { DiscoveryItem } from '@/lib/discovery/store';

const FORUM_URL =
  'https://lowendtalk.com/categories/offers';

/** Strict filter: only posts created within the last 24 hours. */
const MAX_STARTED_AGE_HOURS = 24;

/**
 * Coarse pre-filter on last activity (list page). Generous window so
 * nothing within the start window is dropped before the per-thread
 * detail check.
 */
const COARSE_ACTIVE_WINDOW_HOURS = 48;

export const parseLowEndTalkOffers =
  (html: string) =>
    parseVanillaOffers(
      html,
      'lowendtalk',
      COARSE_ACTIVE_WINDOW_HOURS
    );

/**
 * Scans the LowEndTalk Offers category for deals POSTED in the last
 * 24 hours. Each candidate's detail page is checked for its creation
 * time (JSON-LD dateCreated). Discovery-only: saved as leads.
 */
export async function scanLowEndTalk(): Promise<
  DiscoveryItem[]
> {
  return scanVanillaCategory(
    FORUM_URL,
    'lowendtalk',
    COARSE_ACTIVE_WINDOW_HOURS,
    MAX_STARTED_AGE_HOURS
  );
}