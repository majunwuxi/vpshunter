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
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into profiles (id, email, role, approved_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'email', new.email, ''),
    case
      when not exists (select 1 from profiles) then 'admin'
      else 'pending'
    end,
    case
      when not exists (select 1 from profiles) then now()
      else null
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

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
