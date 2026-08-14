import type { MonitorRules } from '@/lib/rules/types';

/**
 * A minimal plan projection as stored in the plans table, used to
 * decide whether a plan should be shown on the dashboard.
 */
export interface PlanFilterRow {
  cpu: number | null;
  ram_mb: number | null;
  storage_gb: number | null;
  storage_type: string | null;
  ipv4_count: number | null;
  dedicated_ipv4: boolean | null;
  price_usd_year: number | null;
  rdns_supported: boolean | null;
  verification_level: string | null;
  available: boolean | null;
}

const ALLOWED_TYPES = [
  'SSD',
  'NVME',
  'ENTERPRISE SSD'
];

/**
 * Returns whether a stored plan meets the active rules. Mirrors the
 * rules-engine logic so the dashboard shows only qualifying deals.
 */
export function planMatchesRules(
  plan: PlanFilterRow,
  rules: MonitorRules
): {
  matches: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (
    (plan.cpu ?? 0) <
    rules.hardware.minVcpu
  ) {
    reasons.push('CPU below minimum');
  }

  if (
    (plan.ram_mb ?? 0) <
    rules.hardware.minRamMb
  ) {
    reasons.push('RAM below minimum');
  }

  if (
    (plan.storage_gb ?? 0) <
    rules.hardware.minStorageGb
  ) {
    reasons.push('Storage below minimum');
  }

  if (
    rules.hardware.requireDedicatedIpv4 &&
    plan.dedicated_ipv4 !== true
  ) {
    reasons.push('No dedicated IPv4');
  }

  if (
    (plan.ipv4_count ?? 0) < 1
  ) {
    reasons.push('No IPv4');
  }

  if (
    rules.hardware.requireSolidState
  ) {
    const type =
      (plan.storage_type ?? '')
        .toUpperCase();

    const solid =
      ALLOWED_TYPES.some(
        (allowed) =>
          type.includes(allowed)
      );

    if (!solid) {
      reasons.push(
        'Storage is not SSD/NVMe'
      );
    }
  }

  if (plan.available === false) {
    reasons.push('Out of stock');
  }

  if (
    plan.verification_level !== 'A'
  ) {
    reasons.push(
      'Checkout not fully verified'
    );
  }

  const price =
    plan.price_usd_year ?? 0;

  if (
    price >=
      rules.pricing.standardMaxUsdYear
  ) {
    // Maybe qualifies via PTR tier
    if (
      plan.rdns_supported === true &&
      price <
        rules.pricing.rdnsMaxUsdYear
    ) {
      // ok, PTR tier
    } else {
      reasons.push(
        'Price exceeds allowed tier'
      );
    }
  }

  return {
    matches: reasons.length === 0,
    reasons
  };
}