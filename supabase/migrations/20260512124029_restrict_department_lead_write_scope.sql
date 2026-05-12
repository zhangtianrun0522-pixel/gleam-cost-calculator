create or replace function private.can_write_project(org_id uuid, project_id text, dept_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.can_write_org(org_id)
    or (
      private.org_role(org_id) = 'department_lead'
      and (
        project_id = any(private.member_project_ids(org_id))
        or (dept_id is not null and dept_id = any(private.member_department_ids(org_id)))
      )
    )
$$;
