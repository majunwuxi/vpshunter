import { fetchHtml, loadHtml } from '@/lib/crawler/fetch';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { DiscoveryItem } from '@/lib/discovery/store';
import { logger } from '@/lib/utils/logger';

const PRICE_PATTERN =
  /(?:[$€£])\s*[\d,]+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*(?:USD|EUR|GBP)\b/i;

/**
 * Extracts the thread's start (creation) time from a discussion detail page.
 * Vanilla embeds it as JSON-LD `dateCreated` on DiscussionForumPosting.
 * Returns null when not found.
 */
export function extractStartedAt(
  html: string
): string | null {
  const match =
    html.match(
      /"dateCreated"\s*:\s*"([^"]+)"/
    );

  return match?.[1] ?? null;
}

/**
 * Fetches a discussion detail page and returns its start (creation) time.
 * Returns null on any failure (item is kept only when we can confirm age).
 */
async function fetchStartedAt(
  url: string
): Promise<string | null> {
  try {
    const html =
      await fetchHtml(url);

    return extractStartedAt(html);
  } catch (error) {
    logger.warn(
      {
        url,
        err:
          error instanceof Error
            ? error.message
            : String(error)
      },
      'failed to fetch thread start time'
    );

    return null;
  }
}

/**
 * Extracts a likely provider name from the discussion author or title.
 * Best-effort only; empty string is acceptable for the discovery stage.
 */
function guessProvider(
  author: string,
  title: string
): string {
  if (author) {
    return author.trim();
  }

  const match =
    title.match(
      /^([A-Za-z0-9][A-Za-z0-9 .\-]{2,40}?)\s+(?:is|presents|offers|announces|launch)/
    );

  return match ? match[1].trim() : '';
}

function parseDiscussion(
  li: Element,
  $: CheerioAPI,
  source: string
): DiscoveryItem | null {
  const titleLink = $(li)
    .find('.Title a')
    .first();

  const title =
    titleLink.text().trim();

  const href =
    titleLink.attr('href') ?? '';

  if (!title || !href) {
    return null;
  }

  const sourceUrl = href.startsWith('http')
    ? href
    : `https://${source}${href}`;

  const author =
    ($(li)
      .find('.DiscussionAuthor a')
      .first()
      .text()
      .trim() ||
      $(li)
        .find('.IndexPhoto')
        .first()
        .attr('title')
        ?.trim()) ??
    '';

  const priceMatch =
    title.match(PRICE_PATTERN);

  const lastActivityAt =
    $(li)
      .find('.LastCommentDate time')
      .first()
      .attr('datetime')
      ?.trim() ?? undefined;

  return {
    source,
    sourceUrl,
    title,
    providerName:
      guessProvider(author, title),
    detectedPrice:
      priceMatch?.[0]?.trim() ??
      undefined,
    lastActivityAt
  };
}

/**
 * Parses a Vanilla Forums category page (used by LowEndSpirit and
 * LowEndTalk) into discovery items. Exported for fixture testing.
 *
 * @param html       the category page HTML
 * @param source     the source label (e.g. 'lowendtalk')
 * @param maxAgeHours when set, only items whose last activity is within
 *                    this many hours are kept.
 */
export function parseVanillaOffers(
  html: string,
  source: string,
  maxAgeHours?: number
): DiscoveryItem[] {
  const $ = loadHtml(html);
  const items: DiscoveryItem[] = [];

  const cutoff =
    typeof maxAgeHours === 'number'
      ? Date.now() -
        maxAgeHours * 60 * 60 * 1000
      : 0;

  $(
    'li[id^="Discussion_"]'
  ).each((_: number, el: Element) => {
    const item =
      parseDiscussion(el, $, source);

    if (!item) {
      return;
    }

    if (cutoff > 0) {
      const activity = item.lastActivityAt
        ? Date.parse(item.lastActivityAt)
        : 0;

      if (!activity || activity < cutoff) {
        return;
      }
    }

    items.push(item);
  });

  return items;
}

/**
 * Fetches and parses a Vanilla Forums "Offers" category.
 *
 * @param url                the category URL
 * @param source             the discovery source label (e.g. 'lowendtalk')
 * @param maxAgeHours        when set, only items whose last activity is within
 *                           this window are kept (list-page LastCommentDate).
 * @param maxStartedAgeHours when set, each candidate's detail page is fetched
 *                           to read its start (creation) time; only items
 *                           created within this window are kept. Requires one
 *                           extra request per candidate.
 */
export async function scanVanillaCategory(
  url: string,
  source: string,
  maxAgeHours?: number,
  maxStartedAgeHours?: number
): Promise<DiscoveryItem[]> {
  const html =
    await fetchHtml(url);

  const candidates =
    parseVanillaOffers(
      html,
      source,
      maxAgeHours
    );

  if (
    typeof maxStartedAgeHours !== 'number'
  ) {
    return candidates;
  }

  const cutoff =
    Date.now() -
    maxStartedAgeHours * 60 * 60 * 1000;

  const recent: DiscoveryItem[] = [];

  for (const item of candidates) {
    const startedAt =
      await fetchStartedAt(
        item.sourceUrl
      );

    if (!startedAt) {
      continue;
    }

    const startedMs =
      Date.parse(startedAt);

    if (
      Number.isFinite(startedMs) &&
      startedMs >= cutoff
    ) {
      recent.push({
        ...item,
        startedAt
      });
    }
  }

  return recent;
}