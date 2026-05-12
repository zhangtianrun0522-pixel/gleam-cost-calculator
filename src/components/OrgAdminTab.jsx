import { useMemo, useState } from 'react';
import useStore from '../store';
import supabase from '../supabase';
import {
  createDepartment,
  createInvite,
  deleteDepartment,
  getWriteAccess,
  loadOrgAdminData,
  updateDepartment,
  updateInviteStatus,
  updateMember,
} from '../sync';

const roles = ['owner', 'admin', 'department_lead', 'viewer', 'member'];
const scopes = ['global', 'department', 'project', 'self'];

function optionLabel(value) {
  const labels = {
    owner: 'Owner',
    admin: 'Admin',
    department_lead: '部门负责人',
    viewer: '观察者',
    member: '成员',
    global: '全局',
    department: '部门',
    project: '项目',
    self: '本人',
  };
  return labels[value] || value;
}

function MultiSelect({ values, options, getLabel, onChange }) {
  const selected = new Set(values || []);
  return (
    <div className="org-chip-list">
      {options.map((option) => {
        const id = option.id || option.value;
        const checked = selected.has(id);
        return (
          <button
            type="button"
            className={`person-chip${checked ? ' on' : ''}`}
            key={id}
            onClick={() => {
              const next = checked
                ? (values || []).filter((value) => value !== id)
                : [...(values || []), id];
              onChange(next);
            }}
          >
            {getLabel(option)}
          </button>
        );
      })}
      {options.length === 0 && <span className="muted-mini">暂无可选项</span>}
    </div>
  );
}

export default function OrgAdminTab() {
  const orgContext = useStore((s) => s.orgContext);
  const departments = useStore((s) => s.departments);
  const members = useStore((s) => s.organizationMembers);
  const invites = useStore((s) => s.organizationInvites);
  const projects = useStore((s) => s.projects);
  const setDepartments = useStore((s) => s.setDepartments);
  const setOrganizationMembers = useStore((s) => s.setOrganizationMembers);
  const setOrganizationInvites = useStore((s) => s.setOrganizationInvites);

  const [departmentName, setDepartmentName] = useState('');
  const [invite, setInvite] = useState({ email: '', role: 'member', access_scope: 'project', department_ids: [], project_ids: [] });
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState(orgContext?.member?.display_name || '');
  const access = getWriteAccess(orgContext?.member);
  const canManage = access.canManageOrg;
  const organizationId = orgContext?.organization?.id;

  const projectOptions = useMemo(() => projects.map((project) => ({ id: project.id || project.name, name: project.name })), [projects]);
  const departmentNameById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);

  const refreshAdminData = async () => {
    if (!organizationId) return;
    const { data, error } = await loadOrgAdminData(supabase, organizationId);
    if (error) {
      setMessage(error.message || '刷新组织数据失败');
      return;
    }
    setDepartments(data.departments);
    setOrganizationMembers(data.members);
    setOrganizationInvites(data.invites);
  };

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!canManage) {
      setMessage('当前账号没有新增部门权限。');
      return;
    }
    if (!organizationId) {
      setMessage('组织信息尚未加载完成，请刷新后重试。');
      return;
    }
    const nextName = departmentName.trim() || `新部门 ${departments.length + 1}`;
    const optimisticDepartment = {
      id: `pending-dept-${Date.now()}`,
      organization_id: organizationId,
      name: nextName,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessage('正在新增部门...');
    setDepartments([...departments, optimisticDepartment]);
    setDepartmentName('');
    if (orgContext?.legacyMode) {
      setMessage('部门已新增（当前为本地兼容模式，执行组织权限迁移后会云端保存）');
      return;
    }
    const { error } = await createDepartment(supabase, organizationId, nextName);
    if (error) {
      setDepartments(departments);
      setMessage(error.message || '新增部门失败；如果组织权限迁移尚未执行，请先执行 Supabase 迁移。');
      return;
    }
    setMessage('部门已新增');
    await refreshAdminData();
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!invite.email.trim() || !canManage) return;
    const { error } = await createInvite(supabase, organizationId, invite, orgContext.member.user_id);
    if (error) {
      setMessage(error.message || '创建邀请失败');
      return;
    }
    setInvite({ email: '', role: 'member', access_scope: 'project', department_ids: [], project_ids: [] });
    setMessage('邀请已创建，对方用同邮箱登录后会自动加入组织');
    await refreshAdminData();
  };

  const patchMember = async (id, patch) => {
    if (!canManage) return;
    const { error } = await updateMember(supabase, id, patch);
    if (error) {
      setMessage(error.message || '更新成员失败');
      return;
    }
    await refreshAdminData();
  };

  const handleUpdateOwnName = async (e) => {
    e.preventDefault();
    const memberId = orgContext?.member?.id;
    if (!memberId) return;
    const nextName = displayName.trim();
    const { error } = await updateMember(supabase, memberId, { display_name: nextName });
    if (error) {
      setMessage(error.message || '更新用户名失败');
      return;
    }
    setMessage('用户名已更新');
    await refreshAdminData();
  };

  if (!canManage) {
    return (
      <div className="card">
        <div className="stitle">组织管理</div>
        <div className="readonly-note">当前账号没有组织管理权限。</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="org-head">
          <div>
            <div className="stitle" style={{ marginBottom: 4 }}>组织管理</div>
            <div className="org-title">{orgContext?.organization?.name || '当前组织'}</div>
            <div className="org-sub">管理部门、邀请成员，并按角色与访问范围控制数据可见性。</div>
          </div>
          <span className="badge b-blue">{optionLabel(orgContext?.member?.role)}</span>
        </div>
        <form className="org-inline-form org-name-form" onSubmit={handleUpdateOwnName}>
          <input className="si" value={displayName} placeholder="我的用户名" onChange={e => setDisplayName(e.target.value)} />
          <button className="addbtn points-save-btn" type="submit">保存用户名</button>
        </form>
        {message && <div className="auth-sent org-message">{message}</div>}
      </div>

      <div className="card">
        <div className="stitle">部门</div>
        <form className="org-inline-form" onSubmit={handleAddDepartment}>
          <input className="si" value={departmentName} placeholder="新增部门名称" onChange={e => setDepartmentName(e.target.value)} />
          <button className="addbtn points-save-btn" type="submit">新增部门</button>
        </form>
        {departments.length === 0 && <div className="readonly-note">暂无部门。</div>}
        {departments.map((department) => (
          <div className="org-row" key={department.id}>
            <input className="si" value={department.name} onChange={async e => {
              await updateDepartment(supabase, department.id, { name: e.target.value });
              await refreshAdminData();
            }} />
            <button className="delbtn" onClick={async () => {
              if (!confirm('删除部门「' + department.name + '」？')) return;
              await deleteDepartment(supabase, department.id);
              await refreshAdminData();
            }}>×</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="stitle">邀请成员</div>
        <form onSubmit={handleInvite}>
          <div className="org-invite-grid">
            <div className="fld">
              <label>邮箱</label>
              <input value={invite.email} type="email" placeholder="member@company.com" onChange={e => setInvite({ ...invite, email: e.target.value })} />
            </div>
            <div className="fld">
              <label>角色</label>
              <select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>
                {roles.map(role => <option key={role} value={role}>{optionLabel(role)}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>访问范围</label>
              <select value={invite.access_scope} onChange={e => setInvite({ ...invite, access_scope: e.target.value })}>
                {scopes.map(scope => <option key={scope} value={scope}>{optionLabel(scope)}</option>)}
              </select>
            </div>
          </div>
          <div className="org-select-block">
            <label>可访问部门</label>
            <MultiSelect values={invite.department_ids} options={departments} getLabel={d => d.name} onChange={department_ids => setInvite({ ...invite, department_ids })} />
          </div>
          <div className="org-select-block">
            <label>可访问项目</label>
            <MultiSelect values={invite.project_ids} options={projectOptions} getLabel={p => p.name} onChange={project_ids => setInvite({ ...invite, project_ids })} />
          </div>
          <button className="addbtn points-save-btn org-submit" type="submit">创建邀请</button>
        </form>
      </div>

      <div className="card">
        <div className="stitle">成员</div>
        {members.map((member) => (
          <div className="org-member-row" key={member.id}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{member.display_name || member.email}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{member.email} · {member.status}</div>
              <div className="org-member-meta">
                <span>注册成员</span>
                <span>部门：{(member.department_ids || []).map(id => departmentNameById.get(id)).filter(Boolean).join('、') || '未指定'}</span>
                <span>角色：{optionLabel(member.role)}</span>
              </div>
            </div>
            <select className="si" value={member.role} onChange={e => patchMember(member.id, { role: e.target.value })}>
              {roles.map(role => <option key={role} value={role}>{optionLabel(role)}</option>)}
            </select>
            <select className="si" value={member.access_scope} onChange={e => patchMember(member.id, { access_scope: e.target.value })}>
              {scopes.map(scope => <option key={scope} value={scope}>{optionLabel(scope)}</option>)}
            </select>
            <MultiSelect values={member.department_ids || []} options={departments} getLabel={d => d.name} onChange={department_ids => patchMember(member.id, { department_ids })} />
            <MultiSelect values={member.project_ids || []} options={projectOptions} getLabel={p => p.name} onChange={project_ids => patchMember(member.id, { project_ids })} />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="stitle">邀请记录</div>
        {invites.length === 0 && <div className="readonly-note">暂无邀请记录。</div>}
        {invites.map((item) => (
          <div className="org-row" key={item.id}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.email}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                {optionLabel(item.role)} · {optionLabel(item.access_scope)} · {item.status}
              </div>
            </div>
            {item.status === 'pending' && (
              <button className="addbtn" onClick={async () => {
                await updateInviteStatus(supabase, item.id, 'revoked');
                await refreshAdminData();
              }}>撤销</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
