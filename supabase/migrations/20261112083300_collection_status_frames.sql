alter table shelf.owned_items add column status text not null default 'current'
 check(status in ('current','previous','wishlist'));
alter table shelf.layouts add column frame text not null default 'classic'
 check(frame in ('classic','black','temple'));
-- Owner-only mutations and status changes use the existing ownership audit trigger.
