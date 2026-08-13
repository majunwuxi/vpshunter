export interface VpsOffer {
  provider: string;

  planName: string;

  countryCode: string;
  city?: string;

  cpu: number;

  ramMb: number;

  storageGb: number;
  storageType: string;

  trafficGb?: number;

  bandwidthMbps?: number;

  ipv4Count: number;

  dedicatedIpv4: boolean;

  rdnsSupported?: boolean;

  rdnsStatus: RdnsStatus;

  rdnsMethod?: string;

  smtp25Policy?: Port25Policy;

  currency: string;

  price: number;

  billingPeriod:
    | 'monthly'
    | 'quarterly'
    | 'semiannual'
    | 'annual';

  priceUsdYear: number;

  stock?: number;

  available: boolean;

  productUrl: string;

  orderUrl?: string;

  verificationLevel:
    | 'A'
    | 'B'
    | 'C';

  verifiedAt: Date;
}

export type RdnsStatus =
  | 'confirmed'
  | 'unsupported'
  | 'unknown';

export type Port25Policy =
  | 'open'
  | 'blocked'
  | 'request-unblock'
  | 'restricted'
  | 'unknown';

export type RawVpsOffer = Omit<
  VpsOffer,
  'priceUsdYear'
>;

export interface ProviderMonitor {
  slug: string;
  enabled: boolean;

  discover(): Promise<string[]>;

  verify(
    url: string
  ): Promise<RawVpsOffer[]>;
}

export interface Evaluation {
  qualified: boolean;
  tier?: 'standard' | 'rdns';
  reasons: string[];
}

export type FailureReason =
  | 'OUT_OF_STOCK'
  | 'PRICE_TOO_HIGH'
  | 'CPU_TOO_LOW'
  | 'RAM_TOO_LOW'
  | 'STORAGE_TOO_LOW'
  | 'NO_IPV4'
  | 'NAT_IPV4'
  | 'CHECKOUT_UNREACHABLE'
  | 'COUPON_INVALID'
  | 'LOCATION_UNAVAILABLE'
  | 'UNKNOWN_STORAGE_TYPE'
  | 'UNKNOWN_IPV4';