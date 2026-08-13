import * as cheerio from 'cheerio';

const HTTP_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [2_000, 5_000];
const NO_RETRY_STATUS = new Set([
  400,
  401,
  403,
  404,
  410
]);

export async function fetchHtml(
  url: string
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
              process.env.MONITOR_USER_AGENT ??
              'VPS-Hunter/1.0'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timer);

      if (!response.ok) {
        if (
          NO_RETRY_STATUS.has(response.status)
        ) {
          throw new Error(
            `HTTP ${response.status} ${url}`
          );
        }

        throw new Error(
          `HTTP ${response.status} ${url}`
        );
      }

      return await response.text();
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error));

      if (
        error instanceof Error &&
        /HTTP 4/.test(error.message)
      ) {
        throw error;
      }

      if (
        attempt < MAX_RETRIES
      ) {
        const delay =
          RETRY_DELAYS_MS[attempt] ?? 2_000;

        await new Promise(
          (resolve) =>
            setTimeout(resolve, delay)
        );

        continue;
      }
    }
  }

  throw lastError ?? new Error('fetch failed');
}

export function loadHtml(
  html: string
) {
  return cheerio.load(html);
}