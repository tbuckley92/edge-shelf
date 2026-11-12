-- Additive display-level settings; existing owner policies and grants apply.
alter table shelf.layouts add column atmosphere jsonb not null default '{}'::jsonb check (jsonb_typeof(atmosphere)='object');
