import { fetchHtml, loadHtml } from '@/lib/crawler/fetch';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { DiscoveryItem } from '@/lib/discovery/store';

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

const FORUM_DOMAINS =
  /lowendspirit|lowendtalk|discourse\.org|vanillaforums/i;

const NOISE_DOMAINS =
  /cdn-cgi|fonts\.|gravatar|google|twitter|^x\.com$|facebook|youtube|instagram|telegram|^t\.me$|discord|github\.com\/vanilla|pinterest|reddit|linkedin/i;

/**
 * Extracts candidate official / product URLs from a thread detail page.
 * Excludes forum, social, tracking and font domains, and image assets.
 */
export function extractOfficialUrls(
  html: string
): string[] {
  const $ = loadHtml(html);
  const seen = new Set<string>();
  const urls: string[] = [];

  $('a[href]').each((_, el) => {
    const href =
      $(el).attr('href') ?? '';

    if (!/^https?:\/\//i.test(href)) {
      return;
    }

    let url: URL;

    try {
      url = new URL(href);
    } catch {
      return;
    }

    const host = url.hostname;

    if (
      FORUM_DOMAINS.test(host) ||
      NOISE_DOMAINS.test(host) ||
      /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(
        url.pathname
      ) ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js')
    ) {
      return;
    }

    const key =
      host + url.pathname;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    urls.push(url.toString());
  });

  return urls.slice(0, 5);
}

async function fetchThreadMeta(
  sourceUrl: string
): Promise<{
  startedAt: string | null;
  officialUrls: string[];
}> {
  try {
    const html =
      await fetchHtml(sourceUrl);

    return {
      startedAt:
        extractStartedAt(html),
      officialUrls:
        extractOfficialUrls(html)
    };
  } catch {
    return {
      startedAt: null,
      officialUrls: []
    };
  }
}
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

  const cutoff =
    typeof maxStartedAgeHours === 'number'
      ? Date.now() -
        maxStartedAgeHours * 60 * 60 * 1000
      : 0;

  const recent: DiscoveryItem[] = [];

  for (const item of candidates) {
    const meta =
      await fetchThreadMeta(
        item.sourceUrl
      );

    if (
      cutoff > 0
    ) {
      const startedMs = meta.startedAt
        ? Date.parse(meta.startedAt)
        : 0;

      if (
        !Number.isFinite(startedMs) ||
        startedMs < cutoff
      ) {
        continue;
      }
    }

    recent.push({
      ...item,
      startedAt:
        meta.startedAt ??
        item.startedAt,
      officialUrls:
        meta.officialUrls
    });
  }

  return recent;
}