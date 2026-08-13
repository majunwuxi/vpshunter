import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parsePackages,
  parseConfProduct,
  type WhmcsProviderConfig
} from '@/lib/crawler/whmcs';
import { parseTableList } from '@/monitors/providers/racknerd';

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

const testConfig: WhmcsProviderConfig = {
  slug: 'test',
  name: 'Test',
  enabled: true,
  baseUrl: 'https://example.com',
  categories: ['/store'],
  locationConfigOptionIds: ['63'],
  matchCountry: () => null,
  resolveCity: () => ''
};

describe('parsePackages (HostUS-style cards)', () => {
  const html = readFixture(
    'hostus-product.html'
  );

  const packages = parsePackages(
    html,
    'https://my.hostus.us'
  );

  it('extracts two packages', () => {
    expect(packages.length).toBe(2);
  });

  it('parses KVM-2 content', () => {
    const plan = packages.find(
      (p) => p.name === 'KVM-2'
    );

    expect(plan).toBeDefined();
    expect(plan!.contentText).toContain(
      '2GB RAM'
    );
    expect(plan!.contentText).toContain(
      '60GB SSD'
    );
    expect(plan!.contentText).toContain(
      '2 vCPU Cores'
    );
    expect(plan!.contentText).toContain(
      '1x IPv4 address'
    );
  });

  it('builds absolute order url', () => {
    const plan = packages.find(
      (p) => p.name === 'KVM-2'
    );

    expect(plan!.orderUrl).toBe(
      'https://my.hostus.us/index.php/store/ssd-kvm-vps/kvm-2-1'
    );
  });
});

describe('parseTableList (RackNerd-style)', () => {
  const html = readFixture(
    'racknerd-product.html'
  );

  const cards = parseTableList(
    html,
    'https://www.racknerd.com'
  );

  it('parses both rows', () => {
    expect(cards.length).toBe(2);
  });

  it('parses 1 GB plan', () => {
    const plan = cards.find((c) =>
      c.contentText.includes('1 GB')
    );

    expect(plan).toBeDefined();
    expect(plan!.contentText).toContain(
      '2 vCore'
    );
    expect(plan!.contentText).toContain(
      '50 GB'
    );
    expect(plan!.orderUrl).toBe(
      'https://my.racknerd.com/cart.php?a=add&pid=20'
    );
  });

  it('keeps price text', () => {
    const plan = cards.find((c) =>
      c.contentText.includes('1 GB')
    );

    expect(plan!.priceAmount).toContain(
      '$17.99'
    );
  });
});

describe('parseConfProduct cycles', () => {
  const html = readFixture(
    'bytevirt-checkout.html'
  );

  const conf = parseConfProduct(
    html,
    testConfig
  );

  it('parses annual cycle', () => {
    const annual = conf.cycles.find(
      (c) => c.value === 'annually'
    );

    expect(annual).toBeDefined();
    expect(annual!.price).toBe('$28.88');
  });

  it('parses location options', () => {
    expect(
      conf.locationOptions
    ).toContain('DC1(Tokyo, JP)');
  });
});