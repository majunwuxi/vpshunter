import { describe, it, expect } from 'vitest';
import { planMatchesRules } from '@/lib/rules/filter';
import {
  defaultRules,
  rulesFromInput
} from '@/lib/rules/types';

const basePlan = {
  cpu: 2,
  ram_mb: 2048,
  storage_gb: 15,
  storage_type: 'NVMe',
  ipv4_count: 1,
  dedicated_ipv4: true,
  price_usd_year: 18,
  rdns_supported: null,
  verification_level: 'A',
  available: true
};

describe('planMatchesRules', () => {
  const rules = defaultRules();

  it('matches a qualifying plan', () => {
    const result = planMatchesRules(
      basePlan,
      rules
    );

    expect(result.matches).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects low CPU', () => {
    const result = planMatchesRules(
      { ...basePlan, cpu: 1 },
      rules
    );

    expect(result.matches).toBe(false);
    expect(result.reasons).toContain(
      'CPU below minimum'
    );
  });

  it('rejects low RAM', () => {
    const result = planMatchesRules(
      { ...basePlan, ram_mb: 1024 },
      rules
    );

    expect(result.matches).toBe(false);
    expect(result.reasons).toContain(
      'RAM below minimum'
    );
  });

  it('rejects low storage', () => {
    const result = planMatchesRules(
      { ...basePlan, storage_gb: 14 },
      rules
    );

    expect(result.matches).toBe(false);
  });

  it('rejects non-dedicated IPv4', () => {
    const result = planMatchesRules(
      {
        ...basePlan,
        dedicated_ipv4: false
      },
      rules
    );

    expect(result.matches).toBe(false);
    expect(result.reasons).toContain(
      'No dedicated IPv4'
    );
  });

  it('rejects price over standard limit', () => {
    const result = planMatchesRules(
      { ...basePlan, price_usd_year: 21 },
      rules
    );

    expect(result.matches).toBe(false);
  });

  it('accepts PTR tier price when rdns supported', () => {
    const result = planMatchesRules(
      {
        ...basePlan,
        price_usd_year: 23,
        rdns_supported: true
      },
      rules
    );

    expect(result.matches).toBe(true);
  });

  it('rejects out of stock', () => {
    const result = planMatchesRules(
      { ...basePlan, available: false },
      rules
    );

    expect(result.matches).toBe(false);
  });
});

describe('rulesFromInput', () => {
  it('overrides provided fields, keeps rest', () => {
    const current = defaultRules();

    const next = rulesFromInput(
      {
        minVcpu: 4,
        standardMaxUsdYear: 30
      },
      current
    );

    expect(next.hardware.minVcpu).toBe(4);
    expect(
      next.pricing.standardMaxUsdYear
    ).toBe(30);
    expect(
      next.hardware.minRamMb
    ).toBe(current.hardware.minRamMb);
    expect(
      next.pricing.rdnsMaxUsdYear
    ).toBe(current.pricing.rdnsMaxUsdYear);
  });

  it('allows empty regions override', () => {
    const current = defaultRules();

    const next = rulesFromInput(
      { preferredRegions: [] },
      current
    );

    expect(next.preferredRegions).toEqual(
      []
    );
  });
});