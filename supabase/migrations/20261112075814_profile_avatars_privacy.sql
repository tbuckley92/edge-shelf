alter table shelf.profiles add column avatar_style text not null default 'initials'
 check(avatar_style in ('initials','photo','bear','lion','tiger','panda','owl','fox','dragon','monkey')),
 add column avatar_version uuid;
-- Never expose an existing collector's real name as part of a migration.
select set_config('shelf.audit_reason','Add name privacy controls; existing name visibility remains private',true);
update shelf.profiles set privacy=(privacy-'avatar')||'{"firstName":false,"lastName":false}'::jsonb,
 profile_revision=profile_revision+1;
alter table shelf.profiles alter column privacy set default '{"nickname":true,"country":true,"collection":true,"level":true,"badges":true,"firstName":true,"lastName":true}';
-- One bounded, re-encoded image per collector. Replacement does not retain originals.
create table shelf.avatar_images (
 owner_id uuid primary key references shelf.profiles(id) on delete cascade,
 image bytea not null check(octet_length(image)<=150000)
);
alter table shelf.avatar_images enable row level security;
alter table shelf.avatar_images force row level security;
grant select,insert,update,delete on shelf.avatar_images to shelf_backend;
create policy avatar_owner on shelf.avatar_images to shelf_backend
 using(owner_id::text=current_setting('shelf.owner',true))
 with check(owner_id::text=current_setting('shelf.owner',true));
create policy avatar_public on shelf.avatar_images for select to shelf_backend using(
 owner_id::text=current_setting('shelf.public_profile',true) and exists(
 select 1 from shelf.profiles p where p.id=owner_id and p.public_sharing and p.avatar_style='photo')
);
-- Profile avatar_version/style updates are audited by the existing trigger;
-- never put image bytes in audit records.
