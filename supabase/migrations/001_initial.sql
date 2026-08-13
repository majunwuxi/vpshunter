create extension if not exists pgcrypto;

create table providers (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,
  name text not null,

  homepage_url text,

  reliability_score integer default 50,

  rdns_policy text,
  smtp25_policy text,

  priority integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table plans (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid references providers(id)
    on delete cascade,

  external_id text unique,

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

create index plans_provider_idx on plans(provider_id);
create index plans_region_idx on plans(location);
create index plans_price_idx on plans(price_usd_year);

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

create index checks_plan_idx on checks(plan_id);
create index checks_checked_at_idx on checks(checked_at);

create table price_history (
  id uuid primary key default gen_random_uuid(),

  plan_id uuid references plans(id)
    on delete cascade,

  price numeric,

  currency text,

  price_usd_year numeric,

  recorded_at timestamptz default now()
);

create index price_history_plan_idx on price_history(plan_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),

  plan_id uuid references plans(id)
    on delete cascade,

  channel text,

  notification_hash text unique,

  status text,

  sent_at timestamptz default now()
);

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

create index monitor_runs_started_at_idx
  on monitor_runs(started_at);

alter table providers
  enable row level security;

alter table plans
  enable row level security;

alter table locations
  enable row level security;

alter table checks
  enable row level security;

alter table price_history
  enable row level security;

alter table notifications
  enable row level security;

alter table discovery_items
  enable row level security;

alter table monitor_runs
  enable row level security;

create policy "public read plans"
  on plans
  for select
  using (true);

create policy "public read providers"
  on providers
  for select
  using (true);

create policy "public read checks"
  on checks
  for select
  using (true);

create policy "public read price_history"
  on price_history
  for select
  using (true);

create policy "public read monitor_runs"
  on monitor_runs
  for select
  using (true);

create policy "public read discovery_items"
  on discovery_items
  for select
  using (true);