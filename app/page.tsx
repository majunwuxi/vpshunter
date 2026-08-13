import { getSupabaseAnon } from '@/lib/db/supabase';
import { RULES } from '@/config/rules';
import { PlanCard, type PlanRow } from '@/components/PlanCard';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

const REGION_ORDER: readonly string[] =
  RULES.preferredRegions;

interface MonitorRunRow {
  started_at: string;
  finished_at: string | null;
  providers_checked: number | null;
  offers_found: number | null;
  offers_qualified: number | null;
  notifications_sent: number | null;
  status: string | null;
}

export default async function Home() {
  let rows: PlanRow[] = [];
  let error: string | null = null;
  let monitorRun: MonitorRunRow | null =
    null;

  const client = getSupabaseAnon();

  if (!client) {
    error = 'Supabase not configured';
  } else {
    try {
      const { data, error: dbError } =
        await client
        .from('plans')
        .select(
          `
            provider_name:providers(name),
            name,
            location,
            cpu,
            ram_mb,
            storage_gb,
            storage_type,
            ipv4_count,
            price_usd_year,
            rdns_supported,
            verification_level,
            last_verified_at
          `
        )
        .eq('available', true)
        .order('price_usd_year', {
          ascending: true
        });

      if (dbError) {
        throw dbError;
      }

      rows =
        (data as unknown as PlanRow[]) ??
        [];

      const {
        data: runData,
        error: runError
      } = await client
        .from('monitor_runs')
        .select(
          'started_at, finished_at, providers_checked, offers_found, offers_qualified, notifications_sent, status'
        )
        .order('started_at', {
          ascending: false
        })
        .limit(1)
        .maybeSingle();

      if (
        !runError &&
        runData
      ) {
        monitorRun =
          runData as unknown as MonitorRunRow;
      }
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : String(err);
    }
  }

  const monitorOffline =
    monitorRun &&
    Date.now() -
      new Date(
        monitorRun.started_at
      ).getTime() >
      2 * 60 * 60 * 1000;

  const regionRank = (plan: PlanRow) => {
    const code =
      plan.location?.slice(0, 2).toUpperCase() ??
      '';

    const index =
      REGION_ORDER.indexOf(code);

    return index === -1
      ? REGION_ORDER.length
      : index;
  };

  const sorted = [...rows].sort(
    (a, b) => {
      const r =
        regionRank(a) - regionRank(b);

      if (r !== 0) return r;

      return (
        (a.price_usd_year ?? 0) -
        (b.price_usd_year ?? 0)
      );
    }
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">
          VPS Hunter
        </h1>
        <p className="text-sm text-zinc-500">
          Reliable low-cost VPS monitoring with
          checkout verification
        </p>
      </header>

      {monitorRun && (
        <div
          className={`mb-6 rounded border px-4 py-3 text-sm ${
            monitorOffline
              ? 'border-red-200 bg-red-50 text-red-800'
              : monitorRun.status === 'failed'
                ? 'border-orange-200 bg-orange-50 text-orange-800'
                : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {monitorOffline ? (
            <span className="font-semibold">
              ⚠ Monitor Offline
            </span>
          ) : monitorRun.status ===
            'failed' ? (
            <span className="font-semibold">
              ⚠ Last monitor failed
            </span>
          ) : (
            <span className="font-semibold">
              ✓ Monitor Running
            </span>
          )}{' '}
          · Last run{' '}
          {formatDistanceToNow(
            new Date(
              monitorRun.started_at
            ),
            { addSuffix: true }
          )}
          {monitorRun.finished_at && (
            <>
              {' '}
              · Providers{' '}
              {monitorRun.providers_checked ??
                0}
              · Offers{' '}
              {monitorRun.offers_found ?? 0}
              · Qualified{' '}
              {monitorRun.offers_qualified ??
                0}
            </>
          )}
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-600">
          Database not reachable: {error}
        </p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No available plans yet. The monitor
          has not written any results.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((plan) => (
            <PlanCard
              key={
                `${plan.provider_name}-${plan.name}-${plan.location}`
              }
              plan={plan}
            />
          ))}
        </div>
      )}
    </main>
  );
}