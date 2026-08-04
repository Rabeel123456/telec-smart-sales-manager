-- Run this file once in Supabase SQL Editor.

alter table public.app_settings
  add column if not exists company_name text not null default 'TELEC GROUP',
  add column if not exists company_logo_url text not null default '',
  add column if not exists company_address text not null default '',
  add column if not exists company_phone text not null default '',
  add column if not exists company_email text not null default '',
  add column if not exists quotation_prefix text not null default 'QT',
  add column if not exists delivery_prefix text not null default 'DC',
  add column if not exists invoice_prefix text not null default 'INV',
  add column if not exists quotation_footer text not null default '',
  add column if not exists delivery_footer text not null default '',
  add column if not exists invoice_footer text not null default '';

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  opportunity_id uuid not null references public.sales_records(id) on delete cascade,
  document_no text not null unique, document_date date not null, status text not null default 'Draft', remarks text default '', created_at timestamptz not null default now()
);
create table if not exists public.delivery_challans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  opportunity_id uuid not null references public.sales_records(id) on delete cascade,
  document_no text not null unique, document_date date not null, status text not null default 'Draft', remarks text default '', created_at timestamptz not null default now()
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  opportunity_id uuid not null references public.sales_records(id) on delete cascade,
  document_no text not null unique, document_date date not null, status text not null default 'Draft', remarks text default '', created_at timestamptz not null default now()
);
create table if not exists public.sales_visit_reports (
  id uuid primary key default gen_random_uuid(), person_id uuid not null references public.profiles(id),
  visit_date date not null, client text not null, city text not null, mode text not null,
  location text not null, objective text not null, status text not null, remarks text default '', created_at timestamptz not null default now()
);

alter table public.quotations enable row level security;
alter table public.delivery_challans enable row level security;
alter table public.invoices enable row level security;
alter table public.sales_visit_reports enable row level security;

-- Own records for sales users; all records for Admin.
do $$
declare t text;
begin
  foreach t in array array['quotations','delivery_challans','invoices'] loop
    execute format('drop policy if exists "read own or admin" on public.%I',t);
    execute format('create policy "read own or admin" on public.%I for select using (user_id=auth.uid() or public.is_admin())',t);
    execute format('drop policy if exists "insert own or admin" on public.%I',t);
    execute format('create policy "insert own or admin" on public.%I for insert with check (user_id=auth.uid() or public.is_admin())',t);
    execute format('drop policy if exists "update own or admin" on public.%I',t);
    execute format('create policy "update own or admin" on public.%I for update using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin())',t);
    execute format('drop policy if exists "delete own or admin" on public.%I',t);
    execute format('create policy "delete own or admin" on public.%I for delete using (user_id=auth.uid() or public.is_admin())',t);
  end loop;
end $$;

drop policy if exists "visit read own or admin" on public.sales_visit_reports;
create policy "visit read own or admin" on public.sales_visit_reports for select using (person_id=auth.uid() or public.is_admin());
drop policy if exists "visit insert own or admin" on public.sales_visit_reports;
create policy "visit insert own or admin" on public.sales_visit_reports for insert with check (person_id=auth.uid() or public.is_admin());
drop policy if exists "visit update own or admin" on public.sales_visit_reports;
create policy "visit update own or admin" on public.sales_visit_reports for update using (person_id=auth.uid() or public.is_admin()) with check (person_id=auth.uid() or public.is_admin());
drop policy if exists "visit delete own or admin" on public.sales_visit_reports;
create policy "visit delete own or admin" on public.sales_visit_reports for delete using (person_id=auth.uid() or public.is_admin());
