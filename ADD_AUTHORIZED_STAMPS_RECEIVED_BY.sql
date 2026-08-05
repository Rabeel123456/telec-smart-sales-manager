-- AUTHORIZED STAMPS + RECEIVED BY UPDATE
-- Run once in Supabase SQL Editor.

create table if not exists public.authorized_signatories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  signatory_name text not null,
  designation text not null,
  signature_url text,
  stamp_url text,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.authorized_signatories enable row level security;
drop policy if exists "Authenticated users can view authorized signatories" on public.authorized_signatories;
create policy "Authenticated users can view authorized signatories" on public.authorized_signatories for select to authenticated using (true);
drop policy if exists "Admins can manage authorized signatories" on public.authorized_signatories;
create policy "Admins can manage authorized signatories" on public.authorized_signatories for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('document-stamps','document-stamps',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view document stamps" on storage.objects;
create policy "Public can view document stamps" on storage.objects for select using (bucket_id='document-stamps');
drop policy if exists "Admins can upload document stamps" on storage.objects;
create policy "Admins can upload document stamps" on storage.objects for insert to authenticated with check (bucket_id='document-stamps' and public.is_admin());
drop policy if exists "Admins can update document stamps" on storage.objects;
create policy "Admins can update document stamps" on storage.objects for update to authenticated using (bucket_id='document-stamps' and public.is_admin()) with check (bucket_id='document-stamps' and public.is_admin());
drop policy if exists "Admins can delete document stamps" on storage.objects;
create policy "Admins can delete document stamps" on storage.objects for delete to authenticated using (bucket_id='document-stamps' and public.is_admin());

alter table public.quotations add column if not exists authorized_signatory_id uuid references public.authorized_signatories(id) on delete set null;
alter table public.quotations add column if not exists receiver_name text;
alter table public.quotations add column if not exists receiver_designation text;
alter table public.quotations add column if not exists received_date date;

alter table public.delivery_challans add column if not exists authorized_signatory_id uuid references public.authorized_signatories(id) on delete set null;
alter table public.delivery_challans add column if not exists receiver_designation text;
alter table public.delivery_challans add column if not exists received_date date;

alter table public.invoices add column if not exists authorized_signatory_id uuid references public.authorized_signatories(id) on delete set null;
alter table public.invoices add column if not exists receiver_name text;
alter table public.invoices add column if not exists receiver_designation text;
alter table public.invoices add column if not exists received_date date;

insert into public.authorized_signatories (signatory_name,designation,active,is_default)
select 'Mirza Samad Saqlain','CEO',true,true
where not exists (select 1 from public.authorized_signatories);
