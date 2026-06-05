export function createStableId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getProjectKey(project) {
  return String(project?.id || project?.name || '');
}

export function ensureProjectIds(projects = []) {
  return projects.map((project) => (
    project?.id ? project : { ...project, id: createStableId('project') }
  ));
}

export function resolveProjectByKey(projects = [], key) {
  const normalizedKey = String(key || '');
  if (!normalizedKey) return null;
  return projects.find((project) => (
    getProjectKey(project) === normalizedKey || project.name === normalizedKey
  )) || null;
}

export function recordMatchesProject(record, project) {
  if (!record || !project) return false;
  const projectKey = getProjectKey(project);
  if (record.projectId && projectKey && record.projectId === projectKey) return true;
  return !!project.name && record.projectName === project.name;
}

export function getProjectProgress(productionProgress = {}, project) {
  if (!project) return {};
  const projectKey = getProjectKey(project);
  return productionProgress[projectKey] || productionProgress[project.name] || {};
}
