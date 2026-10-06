-- Személyes Központ — Neon schema draft v1
-- PostgreSQL schema only. Apply later through a tested Neon migration.
-- Auth is handled by Neon Managed Better Auth; user IDs are stored as text.
-- The browser NEVER connects directly to Postgres.

create extension if not exists pgcrypto;

create type household_role as enum ('owner','family','accountant');
create type document_kind as enum (
  'identity','address','tax','health','student','teacher',
  'vehicle','insurance','contract','shopping_card','other'
);
create type deadline_status as enum ('open','done','dismissed');
create type invoice_status as enum ('issued','paid','overdue','cancelled');

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id text not null,
  created_at timestamptz not null default now()
);

create table household_memberships (
  household_id uuid not null references households(id) on delete cascade,
  user_id text not null,
  role household_role not null,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (household_id,user_id)
);

create index household_memberships_user_idx
  on household_memberships(user_id);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  linked_user_id text,
  display_name text not null,
  relation text,
  birth_date date,
  created_at timestamptz not null default now()
);

create index family_members_household_idx
  on family_members(household_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  family_member_id uuid not null references family_members(id) on delete cascade,
  kind document_kind not null default 'other',
  title text not null,
  storage_bucket text not null default 'personal-documents',
  storage_key text not null,
  issue_date date,
  expiry_date date,
  document_number_encrypted text,
  note text,
  created_by_user_id text not null,
  created_at timestamptz not null default now()
);

create index documents_member_idx
  on documents(family_member_id, created_at desc);

create index documents_expiry_idx
  on documents(expiry_date)
  where expiry_date is not null;

create table businesses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  tax_number_encrypted text,
  tax_mode text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source text not null default 'manual',
  external_id text,
  invoice_number text,
  partner_name text,
  issue_date date not null,
  due_date date,
  paid_at date,
  net_amount_huf bigint,
  vat_amount_huf bigint,
  gross_amount_huf bigint not null,
  status invoice_status not null default 'issued',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, source, external_id)
);

create index invoices_period_idx
  on invoices(business_id, issue_date desc);

create index invoices_status_idx
  on invoices(business_id, status);

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  family_member_id uuid references family_members(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  title text not null,
  category text not null,
  due_at timestamptz not null,
  amount_huf bigint,
  status deadline_status not null default 'open',
  source text,
  reminder_offsets_days integer[] not null default '{30,7,1,0}',
  created_at timestamptz not null default now()
);

create index deadlines_due_idx
  on deadlines(household_id, due_at)
  where status = 'open';

create table notification_targets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id text,
  label text not null,
  email text,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  categories text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  family_member_id uuid references family_members(id) on delete set null,
  label text not null,
  plate_encrypted text,
  technical_expiry date,
  insurance_expiry date,
  created_at timestamptz not null default now()
);

create table bank_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  source text not null,
  period_start date,
  period_end date,
  imported_by_user_id text not null,
  imported_at timestamptz not null default now()
);

create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  import_id uuid references bank_imports(id) on delete set null,
  external_id text,
  booked_at date not null,
  amount_huf bigint not null,
  merchant text,
  description text,
  category text,
  is_business boolean not null default false,
  created_at timestamptz not null default now()
);

create index bank_transactions_period_idx
  on bank_transactions(household_id, booked_at desc);

-- The server never stores plaintext Vault entries.
create table vault_blobs (
  owner_user_id text primary key,
  cipher_payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Audit trail for sensitive operations. Do not store secret values here.
create table audit_log (
  id bigserial primary key,
  household_id uuid references households(id) on delete cascade,
  actor_user_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  created_at timestamptz not null default now()
);

create index audit_log_household_idx
  on audit_log(household_id, created_at desc);
