import * as cheerio from 'cheerio';

const HTTP_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [2_000, 5_000];
// 4xx that indicate a permanent problem (no point retrying).
// 403 is deliberately excluded: Cloudflare challenges / rate limits
// are often transient and may succeed on a later attempt.
const NO_RETRY_STATUS = new Set([
  400,
  404,
  410
]);

export async function fetchHtml(
  url: string,
  userAgent?: string
): Promise<string> {
  let lastError: Error | undefined;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt += 1
  ) {
    try {
      const controller =
        new AbortController();

      const timer = setTimeout(
        () => controller.abort(),
        HTTP_TIMEOUT_MS
      );

      const response = await fetch(
        url,
        {
          headers: {
            'User-Agent':
              userAgent ??
              process.env.MONITOR_USER_AGENT ??
              'VPS-Hunter/1.0'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timer);

      if (!response.ok) {
        const err = new Error(
          `HTTP ${response.status} ${url}`
        );

        if (
          NO_RETRY_STATUS.has(response.status)
        ) {
          throw err;
        }

        throw err;
      }

      return await response.text();
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error));

      const statusMatch =
        lastError.message.match(
          /HTTP (\d{3})/
        );

      const isNoRetry =
        statusMatch &&
        NO_RETRY_STATUS.has(
          Number(statusMatch[1])
        );

      if (
        isNoRetry ||
        attempt >= MAX_RETRIES
      ) {
        throw lastError;
      }

      const delay =
        RETRY_DELAYS_MS[attempt] ?? 2_000;

      await new Promise(
        (resolve) =>
          setTimeout(resolve, delay)
      );
    }
  }

  throw lastError ?? new Error('fetch failed');
}

export function loadHtml(
  html: string
) {
  return cheerio.load(html);
}