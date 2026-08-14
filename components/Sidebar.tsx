import Link from 'next/link';

export interface ProviderSidebarItem {
  name: string;
  planCount: number;
  hiddenCount: number;
}

export interface SidebarProps {
  providers: ProviderSidebarItem[];
  totalPlans: number;
  totalHidden: number;
  activeProvider: string | null;
}

export function Sidebar({
  providers,
  totalPlans,
  totalHidden,
  activeProvider
}: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 px-4 py-6">
      <div className="mb-4">
        <Link
          href="/"
          className="text-base font-bold text-zinc-900"
        >
          VPS Hunter
        </Link>
        <p className="text-xs text-zinc-400">
          监控面板
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        <Link
          href="/"
          className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
            activeProvider === null
              ? 'bg-zinc-100 font-medium'
              : 'text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          <span>全部供应商</span>
          <span className="text-xs text-zinc-400">
            {totalPlans}
          </span>
        </Link>

        {providers.map((p) => (
          <Link
            key={p.name}
            href={`/?provider=${encodeURIComponent(p.name)}`}
            className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
              activeProvider === p.name
                ? 'bg-zinc-100 font-medium'
                : 'text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <span className="truncate">
              {p.name}
            </span>
            <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-zinc-400">
              {p.hiddenCount > 0 && (
                <span className="text-zinc-300">
                  {p.hiddenCount}
                </span>
              )}
              <span>{p.planCount}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-400">
        <div className="mb-1 flex justify-between">
          <span>符合规则</span>
          <span>{totalPlans}</span>
        </div>
        <div className="flex justify-between">
          <span>已屏蔽</span>
          <span>{totalHidden}</span>
        </div>
      </div>
    </aside>
  );
}