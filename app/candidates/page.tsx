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

  const items =
    (data as unknown as DiscoveryRow[]) ??
    [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            待核验候选
          </h1>
          <p className="text-sm text-zinc-500">
            来自论坛线索、官网可核验的供应商（尚未加入监控）
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

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          暂无待核验候选。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
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
                      {item.processed ? (
                        <span className="text-green-600">
                          已关联
                        </span>
                      ) : (
                        <span className="text-amber-600">
                          待核验
                        </span>
                      )}
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
    </main>
  );
}