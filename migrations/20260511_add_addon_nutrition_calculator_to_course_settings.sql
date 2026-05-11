alter table public.course_settings
add column if not exists addon_nutrition_calculator boolean not null default false;
