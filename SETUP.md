# VPS Hunter 部署指南

本指南描述从空仓库到生产环境跑通 VPS Hunter 的全部步骤。

## 1. 基础设施

| 服务 | 用途 | 费用 |
|---|---|---|
| GitHub 仓库 | 代码 + Actions 调度 | 免费 |
| Supabase | PostgreSQL + RLS | 免费档 |
| Vercel | Next.js Dashboard | Hobby 免费 |
| Resend | 邮件通知 | 免费档（100 封/天） |

## 2. Supabase

1. 新建 Supabase 项目。
2. 打开 **SQL Editor**，依次执行：
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_discovery_provider_link.sql`
3. 在 **Project Settings → API** 拿到：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` secret → `SUPABASE_SECRET_KEY`（**绝不下发到浏览器**）

> RLS 已开启，public 表只允许匿名 SELECT；INSERT/UPDATE 必须用 service_role。

## 3. Resend

1. 注册 [resend.com](https://resend.com)。
2. 添加发送域名（如 `alert.yourdomain.com`），验证 **SPF + DKIM**（§64）。
3. 创建 **Sending-only** 的 API Key → `RESEND_API_KEY`。
4. 修改 `lib/notifications/email.ts` 里的发件人 `from` 地址为你的域名。
5. `ALERT_EMAIL` = 接收通知的邮箱。

## 4. GitHub Secrets

仓库 → Settings → Secrets and variables → Actions：

| Secret | 值 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SECRET_KEY` | service_role key |
| `RESEND_API_KEY` | Resend sending-only key |
| `ALERT_EMAIL` | 收件邮箱 |
| `MONITOR_DRY_RUN` | 默认 `true`（只观察）；要真实通知时改为 `false` |

## 5. 上线流程（DRY_RUN 先行，§65/§66）

```bash
# 1. 本地先跑通全链路（无 .env 时自动 dry-run）
npm run monitor

# 2. 配置 Supabase env 后（写库 + 记录 monitor_runs，但不发通知）
# 复制 .env.example → .env.local，填入真实值，设 DRY_RUN=true
npm run monitor

# 3. 观察 2-3 天，确认无误报后
# 在 GitHub Actions 手动 Run workflow，取消勾选 dry_run
```

## 6. Vercel 部署

1. `git push` 到 GitHub。
2. Vercel → Add New → Project → Import 该仓库。
3. 设置环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy。

> 不要把 `SUPABASE_SECRET_KEY` 设为 `NEXT_PUBLIC_*`。若 Dashboard 需要管理员写操作，把它放 **Server Environment**（非 public）。

## 7. GitHub Actions

`.github/workflows/monitor.yml` 已配置：
- `schedule: "17 * * * *"`（每小时，错开整点，§34）
- `workflow_dispatch` 手动触发，带 `dry_run` 复选框（默认勾选 = 安全）

## 8. 验证 MVP 清单（§87）

完成后确认：
- [ ] Actions 每小时运行
- [ ] 能识别 vCPU / RAM / SSD / Dedicated IPv4 / NAT IPv4
- [ ] 年付价格归一化 + `< $20` / PTR `< $25` 判定
- [ ] 打开供应商实时页面 + Checkout 验证
- [ ] 售罄 / 重复 / 搜索缓存不通知；补货可重通知
- [ ] 数据写入 Supabase，Dashboard 显示 Last Check

## 9. 常见问题

- **monitor 只输出 `[no-db]`** → `SUPABASE_SECRET_KEY` 未配置或错误。
- **某个供应商无输出** → 看日志 `plan info incomplete`（配置/位置未识别，保守跳过）。
- **Cloudflare 403** → 该供应商 checkout 无法 HTTP 确认，保持 B/C 级不通知（§56）。
