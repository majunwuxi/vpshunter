import { RULES } from '@/config/rules';
import type {
  Evaluation,
  VpsOffer
} from '@/monitors/types';

const ALLOWED_TYPES = RULES.allowedStorageTypes.map(
  (type) => type.toUpperCase()
);

export function evaluateOffer(
  offer: VpsOffer
): Evaluation {
  const reasons: string[] = [];

  if (offer.cpu < RULES.hardware.minVcpu) {
    reasons.push('CPU below minimum');
  }

  if (offer.ramMb < RULES.hardware.minRamMb) {
    reasons.push('RAM below minimum');
  }

  if (
    offer.storageGb <
    RULES.hardware.minStorageGb
  ) {
    reasons.push('Storage below minimum');
  }

  if (!offer.dedicatedIpv4) {
    reasons.push('No dedicated IPv4');
  }

  if (offer.ipv4Count < 1) {
    reasons.push('IPv4 count below minimum');
  }

  const type = offer.storageType.toUpperCase();

  const solidState =
    ALLOWED_TYPES.some((allowed) =>
      type.includes(allowed)
    );

  if (!solidState) {
    reasons.push(
      'Storage is not SSD/NVMe'
    );
  }

  if (!offer.available) {
    reasons.push('Out of stock');
  }

  if (offer.verificationLevel !== 'A') {
    reasons.push(
      'Checkout not fully verified'
    );
  }

  if (reasons.length > 0) {
    return {
      qualified: false,
      reasons
    };
  }

  const maxStandard =
    RULES.pricing.standardMaxUsdYear;

  if (
    offer.priceUsdYear >=
      maxStandard - RULES.priceBufferUsd &&
    offer.priceUsdYear < maxStandard
  ) {
    reasons.push(
      'Near price limit, tax/fee risk'
    );
  }

  if (
    offer.priceUsdYear < maxStandard
  ) {
    return {
      qualified: true,
      tier: 'standard',
      reasons: [...reasons]
    };
  }

  if (
    offer.rdnsStatus === 'confirmed' &&
    offer.priceUsdYear <
      RULES.pricing.rdnsMaxUsdYear
  ) {
    return {
      qualified: true,
      tier: 'rdns',
      reasons: [...reasons]
    };
  }

  return {
    qualified: false,
    reasons:
      reasons.length > 0
        ? reasons
        : ['Price exceeds allowed tier']
  };
}