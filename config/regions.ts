import { RULES } from './rules';

export const REGION_PRIORITY: Record<string, number> = {
  ...Object.fromEntries(
    RULES.preferredRegions.map((code, index) => [
      code,
      100 - index * 10
    ])
  ),
  US: 40,
  DE: 40,
  NL: 40
};

export function regionPriority(countryCode: string) {
  return REGION_PRIORITY[countryCode.toUpperCase()] ?? 10;
}