-- Run once in Supabase SQL Editor after previous project SQL files.
-- Professional sequence: Quotation -> Delivery Challan -> Invoice -> Sales Pipeline closed as Won.

alter table public.sales_records
  add column if not exists closing_date date;

alter table public.quotations
  add column if not exists customer_name text,
  add column if not exists item text,
  add column if not exists purchase_value numeric(18,2) not null default 0,
  add column if not exists sales_value_ex_gst numeric(18,2) not null default 0,
  add column if not exists vendor text not null default '',
  add column if not exists vendor_terms text not null default '',
  add column if not exists probability integer not null default 75 check (probability between 0 and 100);

alter table public.delivery_challans
  add column if not exists quotation_id uuid references public.quotations(id) on delete restrict,
  add column if not exists customer_name text,
  add column if not exists item text,
  add column if not exists purchase_value numeric(18,2) not null default 0,
  add column if not exists sales_value_ex_gst numeric(18,2) not null default 0,
  add column if not exists vendor text not null default '',
  add column if not exists vendor_terms text not null default '',
  add column if not exists probability integer not null default 75 check (probability between 0 and 100);

alter table public.invoices
  add column if not exists quotation_id uuid references public.quotations(id) on delete restrict,
  add column if not exists delivery_challan_id uuid references public.delivery_challans(id) on delete restrict,
  add column if not exists customer_name text,
  add column if not exists item text,
  add column if not exists purchase_value numeric(18,2) not null default 0,
  add column if not exists sales_value_ex_gst numeric(18,2) not null default 0,
  add column if not exists vendor text not null default '',
  add column if not exists vendor_terms text not null default '',
  add column if not exists probability integer not null default 100 check (probability between 0 and 100);

-- Backfill old document rows from their related sales opportunity.
update public.quotations q set
  customer_name = coalesce(q.customer_name, s.customer_name),
  item = coalesce(q.item, s.item),
  purchase_value = coalesce(q.purchase_value, s.purchase_value),
  sales_value_ex_gst = coalesce(q.sales_value_ex_gst, s.sales_value_ex_gst),
  vendor = coalesce(nullif(q.vendor,''), s.vendor, ''),
  vendor_terms = coalesce(nullif(q.vendor_terms,''), s.vendor_terms, ''),
  probability = coalesce(q.probability, s.probability)
from public.sales_records s where q.opportunity_id = s.id;

update public.delivery_challans d set
  customer_name = coalesce(d.customer_name, s.customer_name),
  item = coalesce(d.item, s.item),
  purchase_value = coalesce(d.purchase_value, s.purchase_value),
  sales_value_ex_gst = coalesce(d.sales_value_ex_gst, s.sales_value_ex_gst),
  vendor = coalesce(nullif(d.vendor,''), s.vendor, ''),
  vendor_terms = coalesce(nullif(d.vendor_terms,''), s.vendor_terms, ''),
  probability = coalesce(d.probability, s.probability)
from public.sales_records s where d.opportunity_id = s.id;

update public.invoices i set
  customer_name = coalesce(i.customer_name, s.customer_name),
  item = coalesce(i.item, s.item),
  purchase_value = coalesce(i.purchase_value, s.purchase_value),
  sales_value_ex_gst = coalesce(i.sales_value_ex_gst, s.sales_value_ex_gst),
  vendor = coalesce(nullif(i.vendor,''), s.vendor, ''),
  vendor_terms = coalesce(nullif(i.vendor_terms,''), s.vendor_terms, ''),
  probability = coalesce(i.probability, 100)
from public.sales_records s where i.opportunity_id = s.id;
