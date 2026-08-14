import { getServerSession, getServerClient } from '@/lib/db/server';
import {
  loadRules,
  updateRules
} from '@/lib/rules/rules-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session =
    await getServerSession();

  if (
    !session ||
    session.role !== 'admin'
  ) {
    return Response.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const current =
    await loadRules(
      await getServerClient()
    );

  return Response.json({
    rules: {
      preferredRegions:
        current.preferredRegions,
      minVcpu:
        current.hardware.minVcpu,
      minRamMb:
        current.hardware.minRamMb,
      minStorageGb:
        current.hardware.minStorageGb,
      requireSolidState:
        current.hardware.requireSolidState,
      requireDedicatedIpv4:
        current.hardware.requireDedicatedIpv4,
      standardMaxUsdYear:
        current.pricing.standardMaxUsdYear,
      rdnsMaxUsdYear:
        current.pricing.rdnsMaxUsdYear,
      priceBufferUsd:
        current.priceBufferUsd
    }
  });
}

export async function POST(
  request: Request
) {
  const session =
    await getServerSession();

  if (
    !session ||
    session.role !== 'admin'
  ) {
    return Response.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const body =
    (await request.json()) as {
      preferredRegions?: string[];
      minVcpu?: number;
      minRamMb?: number;
      minStorageGb?: number;
      requireSolidState?: boolean;
      requireDedicatedIpv4?: boolean;
      standardMaxUsdYear?: number;
      rdnsMaxUsdYear?: number;
      priceBufferUsd?: number;
    };

  const result =
    await updateRules(body);

  if (result.error) {
    return Response.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return Response.json({
    rules: {
      preferredRegions:
        result.rules.preferredRegions,
      minVcpu:
        result.rules.hardware.minVcpu,
      minRamMb:
        result.rules.hardware.minRamMb,
      minStorageGb:
        result.rules.hardware.minStorageGb,
      requireSolidState:
        result.rules.hardware.requireSolidState,
      requireDedicatedIpv4:
        result.rules.hardware.requireDedicatedIpv4,
      standardMaxUsdYear:
        result.rules.pricing.standardMaxUsdYear,
      rdnsMaxUsdYear:
        result.rules.pricing.rdnsMaxUsdYear,
      priceBufferUsd:
        result.rules.priceBufferUsd
    }
  });
}