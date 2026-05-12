create schema if not exists private;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null check (role in ('owner', 'admin', 'department_lead', 'viewer', 'member')),
  access_scope text not null check (access_scope in ('global', 'department', 'project', 'self')),
  department_ids uuid[] not null default '{}',
  project_ids text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'department_lead', 'viewer', 'member')),
  access_scope text not null check (access_scope in ('global', 'department', 'project', 'self')),
  department_ids uuid[] not null default '{}',
  project_ids text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_invites_pending_email_idx
  on public.organization_invites (organization_id, lower(email))
  where status = 'pending';

create table if not exists public.organization_configs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  platforms jsonb not null default '[]'::jsonb,
  roles jsonb not null default '[]'::jsonb,
  global_config jsonb not null default '{}'::jsonb,
  templates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_projects (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  department_id uuid references public.departments(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists public.organization_people (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  user_id uuid references auth.users(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists public.organization_point_records (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  project_id text,
  person_id text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists public.organization_production_progress (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, project_id)
);

create or replace function private.auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function private.org_role(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = org_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1
$$;

create or replace function private.org_scope(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.access_scope
  from public.organization_members om
  where om.organization_id = org_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1
$$;

create or replace function private.member_department_ids(org_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(om.department_ids, '{}')
  from public.organization_members om
  where om.organization_id = org_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1
$$;

create or replace function private.member_project_ids(org_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(om.project_ids, '{}')
  from public.organization_members om
  where om.organization_id = org_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1
$$;

create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.org_role(org_id) is not null
$$;

create or replace function private.can_manage_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.org_role(org_id) in ('owner', 'admin')
$$;

create or replace function private.can_write_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.org_role(org_id) in ('owner', 'admin')
$$;

create or replace function private.can_see_project(org_id uuid, project_id text, dept_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.org_scope(org_id) = 'global'
    or project_id = any(private.member_project_ids(org_id))
    or (dept_id is not null and dept_id = any(private.member_department_ids(org_id)))
$$;

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
      and private.can_see_project(org_id, project_id, dept_id)
    )
$$;

create or replace function private.guard_invite_accept_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending'
    and new.status = 'accepted'
    and new.accepted_by = auth.uid()
    and lower(old.email) = private.auth_email()
    and new.organization_id = old.organization_id
    and new.email = old.email
    and new.role = old.role
    and new.access_scope = old.access_scope
    and new.department_ids = old.department_ids
    and new.project_ids = old.project_ids
    and new.invited_by = old.invited_by
    and new.expires_at = old.expires_at
  then
    new.updated_at = now();
    return new;
  end if;

  if private.can_manage_org(old.organization_id) then
    new.updated_at = now();
    return new;
  end if;

  raise exception 'not allowed to update invite';
end;
$$;

drop trigger if exists guard_invite_accept_update on public.organization_invites;
create trigger guard_invite_accept_update
  before update on public.organization_invites
  for each row execute function private.guard_invite_accept_update();

create or replace function private.guard_member_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id = auth.uid()
    and new.user_id = old.user_id
    and new.organization_id = old.organization_id
    and new.email = old.email
    and new.role = old.role
    and new.access_scope = old.access_scope
    and new.department_ids = old.department_ids
    and new.project_ids = old.project_ids
    and new.status = old.status
  then
    new.updated_at = now();
    return new;
  end if;

  if private.can_manage_org(old.organization_id) then
    new.updated_at = now();
    return new;
  end if;

  raise exception 'not allowed to update member';
end;
$$;

drop trigger if exists guard_member_self_update on public.organization_members;
create trigger guard_member_self_update
  before update on public.organization_members
  for each row execute function private.guard_member_self_update();

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.organization_configs enable row level security;
alter table public.organization_projects enable row level security;
alter table public.organization_people enable row level security;
alter table public.organization_point_records enable row level security;
alter table public.organization_production_progress enable row level security;

create policy "organizations visible to members" on public.organizations
  for select to authenticated using (owner_id = auth.uid() or private.is_org_member(id));
create policy "users create owned organization" on public.organizations
  for insert to authenticated with check (owner_id = auth.uid());
create policy "managers update organization" on public.organizations
  for update to authenticated using (private.can_manage_org(id)) with check (private.can_manage_org(id));

create policy "departments visible to members" on public.departments
  for select to authenticated using (private.is_org_member(organization_id));
create policy "managers write departments" on public.departments
  for all to authenticated using (private.can_manage_org(organization_id)) with check (private.can_manage_org(organization_id));

create policy "members visible inside organization" on public.organization_members
  for select to authenticated using (private.is_org_member(organization_id));
create policy "managers add members" on public.organization_members
  for insert to authenticated with check (
    private.can_manage_org(organization_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and access_scope = 'global'
      and exists (
        select 1 from public.organizations o
        where o.id = organization_members.organization_id
          and o.owner_id = auth.uid()
      )
    )
    or (
      user_id = auth.uid()
      and lower(email) = private.auth_email()
      and exists (
        select 1 from public.organization_invites oi
        where oi.organization_id = organization_members.organization_id
          and lower(oi.email) = lower(organization_members.email)
          and oi.role = organization_members.role
          and oi.access_scope = organization_members.access_scope
          and oi.department_ids = organization_members.department_ids
          and oi.project_ids = organization_members.project_ids
          and oi.status = 'pending'
          and oi.expires_at > now()
      )
    )
  );
create policy "managers and self update members" on public.organization_members
  for update to authenticated using (private.can_manage_org(organization_id) or user_id = auth.uid()) with check (private.can_manage_org(organization_id) or user_id = auth.uid());
create policy "managers delete members" on public.organization_members
  for delete to authenticated using (private.can_manage_org(organization_id));

create policy "invites visible to managers and invitees" on public.organization_invites
  for select to authenticated using (
    private.can_manage_org(organization_id)
    or (status = 'pending' and lower(email) = private.auth_email() and expires_at > now())
  );
create policy "managers create invites" on public.organization_invites
  for insert to authenticated with check (private.can_manage_org(organization_id) and invited_by = auth.uid());
create policy "managers or invitees update invites" on public.organization_invites
  for update to authenticated using (
    private.can_manage_org(organization_id)
    or (status = 'pending' and lower(email) = private.auth_email() and expires_at > now())
  ) with check (
    private.can_manage_org(organization_id)
    or (status = 'accepted' and accepted_by = auth.uid())
  );

create policy "configs visible to members" on public.organization_configs
  for select to authenticated using (private.is_org_member(organization_id));
create policy "managers write configs" on public.organization_configs
  for all to authenticated using (private.can_write_org(organization_id)) with check (private.can_write_org(organization_id));

create policy "projects scoped select" on public.organization_projects
  for select to authenticated using (private.is_org_member(organization_id) and private.can_see_project(organization_id, id, department_id));
create policy "projects scoped write" on public.organization_projects
  for all to authenticated using (private.can_write_project(organization_id, id, department_id)) with check (private.can_write_project(organization_id, id, department_id));

create policy "people scoped select" on public.organization_people
  for select to authenticated using (
    private.is_org_member(organization_id)
    and (
      private.org_scope(organization_id) = 'global'
      or user_id = auth.uid()
      or (department_id is not null and department_id = any(private.member_department_ids(organization_id)))
    )
  );
create policy "people scoped write" on public.organization_people
  for all to authenticated using (
    private.can_write_org(organization_id)
    or (
      private.org_role(organization_id) = 'department_lead'
      and department_id is not null
      and department_id = any(private.member_department_ids(organization_id))
    )
  ) with check (
    private.can_write_org(organization_id)
    or (
      private.org_role(organization_id) = 'department_lead'
      and department_id is not null
      and department_id = any(private.member_department_ids(organization_id))
    )
  );

create policy "point records scoped select" on public.organization_point_records
  for select to authenticated using (
    private.is_org_member(organization_id)
    and (
      private.org_scope(organization_id) = 'global'
      or project_id = any(private.member_project_ids(organization_id))
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
    or (
      private.org_role(organization_id) = 'department_lead'
      and project_id = any(private.member_project_ids(organization_id))
    )
  ) with check (
    private.can_write_org(organization_id)
    or (
      private.org_role(organization_id) = 'department_lead'
      and project_id = any(private.member_project_ids(organization_id))
    )
  );

create policy "progress scoped select" on public.organization_production_progress
  for select to authenticated using (
    private.is_org_member(organization_id)
    and (
      private.org_scope(organization_id) = 'global'
      or project_id = any(private.member_project_ids(organization_id))
    )
  );
create policy "progress scoped write" on public.organization_production_progress
  for all to authenticated using (
    private.can_write_org(organization_id)
    or (
      private.org_role(organization_id) = 'department_lead'
      and project_id = any(private.member_project_ids(organization_id))
    )
  ) with check (
    private.can_write_org(organization_id)
    or (
      private.org_role(organization_id) = 'department_lead'
      and project_id = any(private.member_project_ids(organization_id))
    )
  );

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
