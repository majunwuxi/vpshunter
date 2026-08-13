-- ============ Supabase Auth profiles ============
-- role: 'admin' (first registrant) | 'pending' (awaiting approval) | 'user' (approved)

create table profiles (
  id uuid primary key references auth.users(id)
    on delete cascade,

  email text not null,
  role text not null default 'pending'
    check (role in ('admin', 'pending', 'user')),

  created_at timestamptz default now(),
  approved_at timestamptz
);

-- Auto-create a profile on signup. The very first user becomes admin;
-- everyone after starts as pending (requires admin approval).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _email text := coalesce(new.raw_user_meta_data->>'email', new.email, '');
  _is_first boolean;
begin
  select not exists (select 1 from public.profiles)
    into _is_first;

  insert into public.profiles (id, email, role, approved_at)
  values (
    new.id,
    _email,
    case when _is_first then 'admin' else 'pending' end,
    case when _is_first then now() else null end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS ============
alter table profiles enable row level security;

-- A user can read their own profile.
create policy "read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Users cannot edit roles directly; an admin does it via the service role
-- (or a dedicated function). No public INSERT/UPDATE/DELETE policies:
-- the trigger creates the row, and approval happens server-side.

-- Admins may read all profiles (for the approval screen).
create policy "admins read all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
