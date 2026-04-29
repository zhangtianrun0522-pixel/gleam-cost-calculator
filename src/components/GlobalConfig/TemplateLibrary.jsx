import { useState } from 'react';
import useStore from '../../store';

export default function TemplateLibrary() {
  const templates = useStore(s => s.templates);
  const roles = useStore(s => s.roles);
  const projects = useStore(s => s.projects);
  const addTemplate = useStore(s => s.addTemplate);
  const deleteTemplate = useStore(s => s.deleteTemplate);
  const updateTemplate = useStore(s => s.updateTemplate);
  const updateProject = useStore(s => s.updateProject);

  const [openIdx, setOpenIdx] = useState(-1);
  const [applySel, setApplySel] = useState({});

  const toggle = (idx) => setOpenIdx(openIdx === idx ? -1 : idx);

  const handleDeleteTemplate = (idx) => {
    deleteTemplate(idx);
    if (openIdx === idx) setOpenIdx(-1);
    else if (openIdx > idx) setOpenIdx(openIdx - 1);
  };

  const handleAddRole = (tIdx) => {
    const newRoles = [...templates[tIdx].roles, { roleName: roles[0] ? roles[0].name : '编剧', ratio: 1.0 }];
    updateTemplate(tIdx, { roles: newRoles });
  };

  const handleRoleChange = (tIdx, rIdx, field, value) => {
    const newRoles = templates[tIdx].roles.map((r, i) =>
      i === rIdx ? { ...r, [field]: field === 'ratio' ? Number(value) : value } : r
    );
    updateTemplate(tIdx, { roles: newRoles });
  };

  const handleDeleteRole = (tIdx, rIdx) => {
    const newRoles = templates[tIdx].roles.filter((_, i) => i !== rIdx);
    updateTemplate(tIdx, { roles: newRoles });
  };

  const handleApply = (tIdx, projIdxStr) => {
    if (projIdxStr === '') return;
    const staffing = templates[tIdx].roles.map(r => ({ roleName: r.roleName, ratio: r.ratio }));
    updateProject(Number(projIdxStr), { staffing });
    setApplySel(prev => ({ ...prev, [tIdx]: '' }));
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="stitle" style={{ margin: 0 }}>制作组模板库</div>
        <button className="addbtn" onClick={() => { addTemplate({ name: '新模板', roles: [] }); setOpenIdx(templates.length); }}>
          + 新增模板
        </button>
      </div>

      {templates.length === 0 && (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
          暂无模板，点击上方按钮新增
        </div>
      )}

      {templates.map((tpl, tIdx) => {
        const isOpen = openIdx === tIdx;
        return (
          <div key={tIdx} style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 8 }}
              onClick={() => toggle(tIdx)}>
              <span style={{ fontWeight: 500, flex: 1, fontSize: 13 }}>{tpl.name}</span>
              <span className="badge" style={{ background: '#f0f0ee', color: '#666', border: '1px solid #e5e5e5', fontSize: 11 }}>
                {tpl.roles.length}个岗位
              </span>
              <span style={{ color: '#bbb', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
              <button className="delbtn" onClick={e => { e.stopPropagation(); handleDeleteTemplate(tIdx); }}>×</button>
            </div>

            {isOpen && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f0f0f0' }}>
                <div className="fld" style={{ marginBottom: 10, marginTop: 10 }}>
                  <label>模板名称</label>
                  <input className="si" value={tpl.name}
                    onChange={e => updateTemplate(tIdx, { name: e.target.value })} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div className="stitle" style={{ margin: 0 }}>岗位配置</div>
                  <button className="addbtn" onClick={() => handleAddRole(tIdx)}>+ 新增条目</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 28px', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#aaa' }}>岗位名称</span>
                  <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>占用比例</span>
                  <span></span>
                </div>

                {tpl.roles.map((r, rIdx) => (
                  <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 28px', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                    <input className="si" value={r.roleName} list={`tpl-roles-dl-${tIdx}`}
                      onChange={e => handleRoleChange(tIdx, rIdx, 'roleName', e.target.value)} />
                    <input className="si" type="number" value={r.ratio} step={0.1} min={0}
                      style={{ textAlign: 'center' }}
                      onChange={e => handleRoleChange(tIdx, rIdx, 'ratio', e.target.value)} />
                    <button className="delbtn" onClick={() => handleDeleteRole(tIdx, rIdx)}>×</button>
                  </div>
                ))}

                <datalist id={`tpl-roles-dl-${tIdx}`}>
                  {roles.map(r => <option key={r.name} value={r.name} />)}
                </datalist>

                {projects.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>套用到项目</span>
                    <select className="si" style={{ flex: 1 }}
                      value={applySel[tIdx] ?? ''}
                      onChange={e => { setApplySel(prev => ({ ...prev, [tIdx]: e.target.value })); handleApply(tIdx, e.target.value); }}>
                      <option value="">选择项目…</option>
                      {projects.map((p, pIdx) => <option key={pIdx} value={pIdx}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
