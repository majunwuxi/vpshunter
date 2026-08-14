interface AdapterProgressItem {
  slug: string;
  name: string;
  status: string;
  progress: number;
  note: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  discovered: '已发现',
  analyzing: '分析中',
  parser_ready: 'Parser 完成',
  checkout_testing: 'Checkout 验证中',
  enabled: '已启用',
  blocked: '暂不可用'
};

export function AdapterProgress({
  items
}: {
  items: AdapterProgressItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-6 rounded border border-zinc-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          供应商适配进展
        </h2>
        <span className="text-xs text-zinc-400">
          Adapter Progress
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.slug}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium">
                {item.name}
              </span>
              <span className="text-zinc-500">
                {STATUS_LABELS[item.status] ?? item.status} · {item.progress}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-zinc-100">
              <div
                className={`h-full rounded ${item.status === 'blocked' ? 'bg-zinc-400' : item.status === 'enabled' ? 'bg-green-500' : 'bg-amber-400'}`}
                style={{ width: `${item.progress}%` }}
              />
            </div>
            {item.note && (
              <p className="mt-1 truncate text-[11px] text-zinc-400">
                {item.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
