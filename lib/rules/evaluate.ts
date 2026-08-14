import type {
  Evaluation,
  VpsOffer
} from '@/monitors/types';
import {
  defaultRules,
  type MonitorRules
} from '@/lib/rules/types';

const STATIC_ALLOWED_TYPES = [
  'SSD',
  'NVME',
  'NVME SSD',
  'ENTERPRISE SSD'
].map((type) => type.toUpperCase());

export function evaluateOffer(
  offer: VpsOffer,
  rules?: MonitorRules
): Evaluation {
  const active =
    rules ?? defaultRules();

  const reasons: string[] = [];

  if (
    offer.cpu <
    active.hardware.minVcpu
  ) {
    reasons.push('CPU below minimum');
  }

  if (
    offer.ramMb <
    active.hardware.minRamMb
  ) {
    reasons.push('RAM below minimum');
  }

  if (
    offer.storageGb <
    active.hardware.minStorageGb
  ) {
    reasons.push(
      'Storage below minimum'
    );
  }

  if (
    active.hardware.requireDedicatedIpv4 &&
    !offer.dedicatedIpv4
  ) {
    reasons.push(
      'No dedicated IPv4'
    );
  }

  if (offer.ipv4Count < 1) {
    reasons.push(
      'IPv4 count below minimum'
    );
  }

  const type =
    offer.storageType.toUpperCase();

  const solidState =
    STATIC_ALLOWED_TYPES.some(
      (allowed) =>
        type.includes(allowed)
    );

  if (
    active.hardware.requireSolidState &&
    !solidState
  ) {
    reasons.push(
      'Storage is not SSD/NVMe'
    );
  }

  if (!offer.available) {
    reasons.push('Out of stock');
  }

  if (
    offer.verificationLevel !== 'A'
  ) {
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
    active.pricing.standardMaxUsdYear;

  if (
    offer.priceUsdYear >=
      maxStandard -
        active.priceBufferUsd &&
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
      active.pricing.rdnsMaxUsdYear
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
        : [
            'Price exceeds allowed tier'
          ]
  };
}

export { defaultRules };