-- ============ Dynamic monitor rules ============
-- Single-row configuration editable from the web (admin). The monitor
-- and the dashboard both read this table; it overrides config/rules.ts.

create table monitor_rules (
  id integer primary key default 1,
  check (id = 1),

  preferred_regions jsonb not null default '["JP","KR","HK","SG"]',

  min_vcpu integer not null default 2,
  min_ram_mb integer not null default 2048,
  min_storage_gb numeric not null default 15,

  require_solid_state boolean not null default true,
  require_dedicated_ipv4 boolean not null default true,

  standard_max_usd_year numeric not null default 20,
  rdns_max_usd_year numeric not null default 25,

  price_buffer_usd numeric not null default 0.25,

  updated_at timestamptz default now()
);

-- Seed the default row so the app has something to read.
insert into monitor_rules (id)
values (1)
on conflict (id) do nothing;

alter table monitor_rules
  enable row level security;

-- Admins read/write rules; regular users may read them if needed
-- (used by the dashboard to filter). Keep read open to authenticated.
create policy "authenticated read monitor_rules"
  on monitor_rules for select
  to authenticated
  using (true);

-- Only admins may update rules.
create policy "admins update monitor_rules"
  on monitor_rules for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
