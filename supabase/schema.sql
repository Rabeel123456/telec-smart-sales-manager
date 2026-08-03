create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text not null default '',role text not null default 'sales' check(role in('admin','sales')),active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.sales_records(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,customer_name text not null,quotation_date date not null,purchase_value numeric(18,2) not null default 0,item text not null,sales_value_ex_gst numeric(18,2) not null default 0,vendor text,vendor_terms text,quotation_status text not null default 'Pending',probability integer not null default 75 check(probability between 0 and 100),remarks text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.profiles(id,full_name,role,active) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'role','sales'),true);return new;end;$$;
drop trigger if exists on_auth_user_created on auth.users;create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true);$$;
alter table public.profiles enable row level security;alter table public.sales_records enable row level security;
create policy "Users can read own profile" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "Admins can update profiles" on public.profiles for update using(public.is_admin()) with check(public.is_admin());
create policy "Read own sales or all for admin" on public.sales_records for select using(user_id=auth.uid() or public.is_admin());
create policy "Insert own sales or admin" on public.sales_records for insert with check(user_id=auth.uid() or public.is_admin());
create policy "Update own sales or admin" on public.sales_records for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "Delete own sales or admin" on public.sales_records for delete using(user_id=auth.uid() or public.is_admin());
-- After creating first auth user, make admin:
-- update public.profiles set role='admin',full_name='Rabeel Ahmed' where id=(select id from auth.users where email='USER_EMAIL');
