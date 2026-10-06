-- Documents v2: group front/back photos into one logical document.
-- Tested first on Neon branch documents-v2-schema-test.

alter table documents add column if not exists document_group_id uuid;

update documents
set document_group_id=gen_random_uuid()
where document_group_id is null;

alter table documents
  alter column document_group_id set not null;

alter table documents
  alter column document_group_id set default gen_random_uuid();

alter table documents
  add column if not exists side text not null default 'front';

alter table documents
  drop constraint if exists documents_side_check;

alter table documents
  add constraint documents_side_check
  check (side in ('front','back'));

create index if not exists documents_group_idx
  on documents(document_group_id, side);
