import type {
  RdnsStatus,
  Port25Policy
} from '@/monitors/types';

const MCUPS = new Set([
  1, 2, 4, 8, 16, 24, 32, 48, 64
]);

export function parseCpu(
  text: string
): number | null {
  const match =
    text.match(
      /(\d+)\s*x?\s*(?:Core|Core\(s\)|vCore|vCPU|vCPU\(s\)|Cores)/i
    );

  if (!match) return null;

  const value = Number(
    match[1]
  );

  if (value <= 0) return null;

  return value;
}

export function parseRamMb(
  text: string
): number | null {
  const match =
    text.match(
      /(\d+(?:\.\d+)?)\s*(GB|MB|GiB|MiB)\b/i
    );

  if (!match) return null;

  const value = Number(
    match[1]
  );

  const unit =
    match[2].toUpperCase();

  if (value <= 0) return null;

  if (unit.startsWith('G')) {
    return Math.round(value * 1024);
  }

  return Math.round(value);
}

export function parseStorageGb(
  text: string
): number | null {
  const storageContext =
    text.match(
      /(\d+(?:\.\d+)?)\s*(GB|TB|GiB|TiB)\b\s*(?:NVME|SSD|RAID|DISK|HDD|NVMe|disk|storage)/i
    );

  const match =
    storageContext ??
    text.match(
      /(\d+(?:\.\d+)?)\s*(GB|TB|GiB|TiB)\b/i
    );

  if (!match) return null;

  const value = Number(
    match[1]
  );

  const unit =
    match[2].toUpperCase();

  if (value <= 0) return null;

  if (unit.startsWith('T')) {
    return value * 1024;
  }

  return value;
}

export function detectStorageType(
  text: string
): string {
  const upper = text.toUpperCase();

  if (
    upper.includes('NVME')
  ) {
    return 'NVMe';
  }

  if (
    upper.includes('SSD')
  ) {
    return upper.includes(
      'ENTERPRISE'
    )
      ? 'Enterprise SSD'
      : 'SSD';
  }

  return 'unknown';
}

export function detectDedicatedIpv4(
  text: string
): {
  dedicated: boolean;
  count: number;
  status: 'confirmed' | 'unknown';
} {
  const upper = text.toUpperCase();

  const natSignals = [
    'NAT IPv4',
    'NAT IPV4',
    'SHARED IPV4',
    'PORT MAPPING',
    'IPV4 NAT',
    'PORT FORWARD'
  ];

  const nat =
    natSignals.some((signal) =>
      upper.includes(signal)
    );

  if (nat) {
    return {
      dedicated: false,
      count: 0,
      status: 'confirmed'
    };
  }

  const countMatch =
    upper.match(
      /(\d+)\s*x?\s*(?:DEDICATED\s+)?IPV4\b/i
    );

  if (!countMatch) {
    if (
      /IPV4\s+INCLUDED/.test(
        upper
      )
    ) {
      return {
        dedicated: true,
        count: 1,
        status: 'confirmed'
      };
    }

    return {
      dedicated: false,
      count: 0,
      status: 'unknown'
    };
  }

  const count =
    Number(countMatch[1] ?? 1);

  const dedicated =
    /DEDICATED|PUBLIC|ADDRESS(?:ES)?|INCLUDED/.test(
      upper
    );

  return {
    dedicated,
    count,
    status: 'confirmed'
  };
}

export function parsePriceUsd(
  text: string
): number | null {
  const match = text.match(
    /\$?\s*([\d,]+(?:\.\d{1,2})?)\s*(USD)?/i
  );

  if (!match) return null;

  const value = Number(
    match[1].replace(/,/g, '')
  );

  if (value <= 0) return null;

  return value;
}

export function parseBillingPeriod(
  text: string
): 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null {
  const lower = text.toLowerCase();

  if (lower.includes('半年') || lower.includes('semiannual') || lower.includes('6 month')) {
    return 'semiannual';
  }

  if (lower.includes('每年') || lower.includes('year') || lower.includes('annual')) {
    return 'annual';
  }

  if (lower.includes('每季') || lower.includes('quarter')) {
    return 'quarterly';
  }

  if (lower.includes('月') || lower.includes('month')) {
    return 'monthly';
  }

  return null;
}

export function parseRdnsStatus(
  text: string
): RdnsStatus {
  const upper = text.toUpperCase();

  if (
    upper.includes('RDNS') ||
    upper.includes('PTR') ||
    upper.includes('REVERSE DNS')
  ) {
    if (
      upper.includes('UNSUPPORTED') ||
      upper.includes('NOT SUPPORTED') ||
      upper.includes('NO RDNS')
    ) {
      return 'unsupported';
    }

    return 'confirmed';
  }

  return 'unknown';
}

export function parseSmtp25(
  text: string
): Port25Policy {
  const upper = text.toUpperCase();

  if (upper.includes('SMTP')) {
    if (
      upper.includes('BLOCK') ||
      upper.includes('CLOSED')
    ) {
      return 'blocked';
    }

    if (
      upper.includes('OPEN')
    ) {
      return 'open';
    }

    if (
      upper.includes('UNBLOCK') ||
      upper.includes('REQUEST')
    ) {
      return 'request-unblock';
    }

    return 'restricted';
  }

  return 'unknown';
}

export function isNumeric(
  value: number
): boolean {
  return Number.isFinite(value) && value > 0;
}

export const VALID_CPU = MCUPS;