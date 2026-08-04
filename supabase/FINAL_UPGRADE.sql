-- Run this once in Supabase SQL Editor after the original schema.sql.

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  gst_rate numeric(6,2) not null default 18,
  wht_rate numeric(6,2) not null default 5,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, gst_rate, wht_rate)
values (1, 18, 5)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Authenticated users can read settings" on public.app_settings;
create policy "Authenticated users can read settings"
on public.app_settings for select
to authenticated
using (true);

drop policy if exists "Admins can update settings" on public.app_settings;
create policy "Admins can update settings"
on public.app_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Keep updated_at current.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sales_records_touch_updated_at on public.sales_records;
create trigger sales_records_touch_updated_at
before update on public.sales_records
for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
before update on public.app_settings
for each row execute function public.touch_updated_at();