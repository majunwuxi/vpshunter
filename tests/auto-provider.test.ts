import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isWhmcsStoreHtml } from '@/lib/discovery/auto-provider';

const fixture = fs.readFileSync(
  path.join(
    process.cwd(),
    'tests',
    'fixtures',
    'whmcs-store-cards.html'
  ),
  'utf8'
);

describe('isWhmcsStoreHtml', () => {
  it('accepts a WHMCS card store', () => {
    expect(isWhmcsStoreHtml(fixture)).toBe(
      true
    );
  });

  it('rejects a marketing page with no product cards', () => {
    const html = `
      <html>
        <a href="/cart.php?a=add&pid=1">Order</a>
        <a href="/clientarea.php">Client</a>
        <p>Welcome to our hosting company</p>
      </html>
    `;

    expect(isWhmcsStoreHtml(html)).toBe(
      false
    );
  });

  it('rejects a page with product cards but no whmcs links', () => {
    const html = `
      <div class="package">
        <h3>Plan</h3>
      </div>
    `;

    expect(isWhmcsStoreHtml(html)).toBe(
      false
    );
  });

  it('rejects empty page', () => {
    expect(isWhmcsStoreHtml('')).toBe(false);
  });
});