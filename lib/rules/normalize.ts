import type { VpsOffer } from '@/monitors/types';

export type BillingPeriod =
  VpsOffer['billingPeriod'];

const MONTHS_PER_PERIOD: Record<
  BillingPeriod,
  number
> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1
};

export function annualizePrice(
  price: number,
  billing: BillingPeriod
): number {
  const multiplier =
    MONTHS_PER_PERIOD[billing];

  if (!multiplier) {
    throw new Error(
      `Unknown billing period: ${billing}`
    );
  }

  return price * multiplier;
}

export function normalizeOffer(
  offer: Omit<
    VpsOffer,
    'priceUsdYear'
  >,
  usdExchangeRate = 1
): VpsOffer {
  const annualized =
    annualizePrice(
      offer.price,
      offer.billingPeriod
    );

  const priceUsdYear =
    Number(
      (annualized * usdExchangeRate).toFixed(2)
    );

  return {
    ...offer,
    priceUsdYear
  };
}