-- ============ Fix: profiles RLS infinite recursion ============
-- The old "admins read all profiles" policy queried profiles inside its
-- USING clause, which re-triggers RLS on profiles -> infinite recursion.
--
-- Fix: introduce a security definer function that reads roles without
-- triggering RLS, and reference it from the policy.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Drop the recursive policy and recreate it using the helper.
drop policy if exists "admins read all profiles" on profiles;

create policy "admins read all profiles"
  on profiles for select
  using (public.is_admin());
