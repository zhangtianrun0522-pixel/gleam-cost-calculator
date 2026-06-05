begin;

delete from public.organization_point_records opr
where opr.project_id is not null
  and not exists (
    select 1
    from public.organization_projects op
    where op.organization_id = opr.organization_id
      and op.id = opr.project_id
  );

delete from public.organization_production_progress opp
where not exists (
  select 1
  from public.organization_projects op
  where op.organization_id = opp.organization_id
    and op.id = opp.project_id
);

update public.organization_point_records opr
set person_id = null
where opr.person_id is not null
  and not exists (
    select 1
    from public.organization_people op
    where op.organization_id = opr.organization_id
      and op.id = opr.person_id
  );

alter table public.organization_point_records
  drop constraint if exists organization_point_records_project_fk,
  drop constraint if exists organization_point_records_person_fk;

alter table public.organization_production_progress
  drop constraint if exists organization_production_progress_project_fk;

alter table public.organization_point_records
  add constraint organization_point_records_project_fk
  foreign key (organization_id, project_id)
  references public.organization_projects (organization_id, id)
  on delete cascade;

alter table public.organization_point_records
  add constraint organization_point_records_person_fk
  foreign key (organization_id, person_id)
  references public.organization_people (organization_id, id)
  on delete set null (person_id);

alter table public.organization_production_progress
  add constraint organization_production_progress_project_fk
  foreign key (organization_id, project_id)
  references public.organization_projects (organization_id, id)
  on delete cascade;

create index if not exists organization_point_records_project_idx
  on public.organization_point_records (organization_id, project_id);

create index if not exists organization_point_records_person_idx
  on public.organization_point_records (organization_id, person_id);

create index if not exists organization_production_progress_project_idx
  on public.organization_production_progress (organization_id, project_id);

commit;
