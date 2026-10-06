-- NAV Online Számla v1
-- Stores technical-user credentials only as AES-GCM ciphertext.
-- Invoice digests are normalized into the existing invoices table.

create table if not exists nav_integrations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references households(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  tax_number text not null,
  credentials_cipher jsonb not null,
  last_sync_at timestamptz,
  last_sync_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table invoices add column if not exists currency text not null default 'HUF';
alter table invoices add column if not exists customer_tax_number text;
alter table invoices add column if not exists invoice_category text;
alter table invoices add column if not exists payment_method text;
alter table invoices add column if not exists invoice_appearance text;
alter table invoices add column if not exists invoice_operation text;
alter table invoices add column if not exists original_invoice_number text;
alter table invoices add column if not exists payment_date date;
alter table invoices add column if not exists invoice_delivery date;
alter table invoices add column if not exists nav_source text;
alter table invoices add column if not exists transaction_id text;
alter table invoices add column if not exists transaction_index integer;

create index if not exists invoices_customer_idx
  on invoices(business_id, partner_name);

create index if not exists invoices_nav_operation_idx
  on invoices(business_id, invoice_operation, issue_date desc);
