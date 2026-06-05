import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureProjectIds,
  getProjectKey,
  getProjectProgress,
  recordMatchesProject,
  resolveProjectByKey,
} from './identity.js';

test('ensureProjectIds adds stable ids without replacing existing ids', () => {
  const projects = ensureProjectIds([{ name: 'A' }, { id: 'project-b', name: 'B' }]);
  assert.match(projects[0].id, /^project-/);
  assert.equal(projects[1].id, 'project-b');
});

test('project resolution and records prefer projectId but keep legacy name fallback', () => {
  const project = { id: 'project-1', name: 'New Name' };
  const projects = [project];

  assert.equal(resolveProjectByKey(projects, 'project-1'), project);
  assert.equal(resolveProjectByKey(projects, 'New Name'), project);
  assert.equal(recordMatchesProject({ projectId: 'project-1', projectName: 'Old Name' }, project), true);
  assert.equal(recordMatchesProject({ projectName: 'New Name' }, project), true);
  assert.equal(recordMatchesProject({ projectId: 'stale-project-id', projectName: 'New Name' }, project), true);
  assert.equal(recordMatchesProject({ projectName: 'Old Name' }, project), false);
});

test('progress lookup prefers project id and falls back to legacy project name key', () => {
  const project = { id: 'project-1', name: 'Project Name' };
  assert.deepEqual(getProjectProgress({ 'project-1': { actualEpisode: 3 } }, project), { actualEpisode: 3 });
  assert.deepEqual(getProjectProgress({ 'Project Name': { actualEpisode: 2 } }, project), { actualEpisode: 2 });
  assert.deepEqual(getProjectProgress({}, project), {});
  assert.equal(getProjectKey(project), 'project-1');
});
