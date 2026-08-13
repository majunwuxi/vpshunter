import type { VpsOffer } from '@/monitors/types';
import { sendAlert } from '@/lib/notifications/email';

const sampleOffer: VpsOffer = {
  provider: 'ExampleHost',
  planName: 'Starter NVMe',
  countryCode: 'JP',
  city: 'Tokyo',
  cpu: 2,
  ramMb: 2048,
  storageGb: 30,
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

async function main() {
  await sendAlert(sampleOffer);

  console.log(
    'Test notification sent (dry run?)',
    process.env.DRY_RUN === 'true'
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exitCode = 1;
});