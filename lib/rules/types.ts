import { RULES } from '@/config/rules';

/**
 * The set of rules used to evaluate offers. Loaded from the database
 * (monitor_rules) when available, otherwise the static defaults.
 */
export interface MonitorRules {
  preferredRegions: string[];
  hardware: {
    minVcpu: number;
    minRamMb: number;
    minStorageGb: number;
    requireSolidState: boolean;
    requireDedicatedIpv4: boolean;
  };
  pricing: {
    standardMaxUsdYear: number;
    rdnsMaxUsdYear: number;
  };
  priceBufferUsd: number;
}

/**
 * Default rules from the static config (used when DB is unavailable).
 */
export function defaultRules(): MonitorRules {
  return {
    preferredRegions: [
      ...RULES.preferredRegions
    ],
    hardware: {
      minVcpu:
        RULES.hardware.minVcpu,
      minRamMb:
        RULES.hardware.minRamMb,
      minStorageGb:
        RULES.hardware.minStorageGb,
      requireSolidState:
        RULES.hardware.requireSolidState,
      requireDedicatedIpv4:
        RULES.hardware.requireDedicatedIpv4
    },
    pricing: {
      standardMaxUsdYear:
        RULES.pricing.standardMaxUsdYear,
      rdnsMaxUsdYear:
        RULES.pricing.rdnsMaxUsdYear
    },
    priceBufferUsd:
      RULES.priceBufferUsd
  };
}

export type MonitorRulesInput = {
  preferredRegions?: string[];
  minVcpu?: number;
  minRamMb?: number;
  minStorageGb?: number;
  requireSolidState?: boolean;
  requireDedicatedIpv4?: boolean;
  standardMaxUsdYear?: number;
  rdnsMaxUsdYear?: number;
  priceBufferUsd?: number;
};

/**
 * Maps an editable input (from the settings form) onto full rules,
 * falling back to current values for anything not provided.
 */
export function rulesFromInput(
  input: MonitorRulesInput,
  current: MonitorRules
): MonitorRules {
  return {
    preferredRegions:
      input.preferredRegions ??
      current.preferredRegions,
    hardware: {
      minVcpu:
        input.minVcpu ??
        current.hardware.minVcpu,
      minRamMb:
        input.minRamMb ??
        current.hardware.minRamMb,
      minStorageGb:
        input.minStorageGb ??
        current.hardware.minStorageGb,
      requireSolidState:
        input.requireSolidState ??
        current.hardware.requireSolidState,
      requireDedicatedIpv4:
        input.requireDedicatedIpv4 ??
        current.hardware.requireDedicatedIpv4
    },
    pricing: {
      standardMaxUsdYear:
        input.standardMaxUsdYear ??
        current.pricing.standardMaxUsdYear,
      rdnsMaxUsdYear:
        input.rdnsMaxUsdYear ??
        current.pricing.rdnsMaxUsdYear
    },
    priceBufferUsd:
      input.priceBufferUsd ??
      current.priceBufferUsd
  };
}