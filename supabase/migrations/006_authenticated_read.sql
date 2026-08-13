-- ============ Restrict dashboard tables to authenticated users ============
-- Requires Supabase Auth. Anonymous users can no longer read deal data;
-- only logged-in (approved) users and admins can.

drop policy if exists "public read plans" on plans;
drop policy if exists "public read providers" on providers;
drop policy if exists "public read checks" on checks;
drop policy if exists "public read price_history" on price_history;
drop policy if exists "public read monitor_runs" on monitor_runs;
drop policy if exists "public read discovery_items" on discovery_items;

-- Any authenticated user may read plans (browsing the dashboard).
create policy "authenticated read plans"
  on plans for select
  to authenticated
  using (true);

create policy "authenticated read providers"
  on providers for select
  to authenticated
  using (true);

create policy "authenticated read checks"
  on checks for select
  to authenticated
  using (true);

create policy "authenticated read price_history"
  on price_history for select
  to authenticated
  using (true);

create policy "authenticated read monitor_runs"
  on monitor_runs for select
  to authenticated
  using (true);

create policy "authenticated read discovery_items"
  on discovery_items for select
  to authenticated
  using (true);
