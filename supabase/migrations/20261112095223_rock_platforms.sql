alter table shelf.layouts add column rock_config jsonb not null default '[]'::jsonb check(jsonb_typeof(rock_config)='array');
