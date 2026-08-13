import crypto from 'crypto';

export function createOfferHash(
  data: object
): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(data)
    )
    .digest('hex');
}

export function offerNotificationPayload(
  offer: {
    provider: string;
    planName: string;
    countryCode: string;
    city?: string;
    priceUsdYear: number;
    cpu: number;
    ramMb: number;
    storageGb: number;
  }
) {
  return {
    provider: offer.provider,
    plan: offer.planName,
    location: [
      offer.city ?? '',
      offer.countryCode
    ]
      .filter(Boolean)
      .join('-')
      .toLowerCase(),
    priceUsdYear: offer.priceUsdYear,
    cpu: offer.cpu,
    ramMb: offer.ramMb,
    storageGb: offer.storageGb
  };
}