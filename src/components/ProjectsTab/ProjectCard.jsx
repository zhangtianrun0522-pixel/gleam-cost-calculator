import { useState } from 'react';
import useStore from '../../store';
import { calcEpisodePoints, calcProjectCost, fmt, fmtPoints, getEffectiveRoleCount, getProjectAiConfig, hasProjectAiOverrides } from '../../calc';

export default function ProjectCard({ project, isOpen, onToggle, onUpdate, onDelete, canWrite = true, canDelete = true, departments = [], departmentOptions = departments }) {
  const platforms = useStore(s => s.platforms);
  const globalConfig = useStore(s => s.globalConfig);
  const roles = useStore(s => s.roles);
  const templates = useStore(s => s.templates);
  const projects = useStore(s => s.projects);
  const people = useStore(s => s.people);
  const [tplSel, setTplSel] = useState("");

  const c = calcProjectCost(project, platforms, globalConfig, roles, people);
  const aiConfig = getProjectAiConfig(project, globalConfig);
  const usesProjectAiConfig = hasProjectAiOverrides(project);
  const epPoints = calcEpisodePoints(aiConfig);
  const globalEpPoints = calcEpisodePoints(globalConfig);
  const shotRatio = Number(aiConfig.shotRatio) || 1;
  const aiDur = Number(aiConfig.aiDur) || 0;
  const actualDur = Math.round(aiDur * shotRatio);
  const department = departments.find(item => item.id === project.departmentId);
  const updateAiConfig = (key, value) => {
    if (!canWrite) return;
    onUpdate({ aiConfig: { ...(project.aiConfig || {}), [key]: value } });
  };
  const useProjectAiDefaults = () => canWrite && onUpdate({ aiConfig: getProjectAiConfig(null, globalConfig) });
  const resetProjectAiConfig = () => canWrite && onUpdate({ aiConfig: null });

  const globalDemand = {};
  projects.forEach(p => {
    (p.staffing || []).forEach(s => {
      if (!globalDemand[s.roleName]) globalDemand[s.roleName] = 0;
      globalDemand[s.roleName] += s.ratio;
    });
  });

  const updateStaffing = (idx, patch) => {
    if (!canWrite) return;
    const newStaffing = [...project.staffing];
    newStaffing[idx] = { ...newStaffing[idx], ...patch };
    onUpdate({ staffing: newStaffing });
  };

  const toggleStaffingPerson = (idx, personId) => {
    if (!canWrite) return;
    const row = project.staffing[idx] || {};
    const rolePeople = people.filter(p => p.roleName === row.roleName && (p.status || 'active') !== 'inactive');
    const peopleIds = Array.isArray(row.peopleIds) && row.peopleIds.length > 0
      ? row.peopleIds
      : rolePeople.map(p => p.id);
    const nextPeopleIds = peopleIds.includes(personId)
      ? peopleIds.filter(id => id !== personId)
      : [...peopleIds, personId];
    updateStaffing(idx, { peopleIds: nextPeopleIds });
  };

  const handleDelete = (e) => { e.stopPropagation(); if (!canDelete) return; if (confirm('删除项目「' + project.name + '」？')) onDelete(); };

  return (
    <div className={`proj-card${isOpen ? " open" : ""}`}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>{project.name}</strong>
          <span className="badge b-gray">{project.eps}集 · {project.days}天</span>
          <span className="badge b-blue">{department?.name || '未分部门'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="badge b-amber">{fmt(c.total)}</span>
          <span className={`badge ${c.net >= 0 ? 'b-green' : 'b-red'}`}>
            {c.net >= 0 ? "+" : ""}{fmt(c.net)}
          </span>
          <span style={{ fontSize: 12, color: '#bbb' }}>{isOpen ? '▲' : '▼'}</span>
          <button className="delbtn" onClick={handleDelete} disabled={!canDelete}>×</button>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div className="fld">
              <label>项目名称</label>
              <input className="si" value={project.name} disabled={!canWrite} onChange={e => onUpdate({ name: e.target.value })} />
            </div>
            <div className="fld">
              <label>所属部门</label>
              <select className="si" value={project.departmentId || ''} disabled={!canWrite} onChange={e => onUpdate({ departmentId: e.target.value })}>
                <option value="">未分部门</option>
                {department && !departmentOptions.some(item => item.id === department.id) && (
                  <option value={department.id}>{department.name}</option>
                )}
                {departmentOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>总集数</label>
              <input className="si" type="number" value={project.eps} disabled={!canWrite} onChange={e => onUpdate({ eps: Math.max(1, +e.target.value) })} />
            </div>
          </div>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div className="fld">
              <label>制作周期（天）</label>
              <input className="si" type="number" value={project.days} disabled={!canWrite} onChange={e => onUpdate({ days: Math.max(1, +e.target.value) })} />
            </div>
          </div>
          <div className="fld" style={{ marginBottom: 10, maxWidth: 220 }}>
            <label>脚本外包费用（元）</label>
            <input className="si" type="number" value={project.scriptCost || 0} disabled={!canWrite} onChange={e => onUpdate({ scriptCost: +e.target.value })} />
          </div>

          <div className="project-ai-config">
            <div className="project-ai-config-head">
              <div>
                <div className="stitle" style={{ margin: 0 }}>AI 积分配置</div>
                <div className="project-ai-copy">
                  {usesProjectAiConfig ? '当前项目使用独立积分口径' : '当前项目继承全局默认积分口径'}
                </div>
              </div>
              <div className="project-ai-actions">
                {usesProjectAiConfig ? (
                  <button className="addbtn" type="button" onClick={resetProjectAiConfig} disabled={!canWrite}>恢复全局默认</button>
                ) : (
                  <button className="addbtn" type="button" onClick={useProjectAiDefaults} disabled={!canWrite}>启用项目配置</button>
                )}
              </div>
            </div>
            <div className="g3">
              <div className="fld">
                <label>生成速率（积分/s）</label>
                <input className="si" type="number" step="0.5" disabled={!canWrite || !usesProjectAiConfig} value={aiConfig.aiRate ?? 0}
                  onChange={e => updateAiConfig('aiRate', Number(e.target.value))} />
              </div>
              <div className="fld">
                <label>每集成片时长（s）</label>
                <input className="si" type="number" disabled={!canWrite || !usesProjectAiConfig} value={aiConfig.aiDur ?? 0}
                  onChange={e => updateAiConfig('aiDur', Number(e.target.value))} />
              </div>
              <div className="fld">
                <label>片比（成片 : 素材）</label>
                <input className="si" type="number" step="0.1" min="1.0" disabled={!canWrite || !usesProjectAiConfig} value={aiConfig.shotRatio ?? 1}
                  onChange={e => updateAiConfig('shotRatio', Math.round(Number(e.target.value) * 10) / 10)} />
              </div>
            </div>
            <div className="project-shot-summary">
              实际生成素材 <strong>{actualDur}s</strong>
              <span>（成片 {aiDur}s × 片比 {shotRatio.toFixed(1)}）</span>
              <span>→ 每集分镜积分 <strong>{Math.round(epPoints.videoPoints).toLocaleString()} 积分</strong></span>
            </div>
            <div className="g2 project-ai-image-row">
              <div className="fld">
                <label>图像积分/张</label>
                <input className="si" type="number" disabled={!canWrite || !usesProjectAiConfig} value={aiConfig.aiImgPts ?? 0}
                  onChange={e => updateAiConfig('aiImgPts', Number(e.target.value))} />
              </div>
              <div className="fld">
                <label>每集图像数量（张）</label>
                <input className="si" type="number" disabled={!canWrite || !usesProjectAiConfig} value={aiConfig.aiImgN ?? 0}
                  onChange={e => updateAiConfig('aiImgN', Number(e.target.value))} />
              </div>
            </div>
            <div className="project-ai-summary">
              <span>单集 {fmtPoints(epPoints.totalPoints)}</span>
              <span>分镜 {fmtPoints(epPoints.videoPoints)}</span>
              <span>图像 {fmtPoints(epPoints.imagePoints)}</span>
              {!usesProjectAiConfig && <span>全局默认单集 {fmtPoints(globalEpPoints.totalPoints)}</span>}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="stitle" style={{ margin: 0 }}>人员编排</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select className="si" style={{ width: 140 }} value={tplSel} disabled={!canWrite} onChange={e => setTplSel(e.target.value)}>
                  <option value="">选择模板...</option>
                  {templates.map((t, ti) => <option key={ti} value={ti}>{t.name}</option>)}
                </select>
                <button className="addbtn" disabled={!canWrite} onClick={() => {
                  const tpl = templates[parseInt(tplSel)];
                  if (tpl) { onUpdate({ staffing: tpl.roles.map(r => ({ roleName: r.roleName, ratio: r.ratio })) }); setTplSel(""); }
                }}>套用</button>
                <button className="addbtn" disabled={!canWrite} onClick={() => onUpdate({ staffing: [...(project.staffing || []), { roleName: "编剧", ratio: 1 }] })}>+ 新增岗位</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>配置每个岗位的人力占用比例，并选择该项目实际制作人员</div>

            <div className="staffing-row staffing-hdr">
              <span>岗位名称</span>
              <span style={{ textAlign: 'center' }}>占用比例</span>
              <span style={{ textAlign: 'center' }}>公司人数</span>
              <span style={{ textAlign: 'center' }}>全项目占用</span>
              <span style={{ textAlign: 'center' }}>状态</span>
              <span>项目人员</span>
              <span></span>
            </div>

            {(project.staffing || []).length === 0 && (
              <div style={{ color: '#aaa', fontSize: 13, padding: '8px 0' }}>当前无人员编排，建议从上方套用模板</div>
            )}

            {(project.staffing || []).map((s, sIdx) => {
              const role = roles.find(r => r.name === s.roleName);
              const count = role ? getEffectiveRoleCount(role, people) : 0;
              const rolePeople = people.filter(p => p.roleName === s.roleName && (p.status || 'active') !== 'inactive');
              const selectedIds = Array.isArray(s.peopleIds) && s.peopleIds.length > 0
                ? s.peopleIds
                : rolePeople.map(p => p.id);
              const selectedPeople = rolePeople.filter(p => selectedIds.includes(p.id));
              const globalRatio = count > 0 ? (globalDemand[s.roleName] || 0) / count : 0;
              const gDemandStr = (globalDemand[s.roleName] || 0).toFixed(2);
              let statusBadge, rowBg = {};
              if (!role) {
                statusBadge = <span className="badge b-red">未配置</span>;
              } else if (globalRatio > 1) {
                statusBadge = <span className="badge b-red">超载 {Math.round((globalRatio - 1) * 100)}%</span>;
                rowBg = { background: '#fff8f8' };
              } else if (globalRatio > 0.8) {
                statusBadge = <span className="badge b-amber">紧张 {Math.round(globalRatio * 100)}%</span>;
              } else {
                statusBadge = <span className="badge b-green">充足 {Math.round(globalRatio * 100)}%</span>;
              }
              return (
                <div key={sIdx} className="staffing-row" style={rowBg}>
                  <select className="si" value={s.roleName} disabled={!canWrite} onChange={e => updateStaffing(sIdx, { roleName: e.target.value, peopleIds: [] })}>
                    {s.roleName && !roles.some(item => item.name === s.roleName) && (
                      <option value={s.roleName}>{s.roleName}</option>
                    )}
                    {roles.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                  <input className="si" type="number" step={0.1} min={0} value={s.ratio} disabled={!canWrite} onChange={e => updateStaffing(sIdx, { ratio: +e.target.value })} style={{ textAlign: 'center' }} />
                  <div style={{ fontSize: 12, textAlign: 'center', color: role ? '#1a1a1a' : '#854F0B' }}>{count > 0 ? count : '—'}</div>
                  <div style={{ fontSize: 12, textAlign: 'center', color: '#888' }}>{gDemandStr}</div>
                  <div style={{ textAlign: 'center' }}>{statusBadge}</div>
                  <div className="staffing-people-picker">
                    {rolePeople.length === 0 ? (
                      <span style={{ fontSize: 11, color: '#aaa' }}>暂无人员</span>
                    ) : (
                      rolePeople.map(person => {
                        const checked = selectedPeople.some(p => p.id === person.id);
                        return (
                          <button
                            type="button"
                            className={`person-chip${checked ? ' on' : ''}${person.status === 'busy' ? ' busy' : ''}`}
                            key={person.id}
                            disabled={!canWrite}
                            onClick={() => toggleStaffingPerson(sIdx, person.id)}
                            title={person.pointsAccount || person.note || person.name}
                          >
                            {person.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <button className="delbtn" disabled={!canWrite} onClick={() => onUpdate({ staffing: project.staffing.filter((_, si) => si !== sIdx) })}>×</button>
                </div>
              );
            })}
          </div>

          <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />

          <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>收入预测</div>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div className="fld">
              <label>平台分成/集（元）</label>
              <input className="si" type="number" value={project.revPlat || 0} disabled={!canWrite} onChange={e => onUpdate({ revPlat: +e.target.value })} />
            </div>
            <div className="fld">
              <label>品牌植入（元）</label>
              <input className="si" type="number" value={project.revBrand || 0} disabled={!canWrite} onChange={e => onUpdate({ revBrand: +e.target.value })} />
            </div>
            <div className="fld">
              <label>版权/发行（元）</label>
              <input className="si" type="number" value={project.revLic || 0} disabled={!canWrite} onChange={e => onUpdate({ revLic: +e.target.value })} />
            </div>
          </div>
          <div className="g3">
            <div className="fld">
              <label>IP衍生品（元）</label>
              <input className="si" type="number" value={project.revMerch || 0} disabled={!canWrite} onChange={e => onUpdate({ revMerch: +e.target.value })} />
            </div>
            <div className="fld">
              <label>预估播放量（万次）</label>
              <input className="si" type="number" value={project.revViews || 0} disabled={!canWrite} onChange={e => onUpdate({ revViews: +e.target.value })} />
            </div>
            <div className="fld">
              <label>广告CPM（元/千次）</label>
              <input className="si" type="number" value={project.revCpm || 0} disabled={!canWrite} onChange={e => onUpdate({ revCpm: +e.target.value })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
