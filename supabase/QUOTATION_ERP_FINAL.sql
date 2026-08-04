-- TELEC Smart Sales Manager: professional Quotation -> Delivery Challan -> Invoice workflow
-- Safe to run more than once after previous SQL updates.

alter table public.app_settings
  add column if not exists company_ntn text not null default '',
  add column if not exists company_strn text not null default '',
  add column if not exists company_website text not null default '',
  add column if not exists company_footer_left text not null default '',
  add column if not exists company_footer_right text not null default '',
  add column if not exists quotation_default_validity text not null default '15 days from date of issue',
  add column if not exists quotation_default_payment_terms text not null default '',
  add column if not exists quotation_intro_text text not null default 'In response to your request, we are pleased to submit our quotation as below.';

alter table public.quotations
  add column if not exists contact_person text not null default '',
  add column if not exists customer_address text not null default '',
  add column if not exists subject text not null default '',
  add column if not exists validity text not null default '',
  add column if not exists payment_terms text not null default '',
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(18,2) not null default 0,
  add column if not exists gst_amount numeric(18,2) not null default 0,
  add column if not exists grand_total numeric(18,2) not null default 0;

alter table public.delivery_challans
  add column if not exists contact_person text not null default '',
  add column if not exists customer_address text not null default '',
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(18,2) not null default 0,
  add column if not exists gst_amount numeric(18,2) not null default 0,
  add column if not exists grand_total numeric(18,2) not null default 0,
  add column if not exists receiver_name text not null default '',
  add column if not exists receiver_contact text not null default '';

alter table public.invoices
  add column if not exists contact_person text not null default '',
  add column if not exists customer_address text not null default '',
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(18,2) not null default 0,
  add column if not exists gst_amount numeric(18,2) not null default 0,
  add column if not exists grand_total numeric(18,2) not null default 0;

-- Convert legacy one-item quotations to the new item array when needed.
update public.quotations
set items = jsonb_build_array(jsonb_build_object(
  'description', coalesce(item,''), 'qty', 1, 'rate', coalesce(sales_value_ex_gst,0),
  'gst_rate', 18, 'gst_amount', round(coalesce(sales_value_ex_gst,0) * 0.18, 2),
  'total', round(coalesce(sales_value_ex_gst,0) * 1.18, 2),
  'purchase_rate', coalesce(purchase_value,0)
))
where jsonb_array_length(items)=0 and coalesce(item,'')<>'';

update public.quotations set
  subtotal = coalesce(sales_value_ex_gst,0),
  gst_amount = round(coalesce(sales_value_ex_gst,0) * 0.18,2),
  grand_total = round(coalesce(sales_value_ex_gst,0) * 1.18,2)
where subtotal=0 and coalesce(sales_value_ex_gst,0)<>0;
