import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseLowEndSpiritOffers } from '@/discovery/lowendspirit';
import {
  parseVanillaOffers,
  extractStartedAt,
  extractOfficialUrls
} from '@/discovery/vanilla';

const readFixture = (name: string) =>
  fs.readFileSync(
    path.join(
      process.cwd(),
      'tests',
      'fixtures',
      name
    ),
    'utf8'
  );

describe('parseLowEndSpiritOffers', () => {
  const items = parseLowEndSpiritOffers(
    readFixture('lowendspirit-offers.html')
  );

  it('parses three discussions', () => {
    expect(items.length).toBe(3);
  });

  it('extracts title and url', () => {
    const hostdare = items.find(
      (i) =>
        i.sourceUrl.includes(
          'hostdare-vps-sale'
        )
    );

    expect(hostdare).toBeDefined();
    expect(hostdare!.title).toContain(
      'HostDare VPS Sale'
    );
    expect(
      hostdare!.sourceUrl
    ).toContain(
      'lowendspirit.com/discussion/'
    );
  });

  it('extracts provider from author', () => {
    const hostdare = items.find(
      (i) =>
        i.sourceUrl.includes(
          'hostdare-vps-sale'
        )
    );

    expect(hostdare!.providerName).toBe(
      'hostdare'
    );
  });

  it('detects price in title', () => {
    const crowncloud = items.find(
      (i) =>
        i.sourceUrl.includes(
          'crowncloud'
        )
    );

    expect(crowncloud).toBeDefined();
    expect(crowncloud!.detectedPrice).toMatch(
      /\$7/
    );
  });

  it('marks non-price titles with no detected price', () => {
    const linveo = items.find(
      (i) =>
        i.sourceUrl.includes(
          'netbsd-current-fun'
        )
    );

    expect(linveo!.detectedPrice).toBeUndefined();
  });
});

describe('parseLowEndTalkOffers', () => {
  // Use the unfiltered parser for fixture data (fixture dates are fixed and
  // would go stale against the live 24h cutoff).
  const items = parseVanillaOffers(
    readFixture('lowendtalk-offers.html'),
    'lowendtalk'
  );

  it('parses three discussions', () => {
    expect(items.length).toBe(3);
  });

  it('uses lowendtalk source label', () => {
    expect(items[0].source).toBe(
      'lowendtalk'
    );
    expect(
      items[0].sourceUrl
    ).toContain(
      'lowendtalk.com/discussion/'
    );
  });

  it('extracts provider from author', () => {
    const smoky = items.find(
      (i) =>
        i.sourceUrl.includes(
          'smokyhosts'
        )
    );

    expect(smoky!.providerName).toBe(
      'SmokyHosts'
    );
  });

  it('detects price with currency prefix', () => {
    const hostvds = items.find(
      (i) =>
        i.sourceUrl.includes(
          'hostvds'
        )
    );

    expect(hostvds).toBeDefined();
    expect(hostvds!.detectedPrice).toMatch(
      /\$0\.99/
    );
  });
});

describe('parseVanillaOffers 24h filter', () => {
  const now = Date.now();
  const hoursAgo = (h: number) =>
    new Date(now - h * 3600 * 1000)
      .toISOString();

  const html = `
    <ul class="DataList Discussions">
      <li id="Discussion_1" class="Item ItemDiscussion">
        <div class="ItemContent Discussion">
          <div class="Title"><a href="https://lowendtalk.com/discussion/1/fresh-deal">Fresh Deal $10/year</a></div>
          <div class="Meta Meta-Discussion">
            <span class="MItem DiscussionAuthor"><a href="/profile/vendor">vendor</a></span>
            <span class="MItem LastCommentDate"><time datetime="${hoursAgo(1)}">1h ago</time></span>
          </div>
        </div>
      </li>
      <li id="Discussion_2" class="Item ItemDiscussion">
        <div class="ItemContent Discussion">
          <div class="Title"><a href="https://lowendtalk.com/discussion/2/old-deal">Old Deal $5</a></div>
          <div class="Meta Meta-Discussion">
            <span class="MItem DiscussionAuthor"><a href="/profile/vendor2">vendor2</a></span>
            <span class="MItem LastCommentDate"><time datetime="${hoursAgo(50)}">2d ago</time></span>
          </div>
        </div>
      </li>
    </ul>
  `;

  it('keeps items active within 24h and drops older ones', () => {
    const items = parseVanillaOffers(
      html,
      'lowendtalk',
      24
    );

    expect(items.length).toBe(1);
    expect(items[0].title).toContain(
      'Fresh Deal'
    );
  });

  it('parses lastActivityAt timestamp', () => {
    const items = parseVanillaOffers(
      html,
      'lowendtalk'
    );

    expect(items).toHaveLength(2);
    expect(
      items[0].lastActivityAt
    ).toBeDefined();
    expect(
      new Date(
        items[0].lastActivityAt!
      ).getTime()
    ).toBeGreaterThan(now - 3 * 3600 * 1000);
  });
});

describe('extractStartedAt', () => {
  it('reads dateCreated from Vanilla JSON-LD', () => {
    const html = `
      <script type="application/ld+json">
        {"headline":"Test Deal","dateCreated":"2026-08-13T04:10:00+00:00","@type":"DiscussionForumPosting"}
      </script>
    `;

    expect(extractStartedAt(html)).toBe(
      '2026-08-13T04:10:00+00:00'
    );
  });

  it('returns null when no dateCreated', () => {
    expect(
      extractStartedAt('<html><body>no date</body></html>')
    ).toBeNull();
  });
});

describe('extractOfficialUrls', () => {
  it('extracts provider product links, skips forum/social', () => {
    const html = `
      <html>
        <body>
          <a href="https://bill.hostdare.com/store/premium-japan-kvm-vps">Store</a>
          <a href="https://hostdare.com/promo.html">Promo</a>
          <a href="https://lowendspirit.com/discussion/1/x">Forum</a>
          <a href="https://twitter.com/hostdare">Social</a>
          <a href="https://cdn-cgi.foo/abc">CDN</a>
          <a href="https://discord.gg/abc">Discord</a>
          <img src="https://example.com/pic.png">
        </body>
      </html>
    `;

    const urls = extractOfficialUrls(html);

    expect(urls).toContain(
      'https://bill.hostdare.com/store/premium-japan-kvm-vps'
    );
    expect(urls).toContain(
      'https://hostdare.com/promo.html'
    );
    expect(urls).not.toContain(
      'https://lowendspirit.com/discussion/1/x'
    );
    expect(urls).not.toContain(
      'https://twitter.com/hostdare'
    );
    expect(urls.length).toBeLessThanOrEqual(
      5
    );
  });

  it('deduplicates same host+path', () => {
    const html = `
      <a href="https://a.com/store/x">1</a>
      <a href="https://a.com/store/x">2</a>
    `;

    const urls = extractOfficialUrls(html);

    expect(
      urls.filter(
        (u) =>
          u ===
          'https://a.com/store/x'
      )
    ).toHaveLength(1);
  });
});