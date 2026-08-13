'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, signOut } from '@/lib/db/auth';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<
    'login' | 'register'
  >('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState<
    string | null
  >(null);
  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (
      window.location.search.includes(
        'out=1'
      )
    ) {
      signOut().then(() => {
        window.history.replaceState(
          {},
          '',
          '/auth'
        );
        router.refresh();
      });
    }
  }, [router]);

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } =
          await signIn(
            email,
            password
          );

        if (error) {
          setError(error.message);
          return;
        }

        router.push('/');
        router.refresh();
      } else {
        const { error } =
          await signUp(
            email,
            password
          );

        if (error) {
          setError(error.message);
          return;
        }

        setMessage(
          '注册成功。若你是第一个用户即管理员；否则请等待管理员审批。'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4">
      <div className="w-full rounded border border-zinc-200 p-6">
        <h1 className="mb-1 text-xl font-bold">
          VPS Hunter
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          {mode === 'login'
            ? '登录查看监控结果'
            : '注册新账号'}
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <input
            type="email"
            required
            placeholder="邮箱"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="密码"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-green-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading
              ? '处理中…'
              : mode === 'login'
                ? '登录'
                : '注册'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(
              mode === 'login'
                ? 'register'
                : 'login'
            );
            setError(null);
            setMessage(null);
          }}
          className="mt-4 text-sm text-zinc-500 hover:underline"
        >
          {mode === 'login'
            ? '没有账号？注册'
            : '已有账号？登录'}
        </button>
      </div>
    </main>
  );
}