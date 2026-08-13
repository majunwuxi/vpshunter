/**
 * Maps forum / discovery author names to known provider slugs.
 * Add entries as new adapters are created or new aliases surface.
 */
export const PROVIDER_ALIASES: Record<
  string,
  string
> = {
  bytevirt: 'bytevirt',
  hostus: 'hostus',
  'host us': 'hostus',
  racknerd: 'racknerd',
  'rack nerd': 'racknerd'
};

/**
 * Returns the canonical provider slug for a free-form name (author,
 * title guess, etc.). Matching is case-insensitive and normalizes
 * spacing/punctuation. Returns null when no adapter exists yet.
 */
export function matchProviderSlug(
  name: string
): string | null {
  if (!name) return null;

  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ');

  if (!normalized) return null;

  if (PROVIDER_ALIASES[normalized]) {
    return PROVIDER_ALIASES[normalized];
  }

  // Also try direct slug match
  if (PROVIDER_ALIASES[name.toLowerCase()]) {
    return PROVIDER_ALIASES[
      name.toLowerCase()
    ];
  }

  return null;
}