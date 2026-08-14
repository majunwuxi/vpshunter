import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession, getServerClient } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

interface PendingRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default async function AdminPage() {
  const session =
    await getServerSession();

  if (!session) {
    redirect('/auth');
  }

  if (session.role !== 'admin') {
    redirect('/');
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
      .from('profiles')
      .select(
        'id, email, role, created_at'
      )
      .order('created_at', {
        ascending: true
      });

  const pending =
    ((data as unknown as PendingRow[]) ??
      []).filter(
      (p) => p.role === 'pending'
    );

  const members =
    ((data as unknown as PendingRow[]) ??
      []).filter(
      (p) => p.role !== 'pending'
    );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">
          管理员
        </h1>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← 返回
        </Link>
        <Link
          href="/admin/settings"
          className="ml-4 text-sm text-zinc-500 hover:underline"
        >
          监测规则设置
        </Link>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          {error.message}
        </p>
      )}

      <h2 className="mb-2 text-lg font-semibold">
        待审批（{pending.length}）
      </h2>

      {pending.length === 0 ? (
        <p className="mb-6 text-sm text-zinc-500">
          暂无待审批账号。
        </p>
      ) : (
        <ul className="mb-8 flex flex-col gap-2">
          {pending.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between rounded border border-zinc-200 px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium">
                  {user.email}
                </div>
                <div className="text-xs text-zinc-400">
                  注册于{' '}
                  {new Date(
                    user.created_at
                  ).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <form
                  action={`/api/admin/approve?userId=${user.id}&action=approve`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="rounded bg-green-600 px-3 py-1.5 text-sm text-white"
                  >
                    批准
                  </button>
                </form>
                <form
                  action={`/api/admin/approve?userId=${user.id}&action=reject`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
                  >
                    拒绝
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-lg font-semibold">
        成员（{members.length}）
      </h2>
      <ul className="flex flex-col gap-1">
        {members.map((user) => (
          <li
            key={user.id}
            className="flex justify-between border-b border-zinc-100 py-2 text-sm"
          >
            <span>{user.email}</span>
            <span className="text-zinc-400">
              {user.role}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}