-- Additive migration: existing identities, owned copies and layouts are preserved.
alter table shelf.profiles
 add column first_name text,
 add column last_name text,
 add column email text,
 add column phone text,
 add column country text check(country is null or country ~ '^[A-Z]{2}$'),
 add column avatar text not null default 'stone' check(avatar in ('stone','forest','ocean','sunset','plum','gold')),
 add column privacy jsonb not null default '{"nickname":false,"country":false,"collection":false,"level":false,"badges":false,"avatar":false}',
 add column profile_revision integer not null default 0;
alter table shelf.sessions add column customer_token text;

create table shelf.admin_roles (
 owner_id uuid not null references shelf.profiles(id) on delete cascade,
 role text not null check(role in ('admin')), granted_at timestamptz not null default now(),
 primary key(owner_id,role)
);
alter table shelf.admin_roles enable row level security;
alter table shelf.admin_roles force row level security;
grant select on shelf.admin_roles to shelf_backend;
create policy own_role on shelf.admin_roles for select to shelf_backend using(owner_id::text=current_setting('shelf.owner',true));

create function shelf.is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from shelf.admin_roles where owner_id::text=current_setting('shelf.owner',true) and role='admin');
$$;
revoke all on function shelf.is_admin() from public;
grant execute on function shelf.is_admin() to shelf_backend;

create table shelf.badge_definitions (
 key text primary key,label text not null,kind text not null check(kind in ('official','achievement')),
 permanent boolean not null default true,rule_version integer not null default 1,rule jsonb
);
insert into shelf.badge_definitions(key,label,kind,permanent) values('official_employee','Official Edge Employee','official',false);
create table shelf.user_badges (
 owner_id uuid not null references shelf.profiles(id) on delete cascade,
 badge_key text not null references shelf.badge_definitions(key),
 awarded_at timestamptz not null default now(),awarded_by uuid references shelf.profiles(id),revoked_at timestamptz,
 primary key(owner_id,badge_key)
);
create index user_badges_definition on shelf.user_badges(badge_key);
create index user_badges_actor on shelf.user_badges(awarded_by);
alter table shelf.badge_definitions enable row level security;
alter table shelf.user_badges enable row level security;
alter table shelf.badge_definitions force row level security;
alter table shelf.user_badges force row level security;
grant select on shelf.badge_definitions to shelf_backend;
grant select,insert,update on shelf.user_badges to shelf_backend;
create policy definitions_read on shelf.badge_definitions for select to shelf_backend using(true);
create policy badge_read on shelf.user_badges for select to shelf_backend using(
 owner_id::text=current_setting('shelf.owner',true) or shelf.is_admin() or
 (owner_id::text=current_setting('shelf.public_profile',true) and exists(select 1 from shelf.profiles p where p.id=owner_id and p.public_sharing and p.privacy->>'badges'='true'))
);
create policy badge_grant on shelf.user_badges for insert to shelf_backend with check(shelf.is_admin() and awarded_by::text=current_setting('shelf.owner',true));
create policy badge_revoke on shelf.user_badges for update to shelf_backend using(shelf.is_admin()) with check(shelf.is_admin());

create policy profile_public_read on shelf.profiles for select to shelf_backend using(public_sharing and id::text=current_setting('shelf.public_profile',true));
create policy profile_admin_read on shelf.profiles for select to shelf_backend using(shelf.is_admin());
create policy owned_public_read on shelf.owned_items for select to shelf_backend using(
 owner_id::text=current_setting('shelf.public_profile',true) and exists(select 1 from shelf.profiles p where p.id=owner_id and p.public_sharing and (p.privacy->>'collection'='true' or p.privacy->>'level'='true'))
);
create policy owned_admin_read on shelf.owned_items for select to shelf_backend using(shelf.is_admin());

create table shelf.audit_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid,owner_id uuid,
 action text not null,reason text,changes jsonb not null,created_at timestamptz not null default now()
);
create index audit_created on shelf.audit_events(created_at desc);
create index audit_owner on shelf.audit_events(owner_id,created_at desc);
alter table shelf.audit_events enable row level security;
alter table shelf.audit_events force row level security;
grant select,insert on shelf.audit_events to shelf_backend;
create policy audit_read on shelf.audit_events for select to shelf_backend using(shelf.is_admin());
create policy audit_append on shelf.audit_events for insert to shelf_backend with check(
 actor_id::text=current_setting('shelf.owner',true) or (actor_id is null and coalesce(current_setting('shelf.subject',true),'')<>'')
);
-- Trigger is invoker, uses the same constrained runtime role and cannot bypass RLS.
-- Contact changes record field names, not historic email/phone/name values.
create function shelf.audit_change() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_row jsonb;after_row jsonb;target uuid;actor uuid;changed jsonb;field text;
begin
 before_row=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_row=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 if before_row=after_row then return null; end if;
 target=coalesce(after_row->>'owner_id',before_row->>'owner_id',after_row->>'id',before_row->>'id')::uuid;
 actor=nullif(current_setting('shelf.owner',true),'')::uuid;
 changed='{}'::jsonb;
 if tg_table_name='profiles' then
  for field in select jsonb_object_keys(after_row||before_row) loop
   if field not in ('profile_revision','issuer','subject','shopify_customer_id','created_at') and before_row->field is distinct from after_row->field then
    changed=changed||jsonb_build_object(field,case when field in ('privacy','public_sharing','avatar') then jsonb_build_object('before',before_row->field,'after',after_row->field) else '"changed"'::jsonb end);
   end if;
  end loop;
  if changed='{}'::jsonb then return null; end if;
 else
  changed=jsonb_build_object('before',before_row-'comment'-'rating'-'edition_number'-'acquired_on','after',after_row-'comment'-'rating'-'edition_number'-'acquired_on');
 end if;
 insert into shelf.audit_events(actor_id,owner_id,action,reason,changes) values(actor,target,tg_table_name||'.'||lower(tg_op),nullif(current_setting('shelf.audit_reason',true),''),changed);
 return null;
end;
$$;
revoke all on function shelf.audit_change() from public;
grant execute on function shelf.audit_change() to shelf_backend;
create trigger profiles_audit after insert or update on shelf.profiles for each row execute function shelf.audit_change();
create trigger ownership_audit after insert or update or delete on shelf.owned_items for each row execute function shelf.audit_change();
create trigger badge_audit after insert or update or delete on shelf.user_badges for each row execute function shelf.audit_change();
create trigger admin_role_audit after insert or update or delete on shelf.admin_roles for each row execute function shelf.audit_change();

-- Plan catalogue is versioned now; no billing is activated by this migration.
create table shelf.plan_versions (
 plan_key text not null,version integer not null check(version>0),label text not null,
 active boolean not null default false,primary key(plan_key,version)
);
create table shelf.plan_benefits (
 plan_key text not null,plan_version integer not null,feature text not null,value jsonb not null,
 primary key(plan_key,plan_version,feature),foreign key(plan_key,plan_version) references shelf.plan_versions(plan_key,version)
);
insert into shelf.plan_versions values('free',1,'Free Collector',true);
insert into shelf.plan_benefits values('free',1,'collection_tracking','true'),('free',1,'profile','true');
alter table shelf.plan_versions enable row level security;
alter table shelf.plan_benefits enable row level security;
grant select on shelf.plan_versions,shelf.plan_benefits to shelf_backend;
create policy plan_read on shelf.plan_versions for select to shelf_backend using(true);
create policy benefit_read on shelf.plan_benefits for select to shelf_backend using(true);

-- Defense in depth for existing server-only tables. No anon/authenticated grants.
alter table shelf.sessions enable row level security;
alter table shelf.oauth_attempts enable row level security;
alter table shelf.products enable row level security;
create policy server_sessions on shelf.sessions to shelf_backend using(true) with check(true);
create policy server_oauth on shelf.oauth_attempts to shelf_backend using(true) with check(true);
create policy server_catalog on shelf.products for select to shelf_backend using(true);
