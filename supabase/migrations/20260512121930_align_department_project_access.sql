drop policy if exists "point records scoped select" on public.organization_point_records;
drop policy if exists "point records scoped write" on public.organization_point_records;
drop policy if exists "progress scoped select" on public.organization_production_progress;
drop policy if exists "progress scoped write" on public.organization_production_progress;

create policy "point records scoped select" on public.organization_point_records
  for select to authenticated using (
    private.is_org_member(organization_id)
    and (
      private.org_scope(organization_id) = 'global'
      or project_id = any(private.member_project_ids(organization_id))
      or exists (
        select 1 from public.organization_projects opj
        where opj.organization_id = organization_point_records.organization_id
          and opj.id = organization_point_records.project_id
          and private.can_see_project(opj.organization_id, opj.id, opj.department_id)
      )
      or exists (
        select 1 from public.organization_people op
        where op.organization_id = organization_point_records.organization_id
          and op.id = organization_point_records.person_id
          and (
            op.user_id = auth.uid()
            or op.department_id = any(private.member_department_ids(organization_id))
          )
      )
    )
  );

create policy "point records scoped write" on public.organization_point_records
  for all to authenticated using (
    private.can_write_org(organization_id)
    or exists (
      select 1 from public.organization_projects opj
      where opj.organization_id = organization_point_records.organization_id
        and opj.id = organization_point_records.project_id
        and private.can_write_project(opj.organization_id, opj.id, opj.department_id)
    )
  ) with check (
    private.can_write_org(organization_id)
    or exists (
      select 1 from public.organization_projects opj
      where opj.organization_id = organization_point_records.organization_id
        and opj.id = organization_point_records.project_id
        and private.can_write_project(opj.organization_id, opj.id, opj.department_id)
    )
  );

create policy "progress scoped select" on public.organization_production_progress
  for select to authenticated using (
    private.is_org_member(organization_id)
    and (
      private.org_scope(organization_id) = 'global'
      or project_id = any(private.member_project_ids(organization_id))
      or exists (
        select 1 from public.organization_projects opj
        where opj.organization_id = organization_production_progress.organization_id
          and opj.id = organization_production_progress.project_id
          and private.can_see_project(opj.organization_id, opj.id, opj.department_id)
      )
    )
  );

create policy "progress scoped write" on public.organization_production_progress
  for all to authenticated using (
    private.can_write_org(organization_id)
    or exists (
      select 1 from public.organization_projects opj
      where opj.organization_id = organization_production_progress.organization_id
        and opj.id = organization_production_progress.project_id
        and private.can_write_project(opj.organization_id, opj.id, opj.department_id)
    )
  ) with check (
    private.can_write_org(organization_id)
    or exists (
      select 1 from public.organization_projects opj
      where opj.organization_id = organization_production_progress.organization_id
        and opj.id = organization_production_progress.project_id
        and private.can_write_project(opj.organization_id, opj.id, opj.department_id)
    )
  );
