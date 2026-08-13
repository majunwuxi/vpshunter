export const PRICE_BUFFER_USD = 0.25;

export const RULES = {
  preferredRegions: [
    'JP',
    'KR',
    'HK',
    'SG'
  ] as const,

  hardware: {
    minVcpu: 2,
    minRamMb: 2048,
    minStorageGb: 15,
    requireSolidState: true,
    requireDedicatedIpv4: true
  },

  pricing: {
    standardMaxUsdYear: 20,
    rdnsMaxUsdYear: 25
  },

  smtp25Required: false,

  allowedStorageTypes: [
    'SSD',
    'NVME',
    'NVME SSD',
    'ENTERPRISE SSD'
  ] as const,

  verification: {
    minimumNotificationLevel: 'A' as const
  },

  priceBufferUsd: PRICE_BUFFER_USD
} as const;

export type VerificationLevel = 'A' | 'B' | 'C';