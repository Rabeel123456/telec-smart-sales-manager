-- TELEC Smart Sales Manager
-- Add salesperson targets, Delivery Challan closure reporting, and direct invoices.
-- Safe to run more than once.

create table if not exists public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_year integer not null,
  target_month integer not null check (target_month between 1 and 12),
  monthly_target numeric(18,2) not null default 0,
  yearly_target numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, target_year, target_month)
);

alter table public.sales_targets enable row level security;

drop policy if exists "Users read own targets or admin all" on public.sales_targets;
create policy "Users read own targets or admin all"
on public.sales_targets for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own targets or admin all" on public.sales_targets;
create policy "Users insert own targets or admin all"
on public.sales_targets for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users update own targets or admin all" on public.sales_targets;
create policy "Users update own targets or admin all"
on public.sales_targets for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop trigger if exists sales_targets_touch_updated_at on public.sales_targets;
create trigger sales_targets_touch_updated_at
before update on public.sales_targets
for each row execute function public.touch_updated_at();

alter table public.invoices
  add column if not exists invoice_source text not null default 'delivery'
    check (invoice_source in ('delivery','direct'));

-- Delivery challan is optional for a direct invoice.
alter table public.invoices alter column delivery_challan_id drop not null;
