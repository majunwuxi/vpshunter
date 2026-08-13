import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parsePackages,
  parseConfProduct,
  type WhmcsProviderConfig
} from '@/lib/crawler/whmcs';
import {
  parseCpu,
  parseRamMb,
  parseStorageGb,
  detectStorageType,
  detectDedicatedIpv4,
  parseBillingPeriod,
  parsePriceUsd
} from '@/lib/crawler/parse';

const testConfig: WhmcsProviderConfig = {
  slug: 'bytevirt',
  name: 'ByteVirt',
  enabled: true,
  baseUrl: 'https://bytevirt.com',
  categories: ['/store/vps-jp-kvm'],
  locationConfigOptionIds: ['63'],
  matchCountry: () => null,
  resolveCity: () => 'Tokyo'
};

const fixturePath = (name: string) =>
  path.join(
    process.cwd(),
    'tests',
    'fixtures',
    name
  );

const readFixture = (name: string) =>
  fs.readFileSync(
    fixturePath(name),
    'utf8'
  );

describe('parsePackages', () => {
  const html = readFixture(
    'bytevirt-product.html'
  );

  const packages =
    parsePackages(
      html,
      'https://bytevirt.com'
    );

  it('extracts two packages', () => {
    expect(packages.length).toBe(2);
  });

  it('parses VPS-2048-KVM-JP config', () => {
    const plan = packages.find(
      (p) =>
        p.name ===
        'VPS-2048-KVM-JP'
    );

    expect(plan).toBeDefined();
    expect(plan!.contentText).toContain(
      '2 Core(s)'
    );
    expect(plan!.contentText).toContain(
      '2048MB'
    );
    expect(plan!.contentText).toContain(
      '15GB NVME RAID1'
    );
    expect(plan!.contentText).toContain(
      '1 IPv4 Addresses'
    );
    expect(plan!.contentText).toContain(
      'Tokyo, JP Location'
    );
  });

  it('reads displayed price and cycle', () => {
    const plan = packages.find(
      (p) =>
        p.name ===
        'VPS-2048-KVM-JP'
    );

    expect(plan!.priceAmount).toMatch(
      /\$8\.00/
    );
    expect(plan!.priceCycle).toContain(
      'Quarterly'
    );
  });

  it('reads stock qty', () => {
    const available = packages.find(
      (p) =>
        p.name ===
        'VPS-2048-KVM-JP'
    );
    const soldOut = packages.find(
      (p) =>
        p.name === 'VPS-512-KVM-JP'
    );

    expect(available!.qtyText).toMatch(
      /10/
    );
    expect(soldOut!.qtyText).toMatch(
      /0/
    );
  });

  it('builds absolute order url', () => {
    const plan = packages.find(
      (p) =>
        p.name ===
        'VPS-2048-KVM-JP'
    );

    expect(plan!.orderUrl).toBe(
      'https://bytevirt.com/store/vps-jp-kvm/vps-2048-kvm-jp'
    );
  });
});

describe('parseConfProduct', () => {
  const html = readFixture(
    'bytevirt-checkout.html'
  );

  const conf =
    parseConfProduct(
      html,
      testConfig
    );

  it('parses billing cycles with prices', () => {
    const cycles =
      conf.cycles.map((c) => c.value);

    expect(cycles).toContain(
      'quarterly'
    );
    expect(cycles).toContain(
      'annually'
    );

    const annual =
      conf.cycles.find(
        (c) => c.value === 'annually'
      );

    expect(annual!.price).toBe(
      '$28.88'
    );
  });

  it('parses location options', () => {
    expect(
      conf.locationOptions
    ).toContain(
      'DC1(Tokyo, JP)'
    );
    expect(
      conf.locationOptions
    ).toContain(
      'DC2(Osaka, JP)'
    );
  });

  it('keeps product config text', () => {
    expect(conf.configText).toContain(
      '2 Core(s)'
    );
    expect(conf.configText).toContain(
      '2048MB'
    );
  });
});

describe('generic parsers', () => {
  it('parseCpu', () => {
    expect(
      parseCpu('2 Core(s) (Fair Share)')
    ).toBe(2);
    expect(
      parseCpu('8 vCPU')
    ).toBe(8);
    expect(
      parseCpu('High performance CPU')
    ).toBeNull();
  });

  it('parseRamMb', () => {
    expect(
      parseRamMb('2048MB RAM')
    ).toBe(2048);
    expect(
      parseRamMb('2 GB RAM')
    ).toBe(2048);
    expect(
      parseRamMb('no ram listed')
    ).toBeNull();
  });

  it('parseStorageGb', () => {
    expect(
      parseStorageGb('15GB NVME RAID1')
    ).toBe(15);
    expect(
      parseStorageGb('1TB NVMe')
    ).toBe(1024);
  });

  it('detectStorageType', () => {
    expect(
      detectStorageType('NVME RAID1')
    ).toBe('NVMe');
    expect(
      detectStorageType('20 GB SSD')
    ).toBe('SSD');
    expect(
      detectStorageType('Enterprise SSD')
    ).toBe('Enterprise SSD');
    expect(
      detectStorageType('20 GB HDD')
    ).toBe('unknown');
  });

  it('detectDedicatedIpv4 keeps 1 IPv4', () => {
    const result = detectDedicatedIpv4(
      '1 IPv4 Addresses'
    );

    expect(result.dedicated).toBe(
      true
    );
    expect(result.status).toBe(
      'confirmed'
    );
    expect(result.count).toBe(1);
  });

  it('detectDedicatedIpv4 counts multiple', () => {
    const result = detectDedicatedIpv4(
      '2 IPv4 Addresses'
    );

    expect(result.dedicated).toBe(
      true
    );
    expect(result.count).toBe(2);
  });

  it('detectDedicatedIpv4 excludes NAT', () => {
    const result = detectDedicatedIpv4(
      'NAT IPv4 (20 ports)'
    );

    expect(result.dedicated).toBe(false);
    expect(result.status).toBe(
      'confirmed'
    );
  });

  it('parseBillingPeriod', () => {
    expect(
      parseBillingPeriod('Annually')
    ).toBe('annual');
    expect(
      parseBillingPeriod('Quarterly')
    ).toBe('quarterly');
    expect(
      parseBillingPeriod('Semiannual')
    ).toBe('semiannual');
    expect(
      parseBillingPeriod('Monthly')
    ).toBe('monthly');
  });

  it('parsePriceUsd', () => {
    expect(
      parsePriceUsd('$28.88 USD')
    ).toBe(28.88);
    expect(
      parsePriceUsd('$8.00')
    ).toBe(8);
    expect(
      parsePriceUsd('free')
    ).toBeNull();
  });
});