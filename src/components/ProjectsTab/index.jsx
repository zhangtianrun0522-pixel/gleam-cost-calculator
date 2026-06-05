import { useState } from 'react';
import useStore from '../../store';
import { getProjectAiConfig } from '../../calc';
import ProjectCard from './ProjectCard';
import { getWriteAccess } from '../../sync';
import { getProjectKey } from '../../identity';

export default function ProjectsTab() {
  const projects = useStore(s => s.projects);
  const departments = useStore(s => s.departments);
  const globalConfig = useStore(s => s.globalConfig);
  const addProject = useStore(s => s.addProject);
  const updateProject = useStore(s => s.updateProject);
  const deleteProject = useStore(s => s.deleteProject);
  const orgContext = useStore(s => s.orgContext);
  const access = getWriteAccess(orgContext?.member);
  const canWrite = access.canWriteAny;
  const canCreate = access.canWriteGlobal || access.canWriteScoped;
  const canDelete = access.canWriteGlobal;
  const memberDepartmentIds = orgContext?.member?.department_ids || [];
  const departmentOptions = access.canWriteGlobal
    ? departments
    : departments.filter(department => memberDepartmentIds.includes(department.id));

  const [openIndex, setOpenIndex] = useState(-1);

  const handleAdd = () => {
    if (!canCreate) return;
    const departmentId = access.canWriteGlobal
      ? departments[0]?.id || ''
      : departmentOptions[0]?.id || '';
    if (!access.canWriteGlobal && !departmentId) return;
    const p = {
      name: '新项目 ' + (projects.length + 1),
      eps: 20, days: 30, scriptCost: 0, staffing: [],
      departmentId,
      aiConfig: getProjectAiConfig(null, globalConfig),
      revPlat: 0, revBrand: 0, revLic: 0, revMerch: 0, revViews: 0, revCpm: 0,
    };
    addProject(p);
    setOpenIndex(projects.length);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: '#888' }}>{canWrite ? '点击项目卡片展开编辑' : '当前账号没有项目写权限，仅可查看授权项目'}</div>
        <button className="addbtn" onClick={handleAdd} disabled={!canCreate || (!access.canWriteGlobal && departmentOptions.length === 0)}>+ 新增项目</button>
      </div>
      {projects.length === 0 && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          暂无项目，点击上方「新增项目」
        </div>
      )}
      {projects.map((project, i) => (
        <ProjectCard
          key={getProjectKey(project) || i}
          project={project}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
          onUpdate={(patch) => canWrite && updateProject(i, patch)}
          onDelete={() => { if (!canDelete) return; deleteProject(i); if (openIndex === i) setOpenIndex(-1); }}
          canWrite={canWrite}
          canDelete={canDelete}
          departments={departments}
          departmentOptions={departmentOptions}
        />
      ))}
    </div>
  );
}
