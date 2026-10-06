-- Személyes Központ — Supabase schema draft v1
-- Prepared for a future dedicated Supabase project.
-- No real personal data belongs in this repository.

create extension if not exists pgcrypto;

create type public.household_role as enum ('owner','family','accountant');
create type public.document_kind as enum ('identity','address','tax','health','student','teacher','vehicle','insurance','contract','other');
create type public.deadline_status as enum ('open','done','dismissed');
create type public.invoice_status as enum ('issued','paid','overdue','cancelled');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_memberships (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_role not null default 'family',
  created_at timestamptz not null default now(),
  primary key (household_id,user_id)
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  relation text,
  is_login_user boolean not null default false,
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  kind public.document_kind not null default 'other',
  title text not null,
  storage_path text not null,
  issue_date date,
  expiry_date date,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete cascade,
  title text not null,
  category text not null,
  due_at timestamptz not null,
  amount_huf bigint,
  status public.deadline_status not null default 'open',
  source text,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  tax_number text,
  tax_mode text,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  invoice_number text,
  partner_name text,
  issue_date date not null,
  due_date date,
  paid_at date,
  gross_amount_huf bigint not null,
  net_amount_huf bigint,
  vat_amount_huf bigint,
  status public.invoice_status not null default 'issued',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (business_id, external_id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete set null,
  label text not null,
  plate text,
  technical_expiry date,
  insurance_expiry date,
  created_at timestamptz not null default now()
);

create table public.notification_targets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  email text,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  categories text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Ciphertext-only cloud sync for the client-side encrypted Vault.
create table public.vault_blobs (
  household_id uuid primary key references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  cipher_payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Authorization helper functions use invoker rights and only query membership rows.
create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_memberships hm
    where hm.household_id = target_household
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_household_role(target_household uuid, allowed_roles public.household_role[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_memberships hm
    where hm.household_id = target_household
      and hm.user_id = (select auth.uid())
      and hm.role = any(allowed_roles)
  );
$$;

alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
alter table public.family_members enable row level security;
alter table public.documents enable row level security;
alter table public.deadlines enable row level security;
alter table public.businesses enable row level security;
alter table public.invoices enable row level security;
alter table public.vehicles enable row level security;
alter table public.notification_targets enable row level security;
alter table public.vault_blobs enable row level security;

-- Explicit Data API grants are required by current Supabase defaults.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_memberships to authenticated;
grant select, insert, update, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.deadlines to authenticated;
grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.notification_targets to authenticated;
grant select, insert, update, delete on public.vault_blobs to authenticated;

create policy households_select on public.households for select to authenticated
using (public.is_household_member(id) or owner_user_id=(select auth.uid()));

create policy households_insert on public.households for insert to authenticated
with check (owner_user_id=(select auth.uid()));

create policy households_update on public.households for update to authenticated
using (owner_user_id=(select auth.uid()))
with check (owner_user_id=(select auth.uid()));

create policy memberships_select on public.household_memberships for select to authenticated
using (public.is_household_member(household_id));

create policy memberships_insert on public.household_memberships for insert to authenticated
with check (
  user_id=(select auth.uid())
  or public.has_household_role(household_id,array['owner']::public.household_role[])
);

create policy memberships_update on public.household_memberships for update to authenticated
using (public.has_household_role(household_id,array['owner']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner']::public.household_role[]));

create policy memberships_delete on public.household_memberships for delete to authenticated
using (
  user_id=(select auth.uid())
  or public.has_household_role(household_id,array['owner']::public.household_role[])
);

create policy family_select on public.family_members for select to authenticated
using (public.is_household_member(household_id));
create policy family_write on public.family_members for all to authenticated
using (public.has_household_role(household_id,array['owner','family']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner','family']::public.household_role[]));

create policy documents_select on public.documents for select to authenticated
using (public.is_household_member(household_id));
create policy documents_write on public.documents for all to authenticated
using (public.has_household_role(household_id,array['owner','family']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner','family']::public.household_role[]));

create policy deadlines_select on public.deadlines for select to authenticated
using (public.is_household_member(household_id));
create policy deadlines_write on public.deadlines for all to authenticated
using (public.has_household_role(household_id,array['owner','family','accountant']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner','family','accountant']::public.household_role[]));

create policy businesses_select on public.businesses for select to authenticated
using (public.is_household_member(household_id));
create policy businesses_write on public.businesses for all to authenticated
using (public.has_household_role(household_id,array['owner','accountant']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner','accountant']::public.household_role[]));

create policy invoices_select on public.invoices for select to authenticated
using (public.is_household_member(household_id));
create policy invoices_write on public.invoices for all to authenticated
using (public.has_household_role(household_id,array['owner','accountant']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner','accountant']::public.household_role[]));

create policy vehicles_select on public.vehicles for select to authenticated
using (public.is_household_member(household_id));
create policy vehicles_write on public.vehicles for all to authenticated
using (public.has_household_role(household_id,array['owner','family']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner','family']::public.household_role[]));

create policy notifications_select on public.notification_targets for select to authenticated
using (public.is_household_member(household_id));
create policy notifications_write on public.notification_targets for all to authenticated
using (public.has_household_role(household_id,array['owner']::public.household_role[]))
with check (public.has_household_role(household_id,array['owner']::public.household_role[]));

create policy vault_select on public.vault_blobs for select to authenticated
using (owner_user_id=(select auth.uid()));
create policy vault_insert on public.vault_blobs for insert to authenticated
with check (owner_user_id=(select auth.uid()));
create policy vault_update on public.vault_blobs for update to authenticated
using (owner_user_id=(select auth.uid()))
with check (owner_user_id=(select auth.uid()));
create policy vault_delete on public.vault_blobs for delete to authenticated
using (owner_user_id=(select auth.uid()));

-- Storage policy draft assumes a PRIVATE bucket named personal-documents.
-- Object path convention: <household_id>/<family_member_id>/<uuid>.<ext>
create policy documents_storage_select on storage.objects for select to authenticated
using (
  bucket_id='personal-documents'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
);

create policy documents_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='personal-documents'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','family']::public.household_role[])
);

create policy documents_storage_update on storage.objects for update to authenticated
using (
  bucket_id='personal-documents'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','family']::public.household_role[])
)
with check (
  bucket_id='personal-documents'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','family']::public.household_role[])
);

create policy documents_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id='personal-documents'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','family']::public.household_role[])
);
