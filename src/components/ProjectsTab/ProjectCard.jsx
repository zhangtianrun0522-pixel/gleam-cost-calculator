import { useState } from 'react';
import useStore from '../../store';
import { calcProjectCost, fmt } from '../../calc';

export default function ProjectCard({ project, isOpen, onToggle, onUpdate, onDelete }) {
  const platforms = useStore(s => s.platforms);
  const globalConfig = useStore(s => s.globalConfig);
  const roles = useStore(s => s.roles);
  const templates = useStore(s => s.templates);
  const projects = useStore(s => s.projects);
  const [tplSel, setTplSel] = useState("");

  const c = calcProjectCost(project, platforms, globalConfig, roles);

  const globalDemand = {};
  projects.forEach(p => {
    (p.staffing || []).forEach(s => {
      if (!globalDemand[s.roleName]) globalDemand[s.roleName] = 0;
      globalDemand[s.roleName] += s.ratio;
    });
  });

  const dlId = "staffing-role-dl-" + project.name.replace(/[^a-zA-Z0-9]/g, "-");

  const updateStaffing = (idx, patch) => {
    const newStaffing = [...project.staffing];
    newStaffing[idx] = { ...newStaffing[idx], ...patch };
    onUpdate({ staffing: newStaffing });
  };

  const handleDelete = (e) => { e.stopPropagation(); if (confirm('删除项目「' + project.name + '」？')) onDelete(); };

  return (
    <div className={`proj-card${isOpen ? " open" : ""}`}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>{project.name}</strong>
          <span className="badge b-gray">{project.eps}集 · {project.days}天</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="badge b-amber">{fmt(c.total)}</span>
          <span className={`badge ${c.net >= 0 ? 'b-green' : 'b-red'}`}>
            {c.net >= 0 ? "+" : ""}{fmt(c.net)}
          </span>
          <span style={{ fontSize: 12, color: '#bbb' }}>{isOpen ? '▲' : '▼'}</span>
          <button className="delbtn" onClick={handleDelete}>×</button>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div className="fld">
              <label>项目名称</label>
              <input className="si" value={project.name} onChange={e => onUpdate({ name: e.target.value })} />
            </div>
            <div className="fld">
              <label>总集数</label>
              <input className="si" type="number" value={project.eps} onChange={e => onUpdate({ eps: Math.max(1, +e.target.value) })} />
            </div>
            <div className="fld">
              <label>制作周期（天）</label>
              <input className="si" type="number" value={project.days} onChange={e => onUpdate({ days: Math.max(1, +e.target.value) })} />
            </div>
          </div>
          <div className="fld" style={{ marginBottom: 10, maxWidth: 220 }}>
            <label>脚本外包费用（元）</label>
            <input className="si" type="number" value={project.scriptCost || 0} onChange={e => onUpdate({ scriptCost: +e.target.value })} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="stitle" style={{ margin: 0 }}>人员编排</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select className="si" style={{ width: 140 }} value={tplSel} onChange={e => setTplSel(e.target.value)}>
                  <option value="">选择模板...</option>
                  {templates.map((t, ti) => <option key={ti} value={ti}>{t.name}</option>)}
                </select>
                <button className="addbtn" onClick={() => {
                  const tpl = templates[parseInt(tplSel)];
                  if (tpl) { onUpdate({ staffing: tpl.roles.map(r => ({ roleName: r.roleName, ratio: r.ratio })) }); setTplSel(""); }
                }}>套用</button>
                <button className="addbtn" onClick={() => onUpdate({ staffing: [...(project.staffing || []), { roleName: "编剧", ratio: 1 }] })}>+ 新增岗位</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>配置每个岗位的人力占用比例</div>

            <div style={{ display: 'grid', gridTemplateColumns: "1.5fr 55px 55px 65px 80px 28px", fontSize: 10, color: '#aaa', gap: 6, marginBottom: 4, paddingBottom: 6, borderBottom: '1px solid #e8e8e8' }}>
              <span>岗位名称</span>
              <span style={{ textAlign: 'center' }}>占用比例</span>
              <span style={{ textAlign: 'center' }}>公司人数</span>
              <span style={{ textAlign: 'center' }}>全项目占用</span>
              <span style={{ textAlign: 'center' }}>状态</span>
              <span></span>
            </div>

            {(project.staffing || []).length === 0 && (
              <div style={{ color: '#aaa', fontSize: 13, padding: '8px 0' }}>当前无人员编排，建议从上方套用模板</div>
            )}

            {(project.staffing || []).map((s, sIdx) => {
              const role = roles.find(r => r.name === s.roleName);
              const count = role ? role.count : 0;
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
                <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: "1.5fr 55px 55px 65px 80px 28px", gap: 6, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0f0f0', ...rowBg }}>
                  <input className="si" list={dlId} value={s.roleName} onChange={e => updateStaffing(sIdx, { roleName: e.target.value })} />
                  <input className="si" type="number" step={0.1} min={0} value={s.ratio} onChange={e => updateStaffing(sIdx, { ratio: +e.target.value })} style={{ textAlign: 'center' }} />
                  <div style={{ fontSize: 12, textAlign: 'center', color: role ? '#1a1a1a' : '#854F0B' }}>{count > 0 ? count : '—'}</div>
                  <div style={{ fontSize: 12, textAlign: 'center', color: '#888' }}>{gDemandStr}</div>
                  <div style={{ textAlign: 'center' }}>{statusBadge}</div>
                  <button className="delbtn" onClick={() => onUpdate({ staffing: project.staffing.filter((_, si) => si !== sIdx) })}>×</button>
                </div>
              );
            })}

            <datalist id={dlId}>
              {roles.map(r => <option key={r.name} value={r.name} />)}
            </datalist>
          </div>

          <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />

          <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>收入预测</div>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div className="fld">
              <label>平台分成/集（元）</label>
              <input className="si" type="number" value={project.revPlat || 0} onChange={e => onUpdate({ revPlat: +e.target.value })} />
            </div>
            <div className="fld">
              <label>品牌植入（元）</label>
              <input className="si" type="number" value={project.revBrand || 0} onChange={e => onUpdate({ revBrand: +e.target.value })} />
            </div>
            <div className="fld">
              <label>版权/发行（元）</label>
              <input className="si" type="number" value={project.revLic || 0} onChange={e => onUpdate({ revLic: +e.target.value })} />
            </div>
          </div>
          <div className="g3">
            <div className="fld">
              <label>IP衍生品（元）</label>
              <input className="si" type="number" value={project.revMerch || 0} onChange={e => onUpdate({ revMerch: +e.target.value })} />
            </div>
            <div className="fld">
              <label>预估播放量（万次）</label>
              <input className="si" type="number" value={project.revViews || 0} onChange={e => onUpdate({ revViews: +e.target.value })} />
            </div>
            <div className="fld">
              <label>广告CPM（元/千次）</label>
              <input className="si" type="number" value={project.revCpm || 0} onChange={e => onUpdate({ revCpm: +e.target.value })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
