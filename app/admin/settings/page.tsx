'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RulesState {
  preferredRegions: string;
  minVcpu: string;
  minRamMb: string;
  minStorageGb: string;
  requireSolidState: boolean;
  requireDedicatedIpv4: boolean;
  standardMaxUsdYear: string;
  rdnsMaxUsdYear: string;
  priceBufferUsd: string;
}

const EMPTY: RulesState = {
  preferredRegions: 'JP,KR,HK,SG',
  minVcpu: '2',
  minRamMb: '2048',
  minStorageGb: '15',
  requireSolidState: true,
  requireDedicatedIpv4: true,
  standardMaxUsdYear: '20',
  rdnsMaxUsdYear: '25',
  priceBufferUsd: '0.25'
};

export default function SettingsPage() {
  const [form, setForm] =
    useState<RulesState>(EMPTY);
  const [loaded, setLoaded] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);
  const [saved, setSaved] = useState<
    string | null
  >(null);
  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    fetch('/api/admin/rules')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            '加载失败（可能无权限）'
          );
        }

        const data =
          await res.json();

        setForm({
          preferredRegions: (
            data.rules.preferredRegions ??
            []
          ).join(','),
          minVcpu: String(
            data.rules.minVcpu
          ),
          minRamMb: String(
            data.rules.minRamMb
          ),
          minStorageGb: String(
            data.rules.minStorageGb
          ),
          requireSolidState:
            data.rules.requireSolidState,
          requireDedicatedIpv4:
            data.rules.requireDedicatedIpv4,
          standardMaxUsdYear: String(
            data.rules.standardMaxUsdYear
          ),
          rdnsMaxUsdYear: String(
            data.rules.rdnsMaxUsdYear
          ),
          priceBufferUsd: String(
            data.rules.priceBufferUsd
          )
        });
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : String(err)
        )
      )
      .finally(() =>
        setLoaded(true)
      );
  }, []);

  function set<K extends keyof RulesState>(
    key: K,
    value: RulesState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setSaving(true);
    setSaved(null);
    setError(null);

    try {
      const res = await fetch(
        '/api/admin/rules',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            preferredRegions:
              form.preferredRegions
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            minVcpu: Number(
              form.minVcpu
            ),
            minRamMb: Number(
              form.minRamMb
            ),
            minStorageGb: Number(
              form.minStorageGb
            ),
            requireSolidState:
              form.requireSolidState,
            requireDedicatedIpv4:
              form.requireDedicatedIpv4,
            standardMaxUsdYear: Number(
              form.standardMaxUsdYear
            ),
            rdnsMaxUsdYear: Number(
              form.rdnsMaxUsdYear
            ),
            priceBufferUsd: Number(
              form.priceBufferUsd
            )
          })
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            '保存失败'
        );
      }

      setSaved('规则已保存');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">
          监测规则设置
        </h1>
        <Link
          href="/admin"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← 返回管理员
        </Link>
      </header>

      {!loaded ? (
        <p className="text-sm text-zinc-500">
          加载中…
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              优先地区（逗号分隔，如 JP,KR,HK,SG）
            </span>
            <input
              type="text"
              value={form.preferredRegions}
              onChange={(e) =>
                set(
                  'preferredRegions',
                  e.target.value
                )
              }
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                最低 CPU（vCPU）
              </span>
              <input
                type="number"
                min={1}
                value={form.minVcpu}
                onChange={(e) =>
                  set(
                    'minVcpu',
                    e.target.value
                  )
                }
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                最低 RAM（MB）
              </span>
              <input
                type="number"
                min={512}
                step={512}
                value={form.minRamMb}
                onChange={(e) =>
                  set(
                    'minRamMb',
                    e.target.value
                  )
                }
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                最低存储（GB）
              </span>
              <input
                type="number"
                min={1}
                value={form.minStorageGb}
                onChange={(e) =>
                  set(
                    'minStorageGb',
                    e.target.value
                  )
                }
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                标准价格上限（$/年）
              </span>
              <input
                type="number"
                min={1}
                step={0.5}
                value={form.standardMaxUsdYear}
                onChange={(e) =>
                  set(
                    'standardMaxUsdYear',
                    e.target.value
                  )
                }
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                PTR 价格上限（$/年）
              </span>
              <input
                type="number"
                min={1}
                step={0.5}
                value={form.rdnsMaxUsdYear}
                onChange={(e) =>
                  set(
                    'rdnsMaxUsdYear',
                    e.target.value
                  )
                }
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                价格安全边际（$）
              </span>
              <input
                type="number"
                min={0}
                step={0.05}
                value={form.priceBufferUsd}
                onChange={(e) =>
                  set(
                    'priceBufferUsd',
                    e.target.value
                  )
                }
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requireSolidState}
                onChange={(e) =>
                  set(
                    'requireSolidState',
                    e.target.checked
                  )
                }
              />
              要求 SSD/NVMe
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requireDedicatedIpv4}
                onChange={(e) =>
                  set(
                    'requireDedicatedIpv4',
                    e.target.checked
                  )
                }
              />
              要求 Dedicated IPv4
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          {saved && (
            <p className="text-sm text-green-700">
              {saved}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存规则'}
          </button>
        </form>
      )}
    </main>
  );
}