alter table shelf.layouts add column display_type text not null default 'cabinet' check(display_type in ('cabinet','rocks')),
 add column default_finish text not null default 'ice',
 add column created_at timestamptz not null default now();
alter table shelf.layouts drop constraint layouts_frame_check;
alter table shelf.layouts add constraint layouts_frame_check check(frame in ('classic','black','temple','rock','ice'));
-- Existing IDs, rows, placements, uploads, names and statuses are preserved.
-- Force an already-open pre-library editor to reload before its next save.
update shelf.layouts set revision=revision+1;
alter table shelf.profiles add column collection_revision integer not null default 0;
