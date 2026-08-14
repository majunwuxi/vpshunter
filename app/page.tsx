import { redirect } from 'next/navigation';
import { PlanCard, type PlanRow } from '@/components/PlanCard';
import { formatDistanceToNow } from 'date-fns';
import { getServerSession, getServerClient } from '@/lib/db/server';
import { loadRules } from '@/lib/rules/rules-store';
import { planMatchesRules } from '@/lib/rules/filter';

export const dynamic = 'force-dynamic';

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
  const session =
    await getServerSession();

  if (!session) {
    redirect('/auth');
  }

  const supabase =
    await getServerClient();

  let rows: PlanRow[] = [];
  let error: string | null = null;
  let monitorRun: MonitorRunRow | null =
    null;
  let hiddenCount = 0;
  let regionOrder: string[] = [];

  if (!supabase) {
    error = 'Supabase not configured';
  } else if (session.role === 'pending') {
    error =
      '你的账号正在等待管理员审批。';
  } else {
    try {
      const rules =
        await loadRules(supabase);

      regionOrder =
        rules.preferredRegions;

      const { data, error: dbError } =
        await supabase
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
            dedicated_ipv4,
            price_usd_year,
            rdns_supported,
            verification_level,
            last_verified_at,
            available
          `
        )
        .eq('available', true)
        .order('price_usd_year', {
          ascending: true
        });

      if (dbError) {
        throw dbError;
      }

      const all =
        (data as unknown as PlanRow[]) ??
        [];

      // Only show plans that match the active rules; hide the rest.
      rows = all.filter((plan) => {
        const { matches } =
          planMatchesRules(
            plan as unknown as import('@/lib/rules/filter').PlanFilterRow,
            rules
          );

        if (!matches) {
          hiddenCount += 1;
        }

        return matches;
      });

      const {
        data: runData,
        error: runError
      } = await supabase
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
      regionOrder.indexOf(code);

    return index === -1
      ? regionOrder.length
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
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            VPS Hunter
          </h1>
          <p className="text-sm text-zinc-500">
            Reliable low-cost VPS monitoring with
            checkout verification
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">
            {session.email}
            {session.role === 'admin' && (
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                admin
              </span>
            )}
          </span>
          {session.role === 'admin' && (
            <a
              href="/admin"
              className="text-zinc-500 hover:underline"
            >
              审批
            </a>
          )}
          <a
            href="/auth?out=1"
            className="text-zinc-500 hover:underline"
          >
            退出
          </a>
        </div>
      </header>

      {monitorRun && session.role !== 'pending' && (
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
        <p className="text-sm text-zinc-500">
          {error}
        </p>
      ) : sorted.length === 0 ? (
        <div>
          <p className="text-sm text-zinc-500">
            当前没有符合规则的套餐。
          </p>
          {hiddenCount > 0 && (
            <p className="mt-1 text-xs text-zinc-400">
              已屏蔽 {hiddenCount} 个不符合条件的套餐
            </p>
          )}
        </div>
      ) : (
        <div>
          {hiddenCount > 0 && (
            <p className="mb-3 text-xs text-zinc-400">
              已屏蔽 {hiddenCount} 个不符合条件的套餐，仅显示符合规则的
              {sorted.length} 个
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((plan) => (
              <PlanCard
                key={
                  `${plan.provider_name?.name}-${plan.name}-${plan.location}`
                }
                plan={plan}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}