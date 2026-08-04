-- MULTI-COMPANY LETTERHEAD UPDATE
-- Run once in Supabase SQL Editor.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  short_name text not null,
  letterhead_url text,
  quotation_prefix text not null default 'QT',
  delivery_prefix text not null default 'DC',
  invoice_prefix text not null default 'INV',
  top_margin_mm numeric(6,2) not null default 55,
  bottom_margin_mm numeric(6,2) not null default 18,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

drop policy if exists "Authenticated users can view companies" on public.companies;
create policy "Authenticated users can view companies"
on public.companies for select to authenticated using (true);

drop policy if exists "Admins can insert companies" on public.companies;
create policy "Admins can insert companies"
on public.companies for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update companies" on public.companies;
create policy "Admins can update companies"
on public.companies for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete companies" on public.companies;
create policy "Admins can delete companies"
on public.companies for delete to authenticated using (public.is_admin());

alter table public.quotations add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.delivery_challans add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.invoices add column if not exists company_id uuid references public.companies(id) on delete set null;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('company-letterheads','company-letterheads',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view company letterheads" on storage.objects;
create policy "Public can view company letterheads"
on storage.objects for select using (bucket_id='company-letterheads');

drop policy if exists "Admins can upload company letterheads" on storage.objects;
create policy "Admins can upload company letterheads"
on storage.objects for insert to authenticated
with check (bucket_id='company-letterheads' and public.is_admin());

drop policy if exists "Admins can update company letterheads" on storage.objects;
create policy "Admins can update company letterheads"
on storage.objects for update to authenticated
using (bucket_id='company-letterheads' and public.is_admin())
with check (bucket_id='company-letterheads' and public.is_admin());

drop policy if exists "Admins can delete company letterheads" on storage.objects;
create policy "Admins can delete company letterheads"
on storage.objects for delete to authenticated
using (bucket_id='company-letterheads' and public.is_admin());

insert into public.companies (company_name,short_name,quotation_prefix,delivery_prefix,invoice_prefix)
select * from (values
 ('TELEC Group of Companies','TELEC Group','TGC-QT','TGC-DO','TGC-INV'),
 ('Telec Electronics & Machinery (PVT) LTD.','TEM','TEM-QT','TEM-DO','TEM-INV'),
 ('Trade Linker Electronics Machinery (PVT) LTD','TLEM','TLEM-QT','TLEM-DO','TLEM-INV')
) as v(company_name,short_name,quotation_prefix,delivery_prefix,invoice_prefix)
where not exists (select 1 from public.companies);
