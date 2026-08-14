import { VerificationBadge } from '@/components/VerificationBadge';
import { formatDistanceToNow } from 'date-fns';

export interface PlanRow {
  provider_name: { name: string } | null;
  name: string;
  location: string | null;
  cpu: number | null;
  ram_mb: number | null;
  storage_gb: number | null;
  storage_type: string | null;
  ipv4_count: number | null;
  dedicated_ipv4: boolean | null;
  price_usd_year: number | null;
  rdns_supported: boolean | null;
  verification_level: string | null;
  last_verified_at: string | null;
  available: boolean | null;
}

export function PlanCard({
  plan
}: {
  plan: PlanRow;
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {plan.provider_name?.name ??
              'Unknown'}
          </div>
          <div className="text-sm text-zinc-500">
            {plan.name}
          </div>
        </div>
        <VerificationBadge
          level={
            plan.verification_level ??
            'C'
          }
        />
      </div>

      <div className="text-xs text-zinc-500">
        {plan.location ?? 'Unknown region'}
      </div>

      <div className="grid grid-cols-2 gap-1 text-sm">
        <span>
          CPU:{' '}
          {plan.cpu ?? '?'} vCPU
        </span>
        <span>
          RAM:{' '}
          {plan.ram_mb
            ? plan.ram_mb / 1024
            : '?'}{' '}
          GB
        </span>
        <span>
          Storage:{' '}
          {plan.storage_gb ?? '?'} GB
        </span>
        <span>
          {plan.storage_type ??
            'Unknown type'}
        </span>
        <span>
          IPv4:{' '}
          {plan.ipv4_count ?? 0}
        </span>
        <span>
          PTR:{' '}
          {plan.rdns_supported
            ? 'Supported'
            : 'Unknown'}
        </span>
      </div>

      <div className="mt-auto pt-2 text-xl font-bold">
        $
        {plan.price_usd_year ??
          '?'}
        <span className="text-sm font-normal text-zinc-500">
          /year
        </span>
      </div>

      <div className="text-xs text-zinc-400">
        {plan.last_verified_at
          ? `Checked ${formatDistanceToNow(
              new Date(
                plan.last_verified_at
              ),
              { addSuffix: true }
            )}`
          : 'Never checked'}
      </div>
    </div>
  );
}