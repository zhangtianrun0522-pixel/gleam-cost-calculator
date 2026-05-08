alter table public.user_data
  add column if not exists people jsonb default '[]'::jsonb,
  add column if not exists point_records jsonb default '[]'::jsonb,
  add column if not exists production_progress jsonb default '{}'::jsonb;

