create table provider_adapter_progress (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status text not null default 'discovered'
    check (status in ('discovered', 'analyzing', 'parser_ready', 'checkout_testing', 'enabled', 'blocked')),
  progress integer not null default 0
    check (progress >= 0 and progress <= 100),
  official_url text,
  note text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table provider_adapter_progress enable row level security;

create policy "authenticated read adapter progress"
  on provider_adapter_progress for select
  to authenticated
  using (true);

create policy "admins write adapter progress"
  on provider_adapter_progress for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

insert into provider_adapter_progress
  (slug, name, status, progress, note)
values
  ('hostdare', 'HostDare', 'discovered', 10, '已从论坛线索发现，待分析官网与 Checkout'),
  ('crowncloud', 'CrownCloud', 'discovered', 10, '已从论坛线索发现，待分析自定义商城'),
  ('smokyhosts', 'SmokyHosts', 'discovered', 10, '已从论坛线索发现，待确认 VPS 产品页'),
  ('kuroit', 'KuroIT', 'discovered', 10, '已从论坛线索发现，待处理 Cloudflare/商城结构'),
  ('georgedatacenter', 'George Datacenter', 'blocked', 5, '当前页面主要是专用服务器，暂未确认 VPS 商品结构')
on conflict (slug) do nothing;
