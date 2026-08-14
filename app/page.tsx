import { redirect } from 'next/navigation';
import { PlanCard, type PlanRow } from '@/components/PlanCard';
import { Sidebar, type ProviderSidebarItem } from '@/components/Sidebar';
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

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{
    provider?: string;
  }>;
}) {
  const { provider } =
    await searchParams;

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
  let providerAgg = new Map<
    string,
    { total: number; qualified: number }
  >();

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

      // Aggregate per-provider: total plans, qualified, hidden.
      providerAgg = new Map<
        string,
        { total: number; qualified: number }
      >();

      for (const plan of all) {
        const name =
          plan.provider_name?.name ??
          'Unknown';

        const agg =
          providerAgg.get(name) ?? {
            total: 0,
            qualified: 0
          };

        agg.total += 1;

        const { matches } =
          planMatchesRules(
            plan as unknown as import('@/lib/rules/filter').PlanFilterRow,
            rules
          );

        if (matches) {
          agg.qualified += 1;
        }

        providerAgg.set(name, agg);
      }

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

  // Sidebar provider list: total plans per provider + hidden count.
  const sidebarProviders: ProviderSidebarItem[] =
    [...providerAgg.entries()]
      .map(([name, agg]) => ({
        name,
        planCount: agg.total,
        hiddenCount:
          agg.total - agg.qualified
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

  // Apply the sidebar provider filter.
  const activeProvider =
    provider ??
    null;

  const visibleRows = activeProvider
    ? sorted.filter(
        (p) =>
          p.provider_name?.name ===
          activeProvider
      )
    : sorted;

  const providerCounts = new Map<
    string,
    number
  >();

  for (const plan of visibleRows) {
    const name =
      plan.provider_name?.name ??
      'Unknown';

    providerCounts.set(
      name,
      (providerCounts.get(name) ??
        0) + 1
    );
  }

  const regionCounts = new Map<
    string,
    number
  >();

  for (const plan of visibleRows) {
    const code =
      plan.location?.slice(0, 2).toUpperCase() ??
      '??';

    regionCounts.set(
      code,
      (regionCounts.get(code) ?? 0) + 1
    );
  }

  const cheapest =
    visibleRows.length > 0
      ? visibleRows.reduce((min, p) =>
          (p.price_usd_year ?? 0) <
          (min.price_usd_year ?? 0)
            ? p
            : min
        )
      : null;

  return (
    <div className="flex flex-1">
      <Sidebar
        providers={sidebarProviders}
        totalPlans={rows.length}
        totalHidden={hiddenCount}
        activeProvider={activeProvider}
      />
      <main className="min-w-0 flex-1 px-6 py-6">
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

      {session.role !== 'pending' &&
        !error && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-zinc-200 p-4">
              <div className="text-2xl font-bold">
                {visibleRows.length}
              </div>
              <div className="text-xs text-zinc-500">
                符合规则套餐
              </div>
            </div>
            <div className="rounded border border-zinc-200 p-4">
              <div className="text-2xl font-bold">
                {hiddenCount}
              </div>
              <div className="text-xs text-zinc-500">
                已屏蔽
              </div>
            </div>
            <div className="rounded border border-zinc-200 p-4">
              <div className="text-2xl font-bold">
                {providerCounts.size}
              </div>
              <div className="text-xs text-zinc-500">
                供应商
              </div>
            </div>
            <div className="rounded border border-zinc-200 p-4">
              <div className="text-2xl font-bold">
                {cheapest
                  ? `$${cheapest.price_usd_year}`
                  : '—'}
              </div>
              <div className="text-xs text-zinc-500">
                最低价/年
              </div>
            </div>
          </div>
        )}

      {session.role !== 'pending' &&
        !error &&
        (providerCounts.size > 0 ||
          regionCounts.size > 0) && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded border border-zinc-200 p-4">
              <h3 className="mb-2 text-sm font-semibold">
                按供应商
              </h3>
              <div className="flex flex-col gap-1 text-sm">
                {[
                  ...providerCounts.entries()
                ].map(([name, count]) => (
                  <div
                    key={name}
                    className="flex justify-between"
                  >
                    <span>
                      {name}
                    </span>
                    <span className="text-zinc-500">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-zinc-200 p-4">
              <h3 className="mb-2 text-sm font-semibold">
                按地区
              </h3>
              <div className="flex flex-col gap-1 text-sm">
                {[
                  ...regionCounts.entries()
                ].map(([code, count]) => (
                  <div
                    key={code}
                    className="flex justify-between"
                  >
                    <span>
                      {code}
                    </span>
                    <span className="text-zinc-500">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      {error ? (
        <p className="text-sm text-zinc-500">
          {error}
        </p>
      ) : visibleRows.length === 0 ? (
        <div>
          <p className="text-sm text-zinc-500">
            {activeProvider
              ? `供应商「${activeProvider}」暂无符合规则的套餐。`
              : '当前没有符合规则的套餐。'}
          </p>
          {hiddenCount > 0 && (
            <p className="mt-1 text-xs text-zinc-400">
              已屏蔽 {hiddenCount} 个不符合条件的套餐
            </p>
          )}
        </div>
      ) : (
        <div>
          {hiddenCount > 0 && !activeProvider && (
            <p className="mb-3 text-xs text-zinc-400">
              已屏蔽 {hiddenCount} 个不符合条件的套餐，仅显示符合规则的
              {visibleRows.length} 个
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleRows.map((plan) => (
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
    </div>
  );
}