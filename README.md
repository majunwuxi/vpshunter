# VPS Hunter

Reliable low-cost VPS deal monitoring with **checkout verification**.

发现低价 VPS → 重新访问供应商官网 → 核验实时库存与实际下单价格 → 校验配置 → 去重 → 只有真正符合条件时才通知。

核心原则：**论坛、搜索引擎只负责发现线索；供应商实时官网和实际 Order / Checkout 页面才负责最终判定。**

## 架构

```
Forums (LowEndSpirit / LowEndTalk)  +  Provider sites
        │
        ▼
  Discovery Engine            (线索，存 discovery_items)
        │
        ▼
  Verification Engine         (HTTP fetch + Playwright checkout)
        │
        ▼
  Rules Engine                (≥2 vCPU / ≥2GB / ≥15GB / Dedicated IPv4 / <$20)
        │
   ┌────┴────┐
   ▼         ▼
 Supabase   Resend Email
   │
   ▼
 Next.js Dashboard (Vercel)
```

- **GitHub Actions** 每小时调度监控（`17 * * * *`）
- **Vercel** 只跑 Dashboard，不跑抓取器
- **Playwright** 仅在需要 JS Checkout 确认的套餐上启动

## 当前监测规则

- 一级地区：JP / KR / HK / SG
- 最低配置：≥2 vCPU、≥2 GB RAM、≥15 GB SSD/NVMe、≥1 Dedicated IPv4
- 价格档：标准 < US$20/年；若确认支持自定义 rDNS/PTR 则 < US$25/年
- 判定严格使用 `<`（不是 `<=`）

## 验证等级

| 等级 | 含义 | 是否通知 |
|---|---|---|
| A | 官网 + 套餐页 + 价格/配置确认 + Checkout 确认 | ✅ |
| B | 官网套餐页 + 配置 + 价格确认（未进 Checkout） | ❌ |
| C | 仅论坛/搜索线索 | ❌ |

原则：**宁愿漏报，也不要误报。**

## 快速开始

```bash
npm install
npx playwright install chromium

# 本地 dry-run（抓取 + 规则评估，不发通知不写库）
npm run monitor        # 无 .env.local 时自动 dry-run

# 检查单个供应商
npm run check-provider

# 测试
npm run test
npm run lint
npm run typecheck
```

## 部署

完整部署步骤（Supabase / GitHub Actions / Vercel / Resend）见 [SETUP.md](SETUP.md)。

## Provider Adapter

每家供应商一个独立适配器，位于 `monitors/providers/`。WHMCS 供应商复用共享引擎 `lib/crawler/whmcs.ts`（配置驱动）。

| Provider | 状态 | 备注 |
|---|---|---|
| ByteVirt | ✅ enabled | WHMCS，含 Playwright checkout 升级到 A 级 |
| HostUS | ✅ enabled | WHMCS，多位置可选 → 保守跳过（不误报） |
| RackNerd | ⏸ disabled | 列表可抓，billing 有 Cloudflare 403，待 Playwright |
