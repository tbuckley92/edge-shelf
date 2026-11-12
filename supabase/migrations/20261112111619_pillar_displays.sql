alter table shelf.layouts drop constraint layouts_display_type_check;
alter table shelf.layouts add constraint layouts_display_type_check check(display_type in ('cabinet','rocks','pillars'));
