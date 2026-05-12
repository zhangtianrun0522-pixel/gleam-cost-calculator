drop policy if exists "members visible inside organization" on public.organization_members;

create policy "members visible inside organization" on public.organization_members
  for select to authenticated
  using (
    private.is_org_member(organization_id)
    or user_id = auth.uid()
  );
