# VPS Hunter 完整开发指南

## 1. 项目目标

VPS Hunter 是一个低价 VPS 自动监测系统。

它解决的不是“哪里有便宜 VPS”这个问题，而是：

> **发现低价 VPS → 重新访问供应商官网 → 核验实时库存与实际下单价格 → 校验配置 → 去重 → 只有真正符合条件时才通知。**

核心原则是：

**论坛、搜索引擎、促销博客只负责发现线索；供应商实时官网和实际 Order / Deploy / Checkout 页面才负责最终判定。**

这一点必须贯穿整个项目设计。

---

# 2. 当前监测规则

第一版直接把现有条件写进配置。

## 2.1 地区优先级

一级重点：

1. 日本 Japan
2. 韩国 South Korea
3. 香港 Hong Kong
4. 新加坡 Singapore

其他国家和地区也可以监测，但权重较低。

---

## 2.2 最低配置

所有套餐必须同时满足：

```text
CPU >= 2 vCPU
RAM >= 2 GB
SSD/NVMe >= 15 GB
Dedicated IPv4 >= 1
```

注意：

```text
1 vCPU      ❌
1 GB RAM    ❌
10 GB SSD   ❌
NAT IPv4    ❌
共享 IPv4    ❌
端口映射 IPv4 ❌
```

存储必须是：

```text
SSD
NVMe
NVMe SSD
Enterprise SSD
```

机械 HDD 默认不满足要求。

---

# 3. 价格规则

采用两个等级。

## Tier A

不要求自定义 rDNS/PTR：

```text
最终价格 < US$20 / 年
```

必须包含：

```text
>= 2 vCPU
>= 2 GB RAM
>= 15 GB SSD/NVMe
>= 1 Dedicated IPv4
```

---

## Tier B

如果可以明确确认支持：

```text
Custom rDNS / PTR
```

则允许：

```text
最终价格 < US$25 / 年
```

例如：

```text
$18/year
2 vCPU
2 GB RAM
20 GB NVMe
Dedicated IPv4
PTR 未知
```

合格。

而：

```text
$23/year
2 vCPU
2 GB RAM
20 GB NVMe
Dedicated IPv4
PTR 未知
```

不合格。

但是：

```text
$23/year
2 vCPU
2 GB RAM
20 GB NVMe
Dedicated IPv4
Custom PTR confirmed
```

合格。

---

# 4. 推荐系统架构

推荐：

```text
                    ┌────────────────────┐
                    │   LowEndSpirit     │
                    │   LowEndTalk       │
                    │   Provider sites   │
                    │   Deal sources     │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Discovery Engine   │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Verification Engine│
                    │                    │
                    │ HTTP fetch         │
                    │ Playwright         │
                    │ Checkout verify    │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Rules Engine       │
                    └─────────┬──────────┘
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
           ┌─────────────┐         ┌─────────────┐
           │  Supabase   │         │   Resend    │
           │ PostgreSQL  │         │ Email Alert │
           └──────┬──────┘         └─────────────┘
                  │
                  ▼
           ┌─────────────┐
           │   Next.js   │
           │   Vercel    │
           └─────────────┘
```

---

# 5. 为什么不用 Vercel Cron 做主监测器

这里建议：

**Vercel 负责网站。**

**GitHub Actions 负责监控。**

原因很简单。

目前 Vercel Hobby 的 Cron Job 只允许每天执行一次，不能拿来做每小时扫描；GitHub Actions 的 scheduled workflow 则支持 cron，最短间隔可到 5 分钟。

所以我们的架构是：

```text
GitHub Actions
      │
      ├── 每小时启动
      │
      ├── 运行 Node.js
      │
      ├── 必要时启动 Playwright
      │
      ├── 核验 VPS
      │
      └── 写入 Supabase

Vercel
      │
      └── 展示结果
```

这样比把抓取器塞进 Vercel Function 稳定很多。

---

# 6. 技术栈

建议：

```text
Language       TypeScript
Runtime        Node.js
Frontend       Next.js App Router
Hosting        Vercel
Database       Supabase PostgreSQL
Crawler        fetch + cheerio
Browser        Playwright Chromium
Scheduler      GitHub Actions
Email          Resend
Validation     Zod
Date           date-fns
Logging        pino
Testing        Vitest
```

Playwright 官方支持直接运行于 GitHub Actions，而且可以只安装 Chromium，以降低 CI 下载时间和空间占用。

---

# 7. 初始化项目

本地准备：

```bash
node --version
```

建议使用当前 Node.js LTS。

创建项目：

```bash
npx create-next-app@latest vps-hunter
```

选择：

```text
TypeScript       Yes
ESLint           Yes
Tailwind CSS     Yes
src directory    No
App Router       Yes
Turbopack        Yes
```

进入项目：

```bash
cd vps-hunter
```

安装依赖：

```bash
npm install \
  @supabase/supabase-js \
  cheerio \
  zod \
  resend \
  date-fns \
  pino
```

安装 Playwright：

```bash
npm install -D playwright vitest
```

安装 Chromium：

```bash
npx playwright install chromium
```

---

# 8. 项目目录

建议最终结构：

```text
vps-hunter/
│
├── app/
│   ├── page.tsx
│   ├── plans/
│   │   └── page.tsx
│   ├── providers/
│   │   └── page.tsx
│   ├── history/
│   │   └── page.tsx
│   └── api/
│       ├── plans/
│       │   └── route.ts
│       └── health/
│           └── route.ts
│
├── components/
│   ├── PlanCard.tsx
│   ├── ProviderCard.tsx
│   └── VerificationBadge.tsx
│
├── config/
│   ├── rules.ts
│   ├── regions.ts
│   └── providers.ts
│
├── lib/
│   ├── db/
│   │   └── supabase.ts
│   │
│   ├── rules/
│   │   ├── evaluate.ts
│   │   └── normalize.ts
│   │
│   ├── crawler/
│   │   ├── fetch.ts
│   │   └── browser.ts
│   │
│   ├── notifications/
│   │   └── email.ts
│   │
│   └── utils/
│       ├── currency.ts
│       └── hash.ts
│
├── monitors/
│   ├── types.ts
│   └── providers/
│       ├── bytevirt.ts
│       ├── cloudcone.ts
│       └── dedirock.ts
│
├── discovery/
│   ├── lowendspirit.ts
│   └── lowendtalk.ts
│
├── scripts/
│   ├── run-monitor.ts
│   ├── check-provider.ts
│   └── test-notification.ts
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
│
├── tests/
│   ├── rules.test.ts
│   └── fixtures/
│
└── .github/
    └── workflows/
        └── monitor.yml
```

---

# 9. Supabase 数据库设计

创建一个 Supabase 项目。

Supabase 给每个项目提供 PostgreSQL 数据库。对于前端直接访问的表，官方建议启用 Row Level Security；Secret / service-role 类密钥具有高权限并可绕过 RLS，因此只能放在服务端和 CI Secrets 中，绝不能发送到浏览器。

---

# 10. 数据库 Schema

建立：

```sql
create extension if not exists pgcrypto;
```

## providers

```sql
create table providers (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,
  name text not null,

  homepage_url text,

  reliability_score integer default 50,

  rdns_policy text,
  smtp25_policy text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## locations

```sql
create table locations (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid references providers(id)
    on delete cascade,

  country text,
  city text,
  region_code text,

  priority integer default 0,

  created_at timestamptz default now()
);
```

region_code：

```text
JP
KR
HK
SG
US
DE
NL
```

---

## plans

```sql
create table plans (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid references providers(id)
    on delete cascade,

  external_id text,

  name text not null,

  location text,

  cpu numeric,
  ram_mb integer,
  storage_gb numeric,
  storage_type text,

  bandwidth_mbps integer,
  traffic_gb numeric,

  ipv4_count integer default 0,
  dedicated_ipv4 boolean default false,

  ipv6 boolean default false,

  rdns_supported boolean,
  rdns_method text,

  smtp25_policy text,

  price numeric,
  currency text,
  billing_period text,

  price_usd_year numeric,

  order_url text,
  product_url text,

  stock integer,
  available boolean,

  verification_level text,

  last_verified_at timestamptz,

  first_seen_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## checks

每一次监测都存。

```sql
create table checks (
  id uuid primary key default gen_random_uuid(),

  plan_id uuid references plans(id)
    on delete cascade,

  status text,

  http_status integer,

  price_usd_year numeric,
  stock integer,
  available boolean,

  verification_level text,

  failure_reason text,

  raw_data jsonb,

  checked_at timestamptz default now()
);
```

---

## price_history

```sql
create table price_history (
  id uuid primary key default gen_random_uuid(),

  plan_id uuid references plans(id)
    on delete cascade,

  price numeric,

  currency text,

  price_usd_year numeric,

  recorded_at timestamptz default now()
);
```

---

## notifications

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),

  plan_id uuid references plans(id)
    on delete cascade,

  channel text,

  notification_hash text unique,

  status text,

  sent_at timestamptz default now()
);
```

---

## discovery_items

用来保存论坛线索。

```sql
create table discovery_items (
  id uuid primary key default gen_random_uuid(),

  source text,

  source_url text unique,

  title text,

  provider_name text,

  detected_price text,

  processed boolean default false,

  created_at timestamptz default now()
);
```

---

# 11. RLS

至少开启：

```sql
alter table providers enable row level security;
alter table plans enable row level security;
alter table locations enable row level security;
alter table checks enable row level security;
alter table price_history enable row level security;
alter table notifications enable row level security;
```

网站可以允许匿名只读：

```sql
create policy "public read plans"
on plans
for select
using (true);
```

但：

```text
INSERT
UPDATE
DELETE
```

全部应该由后端或 GitHub Actions 使用 Secret key 完成。

---

# 12. 环境变量

`.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SECRET_KEY=

RESEND_API_KEY=

ALERT_EMAIL=

MONITOR_USER_AGENT=
```

不要：

```text
NEXT_PUBLIC_SUPABASE_SECRET_KEY
```

Supabase Secret key 不允许暴露在浏览器。

Next.js 支持通过环境变量配置服务器端运行环境。

---

# 13. Supabase Client

`lib/db/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      persistSession: false
    }
  }
);
```

---

# 14. 监测规则配置

`config/rules.ts`

```ts
export const RULES = {
  preferredRegions: [
    'JP',
    'KR',
    'HK',
    'SG'
  ],

  hardware: {
    minVcpu: 2,
    minRamMb: 2048,
    minStorageGb: 15,
    requireSolidState: true,
    requireDedicatedIpv4: true
  },

  pricing: {
    standardMaxUsdYear: 20,
    rdnsMaxUsdYear: 25
  },

  smtp25Required: false,

  allowedStorageTypes: [
    'SSD',
    'NVME',
    'NVME SSD',
    'ENTERPRISE SSD'
  ],

  verification: {
    minimumNotificationLevel: 'A'
  }
} as const;
```

注意这里：

```ts
standardMaxUsdYear: 20
```

实际判断必须：

```ts
price < 20
```

不是：

```ts
price <= 20
```

同理 PTR 档：

```ts
price < 25
```

---

# 15. 标准 VPS 类型

`monitors/types.ts`

```ts
export interface VpsOffer {
  provider: string;

  planName: string;

  countryCode: string;
  city?: string;

  cpu: number;

  ramMb: number;

  storageGb: number;
  storageType: string;

  trafficGb?: number;

  bandwidthMbps?: number;

  ipv4Count: number;

  dedicatedIpv4: boolean;

  rdnsSupported?: boolean;

  rdnsMethod?: string;

  smtp25Policy?: string;

  currency: string;

  price: number;

  billingPeriod:
    | 'monthly'
    | 'quarterly'
    | 'semiannual'
    | 'annual';

  priceUsdYear: number;

  stock?: number;

  available: boolean;

  productUrl: string;

  orderUrl?: string;

  verificationLevel:
    | 'A'
    | 'B'
    | 'C';

  verifiedAt: Date;
}
```

---

# 16. Verification Level

定义三个等级。

## A

```text
供应商官网打开成功
+
套餐页面存在
+
当前价格确认
+
当前配置确认
+
目标 Location 可选
+
Order / Checkout 页面确认
```

允许通知。

---

## B

```text
官网套餐页面确认
+
配置确认
+
价格确认
```

但是：

```text
未成功进入 Checkout
```

默认不通知。

---

## C

只有：

```text
论坛
搜索引擎
促销文章
缓存页面
Reddit
LowEndSpirit
LowEndTalk
```

只能作为线索。

**永远不能直接通知。**

---

# 17. Rules Engine

`lib/rules/evaluate.ts`

```ts
import { RULES } from '@/config/rules';
import type { VpsOffer } from '@/monitors/types';

export interface Evaluation {
  qualified: boolean;
  tier?: 'standard' | 'rdns';
  reasons: string[];
}

export function evaluateOffer(
  offer: VpsOffer
): Evaluation {
  const reasons: string[] = [];

  if (offer.cpu < RULES.hardware.minVcpu) {
    reasons.push('CPU below minimum');
  }

  if (offer.ramMb < RULES.hardware.minRamMb) {
    reasons.push('RAM below minimum');
  }

  if (
    offer.storageGb <
    RULES.hardware.minStorageGb
  ) {
    reasons.push('Storage below minimum');
  }

  if (!offer.dedicatedIpv4) {
    reasons.push('No dedicated IPv4');
  }

  if (offer.ipv4Count < 1) {
    reasons.push('IPv4 count below minimum');
  }

  const type =
    offer.storageType.toUpperCase();

  const solidState =
    type.includes('SSD') ||
    type.includes('NVME');

  if (!solidState) {
    reasons.push('Storage is not SSD/NVMe');
  }

  if (!offer.available) {
    reasons.push('Out of stock');
  }

  if (offer.verificationLevel !== 'A') {
    reasons.push(
      'Checkout not fully verified'
    );
  }

  if (reasons.length > 0) {
    return {
      qualified: false,
      reasons
    };
  }

  if (
    offer.priceUsdYear <
    RULES.pricing.standardMaxUsdYear
  ) {
    return {
      qualified: true,
      tier: 'standard',
      reasons: []
    };
  }

  if (
    offer.rdnsSupported === true &&
    offer.priceUsdYear <
      RULES.pricing.rdnsMaxUsdYear
  ) {
    return {
      qualified: true,
      tier: 'rdns',
      reasons: []
    };
  }

  return {
    qualified: false,
    reasons: ['Price exceeds allowed tier']
  };
}
```

---

# 18. 为什么要统一年付价格

不同供应商可能显示：

```text
$2 / month
$6 / quarter
$10 / 6 months
$18 / year
```

全部转换成：

```text
priceUsdYear
```

例如：

```ts
function annualizePrice(
  price: number,
  billing: string
) {
  switch (billing) {
    case 'monthly':
      return price * 12;

    case 'quarterly':
      return price * 4;

    case 'semiannual':
      return price * 2;

    case 'annual':
      return price;

    default:
      throw new Error(
        'Unknown billing period'
      );
  }
}
```

---

# 19. 汇率

最好不要在规则引擎里直接访问汇率 API。

流程应该：

```text
Crawler
   ↓
Currency Service
   ↓
USD/year
   ↓
Rules Engine
```

并把：

```text
exchange_rate
exchange_rate_time
```

一起保存。

对于临界价格：

```text
19.98 USD
24.98 USD
```

建议设置安全边际。

例如：

```ts
priceBufferUsd = 0.25;
```

因为：

```text
税
支付手续费
汇率变化
```

都有可能导致结算价格超标。

---

# 20. Provider Monitor 接口

每家供应商一个 Adapter。

```ts
export interface ProviderMonitor {
  slug: string;

  discover(): Promise<string[]>;

  verify(
    url: string
  ): Promise<VpsOffer[]>;
}
```

例如：

```text
monitors/providers/
    bytevirt.ts
    dedirock.ts
    cloudcone.ts
```

绝对不要写一个“万能 HTML 抓取器”。

供应商网页结构变化太大。

---

# 21. 第一层抓取：HTTP

能不用浏览器就不要用。

例如：

```ts
const response = await fetch(url, {
  headers: {
    'User-Agent':
      process.env.MONITOR_USER_AGENT ??
      'VPS-Hunter/1.0'
  }
});

if (!response.ok) {
  throw new Error(
    `HTTP ${response.status}`
  );
}

const html = await response.text();
```

然后使用：

```ts
import * as cheerio from 'cheerio';

const $ = cheerio.load(html);
```

---

# 22. 第二层抓取：Playwright

如果页面依赖：

```text
JavaScript
React
Vue
动态套餐选择
location selector
Checkout selector
```

再启用 Playwright。

`lib/crawler/browser.ts`

```ts
import { chromium } from 'playwright';

export async function openBrowser() {
  return chromium.launch({
    headless: true
  });
}
```

---

# 23. Checkout 核验

这是整个项目最重要的地方。

例如：

```ts
const browser = await chromium.launch({
  headless: true
});

const page =
  await browser.newPage();

await page.goto(orderUrl, {
  waitUntil: 'domcontentloaded',
  timeout: 30000
});
```

然后：

```ts
const content =
  await page.textContent('body');
```

确认：

```text
Annual
2 vCPU
2 GB
20 GB NVMe
1 IPv4
Singapore
$18.00
```

全部出现。

---

# 24. Location 验证

不要仅因为供应商支持 Tokyo 就认为：

```text
这个套餐也支持 Tokyo
```

必须确认：

```text
该套餐
+
该价格
+
Tokyo
```

能够同时存在。

例如页面：

```html
<select name="location">
<option>Los Angeles</option>
<option>Tokyo</option>
</select>
```

Playwright：

```ts
await page.selectOption(
  'select[name="location"]',
  {
    label: 'Tokyo'
  }
);
```

然后再次读取总价。

---

# 25. IPv4 验证

识别：

```text
1 IPv4
1 Dedicated IPv4
IPv4 Address Included
Public IPv4
```

排除：

```text
NAT IPv4
Shared IPv4
IPv4 NAT
20 ports
IPv6 only
```

如果：

```text
IPv4 +$3/year
```

则最终价格：

```text
plan
+
IPv4
```

必须一起计算。

---

# 26. PTR/rDNS

记录状态：

```text
supported
unsupported
unknown
```

不要简单使用 boolean。

更好的类型：

```ts
type RdnsStatus =
  | 'confirmed'
  | 'unsupported'
  | 'unknown';
```

还需要：

```text
method
```

例如：

```text
SolusVM control panel
VirtFusion control panel
Ticket request
API
Support request
```

---

# 27. TCP 25

同样定义：

```ts
type Port25Policy =
  | 'open'
  | 'blocked'
  | 'request-unblock'
  | 'restricted'
  | 'unknown';
```

TCP 25 暂时只是展示信息。

不是硬筛选规则。

---

# 28. 去重算法

这是必须做的。

否则 GitHub Actions 每小时都会通知：

```text
发现 VPS!
发现 VPS!
发现 VPS!
```

用户第二天就想把 VPS Hunter 埋了。

生成：

```text
notification_hash
```

内容：

```text
provider
plan
location
price
cpu
ram
storage
```

例如：

```ts
import crypto from 'crypto';

export function createOfferHash(
  data: object
) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(data)
    )
    .digest('hex');
}
```

---

# 29. 什么情况下重新通知

建议：

首次发现：

```text
通知
```

售罄后重新补货：

```text
通知
```

价格下降：

```text
通知
```

配置升级：

```text
通知
```

普通重复检查：

```text
不通知
```

价格上涨：

```text
记录
不通知
```

---

# 30. 状态机

建议：

```text
UNKNOWN
   │
   ▼
AVAILABLE
   │
   ├──────────┐
   ▼          │
SOLD_OUT      │
   │          │
   └──────► AVAILABLE
              ↑
            补货通知
```

---

# 31. 通知邮件

使用 Resend。

Resend 官方 Node API 可以直接调用 `emails.send()`；正式发送给任意收件人前应验证自己的发送域名。

`lib/notifications/email.ts`

```ts
import { Resend } from 'resend';

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

export async function sendAlert(
  offer: any
) {
  await resend.emails.send({
    from:
      'VPS Hunter <alert@yourdomain.com>',

    to: [
      process.env.ALERT_EMAIL!
    ],

    subject:
      `🔥 VPS 补货：${offer.provider} ${offer.priceUsdYear}/年`,

    html: `
      <h2>VPS Hunter</h2>

      <p>
        <strong>${offer.provider}</strong>
      </p>

      <p>
        Location:
        ${offer.city ?? ''}
        ${offer.countryCode}
      </p>

      <p>
        CPU:
        ${offer.cpu} vCPU
      </p>

      <p>
        RAM:
        ${offer.ramMb / 1024} GB
      </p>

      <p>
        Storage:
        ${offer.storageGb} GB
        ${offer.storageType}
      </p>

      <p>
        IPv4:
        ${offer.ipv4Count}
      </p>

      <p>
        Price:
        $${offer.priceUsdYear}/year
      </p>

      <p>
        rDNS:
        ${
          offer.rdnsSupported
            ? 'Supported'
            : 'Unknown'
        }
      </p>

      <p>
        SMTP 25:
        ${
          offer.smtp25Policy ??
          'Unknown'
        }
      </p>

      <p>
        Verification:
        ${offer.verificationLevel}
      </p>

      <a href="${offer.orderUrl}">
        Buy Now
      </a>
    `
  });
}
```

---

# 32. 主 Monitor

`scripts/run-monitor.ts`

伪代码：

```ts
import {
  monitors
} from '@/config/providers';

async function main() {
  console.log(
    'VPS Hunter started'
  );

  for (
    const monitor of monitors
  ) {
    try {
      const urls =
        await monitor.discover();

      for (const url of urls) {
        const offers =
          await monitor.verify(
            url
          );

        for (
          const offer of offers
        ) {
          await processOffer(
            offer
          );
        }
      }
    } catch (error) {
      console.error(
        monitor.slug,
        error
      );
    }
  }
}

main();
```

---

# 33. processOffer

流程：

```text
normalize
 ↓
database
 ↓
evaluate
 ↓
compare history
 ↓
dedupe
 ↓
notify
```

示例：

```ts
async function processOffer(
  offer: VpsOffer
) {
  const plan =
    await saveOffer(offer);

  const result =
    evaluateOffer(offer);

  await saveCheck(
    plan.id,
    result
  );

  if (!result.qualified) {
    return;
  }

  const shouldNotify =
    await detectMeaningfulChange(
      plan,
      offer
    );

  if (!shouldNotify) {
    return;
  }

  await sendAlert(offer);

  await saveNotification(
    plan.id,
    offer
  );
}
```

---

# 34. GitHub Actions

`.github/workflows/monitor.yml`

```yaml
name: VPS Monitor

on:
  schedule:
    - cron: "17 * * * *"

  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest

    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: npm

      - name: Install
        run: npm ci

      - name: Install Chromium
        run: |
          npx playwright install chromium --with-deps

      - name: Run monitor
        run: npm run monitor
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}

          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}

          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}

          ALERT_EMAIL: ${{ secrets.ALERT_EMAIL }}
```

GitHub 官方支持 scheduled workflows 使用 POSIX cron。

我特意使用：

```text
17 * * * *
```

而不是：

```text
0 * * * *
```

因为很多项目喜欢整点执行。

错开整点通常更合理。

---

# 35. 手动执行

`workflow_dispatch`

允许在：

```text
GitHub
→ Actions
→ VPS Monitor
→ Run workflow
```

手动执行。

这对于调试特别有用。

---

# 36. npm scripts

`package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "monitor": "tsx scripts/run-monitor.ts",
    "test": "vitest"
  }
}
```

安装：

```bash
npm install -D tsx
```

---

# 37. GitHub Secrets

进入：

```text
Repository
→ Settings
→ Secrets and variables
→ Actions
```

添加：

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
RESEND_API_KEY
ALERT_EMAIL
```

不要把这些写进：

```text
.git
```

---

# 38. Vercel 环境变量

进入：

```text
Vercel
→ Project
→ Settings
→ Environment Variables
```

添加：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

如果 Dashboard API 需要管理员访问：

```text
SUPABASE_SECRET_KEY
```

也可以放在 Vercel Server Environment。

但是绝对不能变成：

```text
NEXT_PUBLIC_*
```

---

# 39. Dashboard

首页可以先很简单。

显示：

```text
🔥 Currently Available

Provider
Location
CPU
RAM
Storage
IPv4
Price
PTR
Verification
Last checked
```

---

# 40. Verification Badge

建议：

```text
A Verified Checkout

B Official Website

C Discovery Only
```

颜色：

```text
A = green
B = orange
C = gray
```

不要展示 C 为“可以买”。

C 应该明确：

```text
Unverified lead
```

---

# 41. 首页排序

默认：

```text
JP
KR
HK
SG
↓
其他地区
```

同地区：

```text
价格升序
```

---

# 42. API

例如：

```text
GET /api/plans
```

返回：

```json
{
  "plans": [
    {
      "provider": "Example",
      "location": "Tokyo",
      "cpu": 2,
      "ramGb": 2,
      "storageGb": 30,
      "priceUsdYear": 18,
      "verification": "A"
    }
  ]
}
```

---

# 43. Provider 示例

假设 ExampleHost：

```ts
export const exampleHostMonitor = {
  slug: 'examplehost',

  async discover() {
    return [
      'https://example.com/vps'
    ];
  },

  async verify(url: string) {
    // Fetch product page

    // Parse plans

    // Open checkout

    // Verify location

    // Verify IPv4

    // Verify price

    // Return normalized offers

    return [];
  }
};
```

---

# 44. 不要自动“猜”配置

比如网页写：

```text
2 Core
```

可以解释为：

```text
2 vCPU
```

但网页写：

```text
High performance CPU
```

不能猜：

```text
2 vCPU
```

网页写：

```text
Premium SSD
```

可以判断是 SSD。

网页只写：

```text
20 GB Disk
```

则：

```text
storage_type = unknown
```

按照当前规则：

```text
不通知
```

---

# 45. 不要自动猜 IPv4

例如：

```text
1 IP
```

需要谨慎。

最好进一步确认：

```text
IPv4 Address
Dedicated IPv4
Public IPv4
```

否则：

```text
dedicatedIpv4 = unknown
```

不通知。

---

# 46. 搜索引擎策略

搜索引擎只能：

```text
discover()
```

不能：

```text
verify()
```

比如发现：

```text
ExampleHost Tokyo VPS
$12/year
2 GB RAM
```

系统应该产生：

```text
DiscoveryItem
```

然后进入：

```text
official site
```

验证。

---

# 47. LowEndSpirit

抓：

```text
Offers
VPS
Providers
新帖子
```

提取：

```text
provider
location
price
coupon
product url
```

这些只存：

```text
discovery_items
```

然后交给 Provider Monitor。

---

# 48. Coupon 核验

优惠码是最容易误报的地方。

论坛可能写：

```text
BF2025
50% OFF
```

系统必须：

```text
Checkout
→ input coupon
→ Apply
→ read final total
```

只有最终总价改变才算有效。

否则：

```text
coupon invalid
```

直接淘汰。

---

# 49. Checkout 最终价格

必须考虑：

```text
Plan
IPv4
Setup fee
Mandatory addons
Tax（如果能确定）
```

原则：

```text
必须付款的项目
```

全部算进去。

例如：

```text
VPS      $15
IPv4     $3
Setup    $2
----------------
Total    $20
```

因为条件是：

```text
< $20
```

所以：

```text
不合格
```

---

# 50. 税的问题

如果供应商：

```text
税率依客户国家不同
```

可以记录：

```text
price_pre_tax
```

通知中标：

```text
tax may apply
```

但是对于特别接近价格上限的 VPS，建议保守处理。

例如：

```text
$19.99 + tax
```

最好不通知。

---

# 51. 失败原因

每次检查失败都应该记录：

```text
OUT_OF_STOCK
PRICE_TOO_HIGH
CPU_TOO_LOW
RAM_TOO_LOW
STORAGE_TOO_LOW
NO_IPV4
NAT_IPV4
CHECKOUT_UNREACHABLE
COUPON_INVALID
LOCATION_UNAVAILABLE
UNKNOWN_STORAGE_TYPE
UNKNOWN_IPV4
```

以后 Dashboard 能告诉你：

```text
为什么这个套餐没通知？
```

---

# 52. HTTP 超时

建议：

```text
HTTP fetch
10-15 sec
```

Browser：

```text
30 sec
```

不要某一家网站卡住整个任务。

---

# 53. Retry

建议：

```text
HTTP error
→ retry 2 times
```

间隔：

```text
2 sec
5 sec
```

但是：

```text
404
```

没必要重试。

---

# 54. 并发

第一版：

```text
3-5 concurrent providers
```

不要：

```text
50
```

避免：

```text
rate limit
403
Cloudflare
```

---

# 55. User-Agent

使用明确身份：

```text
VPS-Hunter/1.0
```

不要伪装：

```text
Googlebot
```

---

# 56. Cloudflare

这是现实中比较麻烦的一部分。

如果页面触发：

```text
CAPTCHA
Turnstile
Login challenge
```

系统：

```text
verification = failed
```

不要试图绕过。

然后：

```text
CHECKOUT_UNREACHABLE
```

默认不通知。

---

# 57. 登录后才能购买

如果必须登录才能看到价格：

第一版：

```text
不自动登录
```

设置：

```text
verificationLevel = B
```

因此不通知。

后续可以针对特定供应商安全地增加账户 Session。

---

# 58. Screenshot

当 Checkout 验证成功时，可以保存：

```text
checkout screenshot
```

GitHub Action artifact。

例如：

```text
artifacts/
  provider/
  timestamp/
  checkout.png
```

这样发生误报时可以追溯。

---

# 59. Raw evidence

数据库建议保存：

```json
{
  "productPage": "...",
  "checkoutPage": "...",
  "priceText": "$18/year",
  "locationText": "Tokyo",
  "ipv4Text": "1 IPv4 Included"
}
```

不要保存整个页面永久。

---

# 60. Tests

最重要的是 Rules Test。

例如：

```ts
expect(
  evaluateOffer({
    cpu: 1
  })
).toBe(false);
```

至少覆盖：

```text
1 vCPU       FAIL
2 vCPU       PASS

1 GB         FAIL
2 GB         PASS

14 GB SSD    FAIL
15 GB SSD    PASS

$19.99       PASS
$20.00       FAIL

$24.99 + PTR PASS
$25 + PTR    FAIL

$23 no PTR   FAIL

NAT IPv4     FAIL
```

---

# 61. Fixture 测试

每一家供应商保存一些脱敏 HTML：

```text
tests/fixtures/
    bytevirt-product.html
    dedirock-checkout.html
```

修改 parser 后测试。

这样某次重构不会突然把：

```text
1 IPv4
```

解析成：

```text
0 IPv4
```

---

# 62. GitHub Actions 调试

如果 Monitor 出错：

```text
Actions
→ Run
→ monitor
```

查看日志。

Playwright CI 官方支持上传测试报告和 trace 作为 artifact，用于分析浏览器执行问题。

---

# 63. Vercel 部署

把代码 push：

```bash
git add .
git commit -m "Initial VPS Hunter"
git push
```

然后：

```text
Vercel
→ Add New
→ Project
→ Import Git repository
```

选择：

```text
Next.js
```

设置环境变量。

Deploy。

Next.js App Router 可以直接部署在 Vercel。

---

# 64. Resend 配置

创建：

```text
alert.yourdomain.com
```

或者：

```text
mail.yourdomain.com
```

验证：

```text
SPF
DKIM
```

Resend 支持为 API Key 限制发送权限，生产环境最好使用只具备发送权限的 Key，而不是 full access。

---

# 65. 第一次完整测试

不要直接开自动任务。

先：

```bash
npm run monitor
```

确认：

```text
Discovery OK
Provider OK
Checkout OK
Database OK
Rule OK
Notification OK
```

---

# 66. Dry Run

非常建议加入：

```env
DRY_RUN=true
```

代码：

```ts
if (
  process.env.DRY_RUN === 'true'
) {
  console.log(
    'Would notify:',
    offer
  );

  return;
}
```

先运行两三天：

```text
DRY_RUN
```

观察误报。

再启用通知。

---

# 67. 第一批 Provider

第一版不要超过 8 家。

建议优先开发：

```text
ByteVirt
DediRock
CloudCone
RackNerd
HostDare
HostUS
OrangeVPS
SurferCloud
```

不是因为这些一定满足条件，而是为了建立不同类型供应商 Adapter。

---

# 68. Provider 优先级

数据库增加：

```text
priority
```

例如：

```text
Tokyo provider        100
Seoul provider        100
Hong Kong provider    100
Singapore provider    100

Asia provider          70

US/EU provider         40
```

Monitor 优先跑亚洲。

---

# 69. Scheduler

当前建议：

```text
每小时
```

例如：

```yaml
cron: "17 * * * *"
```

如果将来抢非常短库存：

```text
15 minutes
```

GitHub scheduled workflow 最短可设置为每 5 分钟。

不过注意一个细节：公开仓库如果连续 60 天没有活动，GitHub 可能自动禁用 scheduled workflows，所以长期无人提交的公开项目应定期确认 Actions 状态。

---

# 70. 数据保留

建议：

`checks`

保留：

```text
90 days
```

`price_history`

永久。

`notifications`

永久。

`raw screenshots`

```text
7-30 days
```

---

# 71. Dashboard 第二阶段

加：

```text
Current Deals
Provider History
Price History
Stock History
Locations
Failed Checks
Notifications
```

---

# 72. 价格走势图

例如：

```text
DediRock LA

Jan   $18
Feb   $18
Mar   $15
Apr   $9.88
```

这样可以判断：

```text
真正历史低价
```

还是：

```text
普通营销价
```

---

# 73. Provider Reliability

以后可以评分：

```text
Checkout reliability
Stock accuracy
Historical uptime
Support reputation
IPv4 quality
rDNS availability
SMTP policy clarity
```

例如：

```text
ByteVirt
Verification Score 83/100
```

---

# 74. Confidence Score

每次 Offer 算：

```text
100
```

例如：

```text
Official product page   +20
Checkout verified       +30
Dedicated IPv4 verified +15
Location verified       +15
Price verified          +10
PTR verified            +5
Port 25 verified        +5
```

通知：

```text
Confidence: 95/100
```

这会非常有价值。

---

# 75. API 安全

Dashboard 第一版只读。

不要把：

```text
monitor execution
provider edits
rule edits
```

直接开放给匿名用户。

管理接口以后加入：

```text
Supabase Auth
```

---

# 76. Admin Panel

以后可以直接修改：

```text
CPU >= 2
RAM >= 2
Storage >= 15
Price < 20
PTR Price < 25

JP priority 100
KR priority 100
HK priority 100
SG priority 100
```

而不需要重新部署代码。

---

# 77. rules 表

第二阶段把配置从 TypeScript 移入：

```sql
monitor_rules
```

例如：

```json
{
  "min_cpu": 2,
  "min_ram_mb": 2048,
  "min_storage_gb": 15,
  "standard_price": 20,
  "rdns_price": 25
}
```

---

# 78. Telegram

第二阶段可以加入：

```text
Telegram Bot
```

通知通常比邮件快。

消息：

```text
🔥 VPS Hunter

🇯🇵 Tokyo

Provider: Example
CPU: 2 vCPU
RAM: 2 GB
SSD: 30 GB NVMe
IPv4: 1
Price: $18/year

PTR: Supported
SMTP25: Unknown

Verification: A

BUY
```

---

# 79. Notification Priority

例如：

```text
🔥🔥🔥
JP/KR/HK/SG
+
<$20
+
PTR
```

最高级。

普通：

```text
🔥
```

其他地区：

```text
💡
```

---

# 80. Repository

建议：

```text
github.com/yourname/vps-hunter
```

README：

```text
VPS Hunter
Reliable VPS deal monitoring with checkout verification.
```

---

# 81. Branch Strategy

简单即可：

```text
main
dev
```

开发：

```text
dev
```

测试通过：

```text
main
```

Vercel：

```text
main = Production
```

---

# 82. CI

Push 时运行：

```text
TypeScript
ESLint
Vitest
```

例如：

```yaml
- run: npm run lint
- run: npm run test
- run: npm run build
```

---

# 83. 生产环境监控

Monitor 本身也需要监控。

否则最糟糕的情况不是：

```text
没有便宜 VPS
```

而是：

```text
Monitor 已经挂了三天
但你以为没有便宜 VPS。
```

增加：

```text
monitor_runs
```

---

# 84. monitor_runs

```sql
create table monitor_runs (
  id uuid primary key
    default gen_random_uuid(),

  started_at timestamptz
    default now(),

  finished_at timestamptz,

  providers_checked integer,

  offers_found integer,

  offers_qualified integer,

  notifications_sent integer,

  status text,

  error text
);
```

Dashboard 显示：

```text
Last Monitor

03:17
Success

Providers 8
Offers 37
Qualified 0
```

---

# 85. Heartbeat

如果：

```text
last monitor > 2 hours
```

Dashboard：

```text
⚠ Monitor Offline
```

这是第一版就值得做的功能。

---

# 86. 第一版开发顺序

不要同时开发全部。

按这个顺序：

## Phase 1

```text
Repository
Next.js
Supabase
Schema
Rules Engine
```

## Phase 2

```text
1 Provider Adapter
Checkout verification
```

## Phase 3

```text
GitHub Actions
Hourly monitor
```

## Phase 4

```text
Deduplication
Resend
```

## Phase 5

```text
Dashboard
```

## Phase 6

```text
5-8 providers
```

---

# 87. MVP 验收标准

只有满足以下条件才算第一版完成：

```text
✓ GitHub Actions 每小时运行

✓ 能识别 >=2 vCPU

✓ 能识别 >=2 GB RAM

✓ 能识别 >=15 GB SSD/NVMe

✓ 能识别 Dedicated IPv4

✓ 能区分 NAT IPv4

✓ 能计算年付价格

✓ 能应用 <$20 条件

✓ 能应用 PTR <$25 条件

✓ 能检查 Location

✓ 能打开供应商实时页面

✓ 能检查实际 Checkout

✓ 搜索缓存不能触发通知

✓ Checkout 失败不能通知

✓ 售罄不能通知

✓ 重复库存不能重复通知

✓ 补货可以重新通知

✓ 数据写入 Supabase

✓ 邮件通知正常

✓ Dashboard 显示 Last Check
```

---

# 88. 最重要的开发原则

整个项目最关键的一句话：

> **宁愿漏报，也不要误报。**

因为 VPS Hunter 的价值不是：

```text
收集最多 VPS
```

而是：

```text
收到通知
↓
点进去
↓
真的可以买
```

如果连续出现：

```text
价格过期
优惠码失效
机房没库存
IPv4 要额外收费
Checkout 不存在
```

用户很快就不会再相信通知。

因此：

```text
Discovery
≠
Verification
```

必须在架构层面完全分开。

---

# 89. 推荐最终部署结构

生产环境最终推荐：

```text
GitHub
│
├── Repository
│
└── GitHub Actions
      │
      │ 每小时
      ▼
Monitor
│
├── LowEndSpirit
├── LowEndTalk
├── Provider Monitor
└── Playwright
      │
      ▼
Supabase
│
├── Providers
├── Plans
├── Checks
├── Price History
├── Notifications
└── Monitor Runs
      │
      ├───────────────┐
      ▼               ▼
    Vercel          Resend
      │               │
      ▼               ▼
 Dashboard          Email
```

---

# 90. 费用控制

这个设计的一个好处是 MVP 可以非常便宜地运行。

Vercel 只运行 Dashboard，而不是持续抓取器；当前 Vercel Hobby 对 Cron 有每日一次的限制，因此让 GitHub Actions 承担小时级调度更合适。

Supabase 用于 PostgreSQL，前端查询通过 RLS 控制；管理密钥只保留在 CI / Server 环境。

浏览器自动化则只在确实需要 JS Checkout 的供应商上启动 Chromium，不需要每一个页面都使用 Playwright。

---

# 91. 推荐的第一阶段目标

不要先做漂亮网站。

第一阶段真正应该完成的是：

```text
一个供应商
↓
发现产品
↓
读取配置
↓
进入 Checkout
↓
核实库存
↓
核实 IPv4
↓
核实最终价格
↓
Rules Engine
↓
Supabase
↓
Email
```

只要这一条链路跑通：

**VPS Hunter 就已经活了。**

之后增加 ByteVirt、DediRock、CloudCone 或其他供应商，本质上只是在：

```text
monitors/providers/
```

增加新的 Adapter。

---

# 92. 推荐第一个 Milestone

## VPS Hunter v0.1

功能：

```text
Next.js Dashboard

Supabase Database

GitHub Actions hourly

Rules Engine

Provider Adapter API

1 real Provider monitor

Checkout verification

Dedicated IPv4 verification

Stock state tracking

Deduplication

Email alert

Monitor heartbeat
```

完成 v0.1 以后，再进入：

## v0.2

```text
LowEndSpirit discovery

LowEndTalk discovery

5+ Provider adapters

PTR database

SMTP 25 policy

Price history
```

之后：

## v0.3

```text
Telegram

Admin settings

Reliability score

Confidence score

Stock history

Price charts
```

---

# 93. 最终建议

这个项目里，真正困难的部分只有一个：

**Provider Adapter。**

Next.js、Supabase、GitHub Actions、Resend 都属于标准工程。

真正需要长期维护的是：

```text
ByteVirt parser
CloudCone parser
DediRock parser
HostDare parser
...
```

供应商网页会变，所以每一家 Monitor 都必须：

```text
独立
可测试
可禁用
可查看错误
```

不要让某一家供应商页面改变以后把整个 VPS Hunter 搞挂。

---

# 94. 最终技术决策

第一版正式采用：

```text
Frontend
Next.js + Vercel

Database
Supabase PostgreSQL

Scheduler
GitHub Actions

Crawler
Node fetch + Cheerio

Browser Verification
Playwright Chromium

Validation
Zod

Notification
Resend

Language
TypeScript

Architecture
Provider Adapter Pattern
```

其中最重要的基础设施决策是 **GitHub Actions 负责小时级监测，Vercel 负责 Web 应用**。目前 GitHub scheduled workflows 支持 5 分钟级最短调度，而 Vercel Hobby Cron 限制为每日一次，因此这个分工更适合当前项目。

按照这份指南开发完成后，你得到的就不是一个“抓 VPS 优惠的脚本”，而是一套可以长期运行、能够追踪库存和历史价格、并且强调 **实际 Checkout 验证** 的 VPS 监测系统。