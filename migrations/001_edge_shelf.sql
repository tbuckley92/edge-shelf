-- Private schema, deliberately not exposed through Supabase's Data API.
-- Apply as migration owner. Runtime login must be a member of shelf_backend only.
create schema shelf;
create role shelf_backend nologin nosuperuser nobypassrls;
grant usage on schema shelf to shelf_backend;
revoke all on schema shelf from public;
create table shelf.profiles (
 id uuid primary key default gen_random_uuid(), issuer text not null, subject text not null,
 shopify_customer_id text not null, display_name text, public_sharing boolean not null default false,
 marketing_preference boolean, marketing_updated_at timestamptz, created_at timestamptz not null default now(),
 unique(issuer,subject)
);
create table shelf.oauth_attempts (
 state_hash text primary key, browser_hash text not null, verifier text not null, nonce text not null,
 expires_at timestamptz not null
);
create table shelf.sessions (
 token_hash text primary key, owner_id uuid not null references shelf.profiles(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index sessions_owner on shelf.sessions(owner_id);
create index sessions_expiry on shelf.sessions(expires_at);
create table shelf.products (
 id text primary key, shopify_id text unique, translations jsonb not null default '{}',
 width_cm numeric, height_cm numeric, depth_cm numeric, assets jsonb not null default '{}',
 check(width_cm is null or width_cm>0),check(height_cm is null or height_cm>0),check(depth_cm is null or depth_cm>0)
);
create table shelf.layouts (
 id uuid primary key, owner_id uuid not null references shelf.profiles(id) on delete cascade,
 name text not null default 'My shelves', revision integer not null default 0,
 unique(id,owner_id), unique(owner_id,name)
);
create table shelf.owned_items (
 id uuid primary key, owner_id uuid not null references shelf.profiles(id) on delete cascade,
 product_id text not null references shelf.products(id), rating smallint check(rating between 1 and 5),
 comment text, acquired_on date, edition_number text, unique(id,owner_id)
);
create index owned_owner on shelf.owned_items(owner_id);
create table shelf.wishlist (
 owner_id uuid not null references shelf.profiles(id) on delete cascade, product_id text not null references shelf.products(id),
 primary key(owner_id,product_id)
);
create table shelf.shelves (
 id uuid primary key, owner_id uuid not null, layout_id uuid not null, position integer not null check(position>=0),
 settings jsonb not null default '{}', unique(id,owner_id,layout_id),
 foreign key(layout_id,owner_id) references shelf.layouts(id,owner_id) on delete cascade
);
create index shelves_layout on shelf.shelves(owner_id,layout_id);
create table shelf.placements (
 owner_id uuid not null, layout_id uuid not null, item_id uuid not null, shelf_id uuid,
 position integer not null check(position>=0), primary key(layout_id,item_id),
 foreign key(layout_id,owner_id) references shelf.layouts(id,owner_id) on delete cascade,
 foreign key(item_id,owner_id) references shelf.owned_items(id,owner_id) on delete cascade,
 foreign key(shelf_id,owner_id,layout_id) references shelf.shelves(id,owner_id,layout_id)
);
create index placements_owner on shelf.placements(owner_id,layout_id);
create table shelf.entitlements (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references shelf.profiles(id),
 feature text not null, source text not null check(source in ('subscription','cosmetic_purchase','manual')),
 source_reference text not null unique, valid_until timestamptz, revoked_at timestamptz
);
create index entitlements_owner on shelf.entitlements(owner_id);
-- Auth tables are accessible only to the server role, never browser roles.
grant select,insert,update,delete on shelf.oauth_attempts,shelf.sessions to shelf_backend;
grant select,insert,update on shelf.profiles to shelf_backend;
grant select on shelf.products,shelf.entitlements to shelf_backend;
grant select,insert,update,delete on shelf.layouts,shelf.owned_items,shelf.wishlist,shelf.shelves,shelf.placements to shelf_backend;
-- RLS is enforced even for the table owner. Context is transaction-local and server-derived.
alter table shelf.profiles enable row level security;
alter table shelf.profiles force row level security;
create policy profile_identity on shelf.profiles to shelf_backend
 using (id::text=current_setting('shelf.owner',true) or (issuer=current_setting('shelf.issuer',true) and subject=current_setting('shelf.subject',true)))
 with check (id::text=current_setting('shelf.owner',true) or (issuer=current_setting('shelf.issuer',true) and subject=current_setting('shelf.subject',true)));
do $$ declare t text; begin
 foreach t in array array['layouts','owned_items','wishlist','shelves','placements','entitlements'] loop
  execute format('alter table shelf.%I enable row level security',t);
  execute format('alter table shelf.%I force row level security',t);
  execute format('create policy owner_only on shelf.%I to shelf_backend using (owner_id::text=current_setting(''shelf.owner'',true)) with check (owner_id::text=current_setting(''shelf.owner'',true))',t);
 end loop;
end $$;
-- No public, anon, or authenticated grants. Private-schema auth tables are server-only.
