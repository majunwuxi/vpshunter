-- Auto-discovered WHMCS providers (from forum leads whose official site
-- is a WHMCS store reachable over HTTP). These join monitoring automatically.

create table auto_providers (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,
  name text not null,

  base_url text not null,
  categories jsonb not null default '["/index.php/store/"]',

  user_agent text,

  -- The discovery lead (forum thread) that produced this provider.
  source_url text,

  enabled boolean default true,

  first_seen_at timestamptz default now(),
  last_verified_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table auto_providers
  enable row level security;

create policy "authenticated read auto_providers"
  on auto_providers for select
  to authenticated
  using (true);

create policy "admins write auto_providers"
  on auto_providers for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
