import { describe, it, expect } from 'vitest';
import { evaluateOffer } from '@/lib/rules/evaluate';
import { annualizePrice, normalizeOffer } from '@/lib/rules/normalize';
import type { VpsOffer } from '@/monitors/types';

const baseOffer: VpsOffer = {
  provider: 'Test',
  planName: 'Test Plan',
  countryCode: 'JP',
  city: 'Tokyo',
  cpu: 2,
  ramMb: 2048,
  storageGb: 20,
  storageType: 'NVMe',
  ipv4Count: 1,
  dedicatedIpv4: true,
  rdnsStatus: 'unknown',
  currency: 'USD',
  price: 18,
  billingPeriod: 'annual',
  priceUsdYear: 18,
  available: true,
  productUrl: 'https://example.com/vps',
  orderUrl: 'https://example.com/order',
  verificationLevel: 'A',
  verifiedAt: new Date()
};

function makeOffer(
  partial: Partial<VpsOffer>
): VpsOffer {
  return {
    ...baseOffer,
    ...partial
  };
}

describe('annualizePrice', () => {
  it('monthly x12', () => {
    expect(annualizePrice(2, 'monthly')).toBe(24);
  });

  it('quarterly x4', () => {
    expect(annualizePrice(6, 'quarterly')).toBe(24);
  });

  it('semiannual x2', () => {
    expect(annualizePrice(10, 'semiannual')).toBe(20);
  });

  it('annual unchanged', () => {
    expect(annualizePrice(18, 'annual')).toBe(18);
  });
});

describe('normalizeOffer', () => {
  it('converts monthly to usd year', () => {
    const offer = normalizeOffer(
      {
        ...baseOffer,
        price: 1.5,
        billingPeriod: 'monthly'
      } as Omit<VpsOffer, 'priceUsdYear'>
    );

    expect(offer.priceUsdYear).toBe(18);
  });

  it('applies exchange rate', () => {
    const offer = normalizeOffer(
      {
        ...baseOffer,
        currency: 'EUR',
        price: 10,
        billingPeriod: 'annual'
      } as Omit<VpsOffer, 'priceUsdYear'>,
      1.1
    );

    expect(offer.priceUsdYear).toBe(11);
  });
});

describe('evaluateOffer', () => {
  it('1 vCPU FAIL', () => {
    expect(
      evaluateOffer(makeOffer({ cpu: 1 })).qualified
    ).toBe(false);
  });

  it('2 vCPU PASS', () => {
    expect(
      evaluateOffer(makeOffer({ cpu: 2 })).qualified
    ).toBe(true);
  });

  it('1 GB RAM FAIL', () => {
    expect(
      evaluateOffer(makeOffer({ ramMb: 1024 })).qualified
    ).toBe(false);
  });

  it('2 GB RAM PASS', () => {
    expect(
      evaluateOffer(makeOffer({ ramMb: 2048 })).qualified
    ).toBe(true);
  });

  it('14 GB SSD FAIL', () => {
    expect(
      evaluateOffer(makeOffer({ storageGb: 14 })).qualified
    ).toBe(false);
  });

  it('15 GB SSD PASS', () => {
    expect(
      evaluateOffer(makeOffer({ storageGb: 15 })).qualified
    ).toBe(true);
  });

  it('$19.99 PASS', () => {
    expect(
      evaluateOffer(makeOffer({ priceUsdYear: 19.99 })).qualified
    ).toBe(true);
  });

  it('$20.00 FAIL (strict <20)', () => {
    expect(
      evaluateOffer(makeOffer({ priceUsdYear: 20 })).qualified
    ).toBe(false);
  });

  it('$24.99 + PTR PASS', () => {
    expect(
      evaluateOffer(
        makeOffer({
          priceUsdYear: 24.99,
          rdnsStatus: 'confirmed'
        })
      ).qualified
    ).toBe(true);
  });

  it('$25 + PTR FAIL', () => {
    expect(
      evaluateOffer(
        makeOffer({
          priceUsdYear: 25,
          rdnsStatus: 'confirmed'
        })
      ).qualified
    ).toBe(false);
  });

  it('$23 no PTR FAIL', () => {
    expect(
      evaluateOffer(makeOffer({ priceUsdYear: 23 })).qualified
    ).toBe(false);
  });

  it('NAT IPv4 FAIL', () => {
    expect(
      evaluateOffer(
        makeOffer({ dedicatedIpv4: false })
      ).qualified
    ).toBe(false);
  });

  it('mechanical HDD FAIL', () => {
    expect(
      evaluateOffer(
        makeOffer({ storageType: 'HDD' })
      ).qualified
    ).toBe(false);
  });

  it('out of stock FAIL', () => {
    expect(
      evaluateOffer(makeOffer({ available: false })).qualified
    ).toBe(false);
  });

  it('verification B FAIL', () => {
    expect(
      evaluateOffer(
        makeOffer({ verificationLevel: 'B' })
      ).qualified
    ).toBe(false);
  });

  it('C level with full hardware + low price FAIL (checkout unverified)', () => {
    const result = evaluateOffer(
      makeOffer({
        verificationLevel: 'C',
        cpu: 4,
        ramMb: 8192,
        storageGb: 80,
        priceUsdYear: 12
      })
    );

    expect(result.qualified).toBe(false);
    expect(result.reasons).toContain(
      'Checkout not fully verified'
    );
  });

  it('price buffer applied: 19.9 stays qualified', () => {
    expect(
      evaluateOffer(makeOffer({ priceUsdYear: 19.9 })).qualified
    ).toBe(true);
  });
});