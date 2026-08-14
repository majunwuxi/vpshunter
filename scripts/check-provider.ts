import { bytevirtMonitor } from '@/monitors/providers/bytevirt';
import { evaluateOffer } from '@/lib/rules/evaluate';
import { loadRules } from '@/lib/rules/rules-store';
import { normalizeOffer } from '@/lib/rules/normalize';
import { getExchangeRate } from '@/lib/utils/currency';

async function main() {
  const rules = await loadRules();

  const urls =
    await bytevirtMonitor.discover();

  console.log(
    'ByteVirt categories:',
    urls.length
  );

  for (const url of urls) {
    const offers =
      await bytevirtMonitor.verify(url);

    console.log('\n---', url);

    for (const offer of offers) {
      const rate =
        await getExchangeRate(
          offer.currency
        );

      const normalized =
        normalizeOffer(
          offer,
          rate.rate
        );

      const result =
        evaluateOffer(
          normalized,
          rules
        );

      console.log(
        [
          offer.planName,
          `${offer.countryCode}/${offer.city ?? '-'}`,
          `${offer.cpu} vCPU`,
          `${offer.ramMb}MB`,
          `${offer.storageGb}GB ${offer.storageType}`,
          `${offer.ipv4Count} IPv4${offer.dedicatedIpv4 ? ' ded' : ''}`,
          `$${normalized.priceUsdYear}/yr`,
          `stock ${offer.stock ?? 0}`,
          `v${offer.verificationLevel}`,
          result.qualified
            ? 'QUALIFIED'
            : `skip: ${result.reasons.join('; ')}`
        ].join(' | ')
      );
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : String(error)
  );

  process.exit(1);
});