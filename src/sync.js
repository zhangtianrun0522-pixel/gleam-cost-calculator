const ORG_TABLES = {
  organizations: 'organizations',
  members: 'organization_members',
  invites: 'organization_invites',
  configs: 'organization_configs',
  departments: 'departments',
  projects: 'organization_projects',
  people: 'organization_people',
  pointRecords: 'organization_point_records',
  progress: 'organization_production_progress',
};

function isMissingOrgSchemaError(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || error?.code === 'PGRST106'
    || message.includes('Could not find the table')
    || message.includes('does not exist')
    || message.includes('schema cache');
}

function ensureId(prefix, value, index) {
  return String(value || `${prefix}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getProjectId(project, index) {
  return ensureId('project', project?.id, index);
}

function getPersonId(person, index) {
  return ensureId('person', person?.id, index);
}

function normalizeProjects(projects = []) {
  return projects.map((project, index) => {
    const id = getProjectId(project, index);
    return { ...project, id };
  });
}

function normalizePeople(people = []) {
  return people.map((person, index) => {
    const id = getPersonId(person, index);
    return { ...person, id };
  });
}

function toProjectRow(organizationId, project, index) {
  const id = getProjectId(project, index);
  return {
    organization_id: organizationId,
    id,
    department_id: project.departmentId || null,
    data: { ...project, id },
    updated_at: new Date().toISOString(),
  };
}

function toPersonRow(organizationId, person, index) {
  const id = getPersonId(person, index);
  return {
    organization_id: organizationId,
    id,
    user_id: person.memberUserId || person.userId || null,
    department_id: person.departmentId || null,
    data: { ...person, id },
    updated_at: new Date().toISOString(),
  };
}

function toPointRecordRow(organizationId, record, index, projectNameToId, personNameToId) {
  const id = ensureId('point-record', record?.id, index);
  const projectId = record.projectId || projectNameToId.get(record.projectName) || null;
  const personId = record.personId || personNameToId.get(record.personName) || null;
  return {
    organization_id: organizationId,
    id,
    project_id: projectId,
    person_id: personId,
    data: { ...record, id, projectId: projectId || '', personId: personId || record.personId || '' },
    updated_at: new Date().toISOString(),
  };
}

export function getWriteAccess(member) {
  if (!member) return { canManageOrg: false, canWriteGlobal: false, canWriteScoped: false, canWriteAny: false };
  const canManageOrg = ['owner', 'admin'].includes(member.role);
  const canWriteScoped = member.role === 'department_lead';
  return {
    canManageOrg,
    canWriteGlobal: canManageOrg,
    canWriteScoped,
    canWriteAny: canManageOrg || canWriteScoped,
  };
}

export function filterStateByMember(state, member) {
  if (!member) return state;
  const scope = member.access_scope || 'self';
  if (scope === 'global') return state;

  const departmentIds = new Set(member.department_ids || []);
  const projectIds = new Set(member.project_ids || []);
  const userId = member.user_id;
  const people = state.people || [];

  const visiblePeople = people.filter((person) => {
    if (person.memberUserId === userId || person.userId === userId) return true;
    if (scope === 'department' && person.departmentId && departmentIds.has(person.departmentId)) return true;
    return false;
  });
  const visiblePersonIds = new Set(visiblePeople.map((person) => person.id));

  const visibleProjects = (state.projects || []).filter((project) => {
    const projectId = project.id || project.name;
    if (scope === 'project' && (projectIds.has(projectId) || projectIds.has(project.name))) return true;
    if (scope === 'department' && project.departmentId && departmentIds.has(project.departmentId)) return true;
    if (scope === 'self') {
      return (project.staffing || []).some((row) =>
        (row.peopleIds || []).some((personId) => visiblePersonIds.has(personId))
      );
    }
    return false;
  });
  const visibleProjectIds = new Set(visibleProjects.flatMap((project) => [project.id, project.name].filter(Boolean)));
  const visibleProjectNames = new Set(visibleProjects.map((project) => project.name));

  return {
    ...state,
    projects: visibleProjects,
    people: visiblePeople,
    pointRecords: (state.pointRecords || []).filter((record) => (
      visibleProjectIds.has(record.projectId)
      || visibleProjectNames.has(record.projectName)
      || visiblePersonIds.has(record.personId)
    )),
    productionProgress: Object.fromEntries(
      Object.entries(state.productionProgress || {}).filter(([projectName, progress]) => (
        visibleProjectNames.has(projectName) || visibleProjectIds.has(progress?.projectId)
      ))
    ),
  };
}

export async function saveToCloud(supabase, userId, state) {
  try {
    const basePayload = {
      user_id: userId,
      platforms: state.platforms,
      roles: state.roles,
      global_config: state.globalConfig,
      projects: state.projects,
      templates: state.templates,
      updated_at: new Date().toISOString(),
    };
    const extendedPayload = {
      ...basePayload,
      people: state.people,
      point_records: state.pointRecords,
      production_progress: state.productionProgress,
    };
    let { data, error } = await supabase
      .from('user_data')
      .upsert(extendedPayload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('user_data')
        .upsert(basePayload, { onConflict: 'user_id' })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return { data: null, error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function loadFromCloud(supabase, userId) {
  try {
    let { data, error } = await supabase
      .from('user_data')
      .select('platforms, roles, global_config, projects, templates, people, point_records, production_progress')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('user_data')
        .select('platforms, roles, global_config, projects, templates')
        .eq('user_id', userId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    return {
      data: {
        platforms: data.platforms,
        roles: data.roles,
        globalConfig: data.global_config,
        projects: data.projects,
        templates: Array.isArray(data.templates) ? data.templates : null,
        people: Array.isArray(data.people) ? data.people : null,
        pointRecords: Array.isArray(data.point_records) ? data.point_records : null,
        productionProgress: data.production_progress && typeof data.production_progress === 'object'
          ? data.production_progress
          : null,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function loadLegacyUserData(supabase, userId) {
  return loadFromCloud(supabase, userId);
}

export async function loadOrgContext(supabase, user) {
  try {
    const email = normalizeEmail(user.email);
    const { data: pendingInvites, error: inviteError } = await supabase
      .from(ORG_TABLES.invites)
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());
    if (isMissingOrgSchemaError(inviteError)) {
      return {
        data: {
          legacyMode: true,
          organization: { id: user.id, name: user.user_metadata?.team_name || email || '个人空间' },
          member: { user_id: user.id, email, display_name: user.user_metadata?.display_name || user.user_metadata?.team_name || '', role: 'owner', access_scope: 'global' },
        },
        error: null,
      };
    }
    if (inviteError) return { data: null, error: inviteError };

    const loadMemberships = () => supabase
      .from(ORG_TABLES.members)
      .select('*, organization:organizations(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    let { data: memberships, error: memberLoadError } = await loadMemberships();
    if (memberLoadError) return { data: null, error: memberLoadError };

    for (const invite of pendingInvites || []) {
      const existingMembership = (memberships || []).find((member) => member.organization_id === invite.organization_id);
      if (existingMembership) {
        await supabase
          .from(ORG_TABLES.invites)
          .update({ status: 'accepted', accepted_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', invite.id);
        continue;
      }

      const { error: memberError } = await supabase
        .from(ORG_TABLES.members)
        .upsert({
          organization_id: invite.organization_id,
          user_id: user.id,
          email,
          display_name: user.user_metadata?.display_name || user.user_metadata?.team_name || '',
          role: invite.role,
          access_scope: invite.access_scope,
          department_ids: invite.department_ids || [],
          project_ids: invite.project_ids || [],
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,user_id' });
      if (memberError) return { data: null, error: memberError };

      const { error: acceptError } = await supabase
        .from(ORG_TABLES.invites)
        .update({ status: 'accepted', accepted_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', invite.id);
      if (acceptError) {
        // Membership creation is the critical path for login. If the invite
        // status update is blocked by a stale policy, let the user continue.
      }
    }

    ({ data: memberships, error: memberLoadError } = await loadMemberships());
    if (memberLoadError) return { data: null, error: memberLoadError };

    if (memberships && memberships.length > 0) {
      return {
        data: {
          organization: memberships[0].organization,
          member: memberships[0],
          migrated: false,
        },
        error: null,
      };
    }

    let { data: ownedOrgs, error: ownedOrgError } = await supabase
      .from(ORG_TABLES.organizations)
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);
    if (ownedOrgError) return { data: null, error: ownedOrgError };

    let organization = ownedOrgs?.[0] || null;
    if (!organization) {
      const orgName = user.user_metadata?.team_name || (email ? `${email.split('@')[0]} 的组织` : '我的组织');
      const { data: createdOrg, error: orgError } = await supabase
        .from(ORG_TABLES.organizations)
        .insert({ name: orgName, owner_id: user.id })
        .select()
        .single();
      if (orgError) return { data: null, error: orgError };
      organization = createdOrg;
    }

    const { data: ownerMember, error: ownerError } = await supabase
      .from(ORG_TABLES.members)
      .upsert({
        organization_id: organization.id,
        user_id: user.id,
        email,
        display_name: user.user_metadata?.display_name || user.user_metadata?.team_name || '',
        role: 'owner',
        access_scope: 'global',
        status: 'active',
      }, { onConflict: 'organization_id,user_id' })
      .select()
      .single();
    if (ownerError) return { data: null, error: ownerError };

    const legacy = await loadLegacyUserData(supabase, user.id);
    if (legacy.error) return { data: null, error: legacy.error };
    if (legacy.data) {
      const saved = await saveOrgData(supabase, organization.id, legacy.data);
      if (saved.error) return { data: null, error: saved.error };
    }

    return {
      data: { organization, member: ownerMember, migrated: !!legacy.data },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function loadOrgData(supabase, organizationId, member) {
  try {
    const [configRes, projectsRes, peopleRes, recordsRes, progressRes, departmentsRes, membersRes] = await Promise.all([
      supabase.from(ORG_TABLES.configs).select('*').eq('organization_id', organizationId).maybeSingle(),
      supabase.from(ORG_TABLES.projects).select('*').eq('organization_id', organizationId),
      supabase.from(ORG_TABLES.people).select('*').eq('organization_id', organizationId),
      supabase.from(ORG_TABLES.pointRecords).select('*').eq('organization_id', organizationId),
      supabase.from(ORG_TABLES.progress).select('*').eq('organization_id', organizationId),
      supabase.from(ORG_TABLES.departments).select('*').eq('organization_id', organizationId).order('created_at', { ascending: true }),
      supabase.from(ORG_TABLES.members).select('*').eq('organization_id', organizationId).order('created_at', { ascending: true }),
    ]);

    const invitesRes = getWriteAccess(member).canManageOrg
      ? await supabase.from(ORG_TABLES.invites).select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
      : { data: [], error: null };

    const error = [configRes, projectsRes, peopleRes, recordsRes, progressRes, departmentsRes, membersRes, invitesRes].find((res) => res.error)?.error;
    if (error) return { data: null, error };

    const config = configRes.data || {};
    const projects = (projectsRes.data || []).map((row) => ({ ...(row.data || {}), id: row.id, departmentId: row.department_id || row.data?.departmentId || '' }));
    const people = (peopleRes.data || []).map((row) => ({
      ...(row.data || {}),
      id: row.id,
      memberUserId: row.user_id || row.data?.memberUserId || '',
      departmentId: row.department_id || row.data?.departmentId || '',
    }));
    const pointRecords = (recordsRes.data || []).map((row) => ({
      ...(row.data || {}),
      id: row.id,
      projectId: row.project_id || row.data?.projectId || '',
      personId: row.person_id || row.data?.personId || '',
    }));
    const productionProgress = {};
    (progressRes.data || []).forEach((row) => {
      const project = projects.find((item) => item.id === row.project_id);
      const key = project?.name || row.project_id;
      productionProgress[key] = { ...(row.data || {}), projectId: row.project_id };
    });

    const state = {
      platforms: Array.isArray(config.platforms) ? config.platforms : null,
      roles: Array.isArray(config.roles) ? config.roles : null,
      globalConfig: config.global_config || null,
      projects,
      templates: Array.isArray(config.templates) ? config.templates : null,
      people,
      pointRecords,
      productionProgress,
    };

    return {
      data: {
        state: filterStateByMember(state, member),
        departments: departmentsRes.data || [],
        members: membersRes.data || [],
        invites: invitesRes.data || [],
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function saveOrgData(supabase, organizationId, state) {
  try {
    const projects = normalizeProjects(state.projects || []);
    const people = normalizePeople(state.people || []);
    const projectsWithDepartments = projects.map((project, index) => ({
      ...project,
      departmentId: project.departmentId || state.departments?.[0]?.id || '',
      id: getProjectId(project, index),
    }));
    const projectNameToId = new Map(projectsWithDepartments.map((project) => [project.name, project.id]));
    const personNameToId = new Map(people.map((person) => [person.name, person.id]));
    const projectRows = projectsWithDepartments.map((project, index) => toProjectRow(organizationId, project, index));
    const peopleRows = people.map((person, index) => toPersonRow(organizationId, person, index));
    const recordRows = (state.pointRecords || []).map((record, index) =>
      toPointRecordRow(organizationId, record, index, projectNameToId, personNameToId)
    );
    const progressRows = Object.entries(state.productionProgress || {}).map(([projectName, progress]) => ({
      organization_id: organizationId,
      project_id: progress?.projectId || projectNameToId.get(projectName) || projectName,
      data: progress || {},
      updated_at: new Date().toISOString(),
    }));

    const { error: configError } = await supabase
      .from(ORG_TABLES.configs)
      .upsert({
        organization_id: organizationId,
        platforms: state.platforms || [],
        roles: state.roles || [],
        global_config: state.globalConfig || {},
        templates: state.templates || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' });
    if (configError) return { error: configError };

    const [projectDelete, peopleDelete, recordDelete, progressDelete] = await Promise.all([
      supabase.from(ORG_TABLES.projects).delete().eq('organization_id', organizationId),
      supabase.from(ORG_TABLES.people).delete().eq('organization_id', organizationId),
      supabase.from(ORG_TABLES.pointRecords).delete().eq('organization_id', organizationId),
      supabase.from(ORG_TABLES.progress).delete().eq('organization_id', organizationId),
    ]);
    const deleteError = [projectDelete, peopleDelete, recordDelete, progressDelete].find((res) => res.error)?.error;
    if (deleteError) return { error: deleteError };

    const inserts = [];
    if (projectRows.length) inserts.push(supabase.from(ORG_TABLES.projects).insert(projectRows));
    if (peopleRows.length) inserts.push(supabase.from(ORG_TABLES.people).insert(peopleRows));
    if (recordRows.length) inserts.push(supabase.from(ORG_TABLES.pointRecords).insert(recordRows));
    if (progressRows.length) inserts.push(supabase.from(ORG_TABLES.progress).insert(progressRows));
    const results = await Promise.all(inserts);
    const insertError = results.find((res) => res.error)?.error;
    if (insertError) return { error: insertError };

    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

export async function saveScopedOrgData(supabase, organizationId, state) {
  try {
    const projects = normalizeProjects(state.projects || []);
    const projectNameToId = new Map(projects.map((project) => [project.name, project.id]));
    const personNameToId = new Map((state.people || []).map((person) => [person.name, person.id]));
    const projectRows = projects.map((project, index) => toProjectRow(organizationId, project, index));
    const recordRows = (state.pointRecords || []).map((record, index) =>
      toPointRecordRow(organizationId, record, index, projectNameToId, personNameToId)
    );
    const progressRows = Object.entries(state.productionProgress || {}).map(([projectName, progress]) => ({
      organization_id: organizationId,
      project_id: progress?.projectId || projectNameToId.get(projectName) || projectName,
      data: progress || {},
      updated_at: new Date().toISOString(),
    }));

    const writes = [];
    if (projectRows.length) {
      writes.push(supabase.from(ORG_TABLES.projects).upsert(projectRows, { onConflict: 'organization_id,id' }));
    }
    if (recordRows.length) {
      writes.push(supabase.from(ORG_TABLES.pointRecords).upsert(recordRows, { onConflict: 'organization_id,id' }));
    }
    if (progressRows.length) {
      writes.push(supabase.from(ORG_TABLES.progress).upsert(progressRows, { onConflict: 'organization_id,project_id' }));
    }

    const results = await Promise.all(writes);
    const error = results.find((res) => res.error)?.error;
    if (error) return { error };
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

export async function loadOrgAdminData(supabase, organizationId) {
  const [departmentsRes, membersRes, invitesRes] = await Promise.all([
    supabase.from(ORG_TABLES.departments).select('*').eq('organization_id', organizationId).order('created_at', { ascending: true }),
    supabase.from(ORG_TABLES.members).select('*').eq('organization_id', organizationId).order('created_at', { ascending: true }),
    supabase.from(ORG_TABLES.invites).select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
  ]);
  const error = [departmentsRes, membersRes, invitesRes].find((res) => res.error)?.error;
  if (error) return { data: null, error };
  return {
    data: {
      departments: departmentsRes.data || [],
      members: membersRes.data || [],
      invites: invitesRes.data || [],
    },
    error: null,
  };
}

export async function createDepartment(supabase, organizationId, name) {
  return supabase
    .from(ORG_TABLES.departments)
    .insert({ organization_id: organizationId, name: name.trim() })
    .select()
    .single();
}

export async function updateDepartment(supabase, id, patch) {
  return supabase.from(ORG_TABLES.departments).update(patch).eq('id', id).select().single();
}

export async function deleteDepartment(supabase, id) {
  return supabase.from(ORG_TABLES.departments).delete().eq('id', id);
}

export async function createInvite(supabase, organizationId, invite, userId) {
  return supabase
    .from(ORG_TABLES.invites)
    .insert({
      organization_id: organizationId,
      email: normalizeEmail(invite.email),
      role: invite.role,
      access_scope: invite.access_scope,
      department_ids: invite.department_ids || [],
      project_ids: invite.project_ids || [],
      invited_by: userId,
    })
    .select()
    .single();
}

export async function updateInviteStatus(supabase, id, status) {
  return supabase.from(ORG_TABLES.invites).update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
}

export async function updateMember(supabase, id, patch) {
  return supabase.from(ORG_TABLES.members).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
}
