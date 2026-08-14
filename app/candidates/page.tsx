import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession, getServerClient } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

interface DiscoveryRow {
  source: string;
  source_url: string;
  title: string;
  provider_name: string | null;
  detected_price: string | null;
  official_urls: string[] | null;
  processed: boolean;
  created_at: string;
}

interface AutoProviderRow {
  slug: string;
  name: string;
  base_url: string;
  enabled: boolean;
  first_seen_at: string;
}

export default async function CandidatesPage() {
  const session =
    await getServerSession();

  if (!session) {
    redirect('/auth');
  }

  const supabase =
    await getServerClient();

  if (!supabase) {
    return (
      <p className="text-sm text-zinc-500">
        Supabase not configured
      </p>
    );
  }

  const { data, error } =
    await supabase
      .from('discovery_items')
      .select(
        'source, source_url, title, provider_name, detected_price, official_urls, processed, created_at'
      )
      .order('created_at', {
        ascending: false
      })
      .limit(50);

  const { data: autoData } =
    await supabase
      .from('auto_providers')
      .select(
        'slug, name, base_url, enabled, first_seen_at'
      )
      .eq('enabled', true)
      .order('name');

  const items =
    (data as unknown as DiscoveryRow[]) ??
    [];

  const autoProviders =
    (autoData as unknown as AutoProviderRow[]) ??
    [];

  const pendingItems = items.filter(
    (item) => !item.processed
  );

  const linkedItems = items.filter(
    (item) => item.processed
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            供应商发现与监控状态
          </h1>
          <p className="text-sm text-zinc-500">
            自动发现的供应商会先检查 WHMCS 兼容性，再加入监控。
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/"
            className="text-zinc-500 hover:underline"
          >
            ← 返回
          </Link>
          {session.role === 'admin' && (
            <Link
              href="/admin"
              className="text-zinc-500 hover:underline"
            >
              管理员
            </Link>
          )}
        </div>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          {error.message}
        </p>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            已自动加入监控（{autoProviders.length}）
          </h2>
          <span className="text-xs text-zinc-400">
            标准 WHMCS 商品页
          </span>
        </div>
        {autoProviders.length === 0 ? (
          <p className="rounded border border-zinc-200 p-4 text-sm text-zinc-500">
            当前没有自动加入的供应商。下一次论坛扫描发现可解析的 WHMCS VPS 商品页后会自动加入。
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {autoProviders.map((provider) => (
              <li
                key={provider.slug}
                className="rounded border border-green-200 bg-green-50 p-3"
              >
                <div className="font-medium text-green-900">
                  {provider.name}
                </div>
                <a
                  href={provider.base_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:underline"
                >
                  {provider.base_url} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            发现但尚未加入（{pendingItems.length}）
          </h2>
          <span className="text-xs text-zinc-400">
            非 WHMCS / Cloudflare / 自定义页面需专用 Adapter
          </span>
        </div>
        {pendingItems.length === 0 ? (
          <p className="rounded border border-zinc-200 p-4 text-sm text-zinc-500">
            暂无尚未加入的线索。
          </p>
        ) : (
        <ul className="flex flex-col gap-3">
          {pendingItems.map((item) => (
            <li
              key={item.source_url}
              className="rounded border border-zinc-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {item.provider_name ?? '未知供应商'}
                    {item.detected_price && (
                      <span className="ml-2 font-semibold text-zinc-700">
                        {item.detected_price}
                      </span>
                    )}
                    <span className="ml-2 text-zinc-400">
                      · {item.source}
                    </span>
                    <span className="ml-2">
                      <span className="text-amber-600">
                        尚未自动加入
                      </span>
                    </span>
                  </div>
                </div>
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-zinc-500 hover:underline"
                >
                  原帖 ↗
                </a>
              </div>

              {(item.official_urls?.length ??
                0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.official_urls!.map(
                    (url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
                      >
                        {new URL(url).host}
                      </a>
                    )
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        )}
      </section>

      {linkedItems.length > 0 && (
        <p className="mt-6 text-xs text-zinc-400">
          另有 {linkedItems.length} 条线索已关联现有固定 Adapter。
        </p>
      )}
    </main>
  );
}
