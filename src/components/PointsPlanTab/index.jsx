import { useMemo, useState } from 'react';
import useStore from '../../store';
import { calcEpisodePoints, calcProjectPoints, fmt, fmtPoints, getProjectAiConfig, hasProjectAiOverrides } from '../../calc';
import { getWriteAccess } from '../../sync';

const emptyBatchRow = { personId: '', personName: '', roleName: '', plannedPoints: '', grantedPoints: '' };

export default function PointsPlanTab() {
  const projects = useStore(s => s.projects);
  const platforms = useStore(s => s.platforms);
  const globalConfig = useStore(s => s.globalConfig);
  const people = useStore(s => s.people);
  const pointRecords = useStore(s => s.pointRecords);
  const addPointRecords = useStore(s => s.addPointRecords);
  const updatePointRecord = useStore(s => s.updatePointRecord);
  const deletePointRecord = useStore(s => s.deletePointRecord);
  const productionProgress = useStore(s => s.productionProgress);
  const updateProductionProgress = useStore(s => s.updateProductionProgress);
  const orgContext = useStore(s => s.orgContext);
  const canWrite = getWriteAccess(orgContext?.member).canWriteAny;

  const [reservePct, setReservePct] = useState(20);
  const [batchName, setBatchName] = useState('');
  const [batchDate, setBatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [batchProject, setBatchProject] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [batchRows, setBatchRows] = useState([emptyBatchRow]);
  const [issueProjectIdx, setIssueProjectIdx] = useState('');
  const [extraPersonId, setExtraPersonId] = useState('');
  const [openBatchIds, setOpenBatchIds] = useState({});
  const reserveRate = Math.max(Number(reservePct) || 0, 0) / 100;
  const platform = platforms.find(p => p.active) || platforms[0] || { name: '未配置平台', rate: 0 };
  const globalEpPoints = calcEpisodePoints(globalConfig);

  const rows = useMemo(() => projects.map(project => ({
    project,
    points: calcProjectPoints(project, globalConfig, reserveRate),
  })), [projects, globalConfig, reserveRate]);

  const totalBase = rows.reduce((sum, row) => sum + row.points.basePoints, 0);
  const totalReserve = rows.reduce((sum, row) => sum + row.points.reservePoints, 0);
  const totalPoints = totalBase + totalReserve;
  const estimatedCost = platform.rate > 0 ? totalPoints / platform.rate : 0;
  const totalEps = projects.reduce((sum, p) => sum + (Number(p.eps) || 0), 0);
  const issueProject = issueProjectIdx === '' ? null : projects[Number(issueProjectIdx)];
  const activeProjectName = batchProject || issueProject?.name || '';
  const activeProject = activeProjectName ? projects.find(project => project.name === activeProjectName) : null;
  const detailRows = activeProjectName
    ? rows.filter(({ project }) => project.name === activeProjectName)
    : rows;
  const scopedPointRecords = activeProjectName
    ? pointRecords.filter(record => record.projectName === activeProjectName)
    : pointRecords;
  const scopedPlannedPoints = activeProject ? calcProjectPoints(activeProject, globalConfig, reserveRate).totalPoints : totalPoints;
  const scopedIssuedPoints = scopedPointRecords.reduce((sum, record) => sum + (Number(record.grantedPoints) || 0), 0);
  const scopedRemainingPoints = scopedPlannedPoints - scopedIssuedPoints;
  const scopedEps = activeProject ? (Number(activeProject.eps) || 0) : totalEps;
  const expectedProgressRate = scopedPlannedPoints > 0 ? Math.min(scopedIssuedPoints / scopedPlannedPoints, 1) : 0;
  const expectedEpisode = Math.min(Math.floor(expectedProgressRate * scopedEps), scopedEps);
  const activeProgress = activeProjectName ? (productionProgress[activeProjectName] || {}) : {};
  const actualEpisode = Math.min(Math.max(Number(activeProgress.actualEpisode) || 0, 0), Math.max(scopedEps, 0));
  const actualProgressRate = scopedEps > 0 ? Math.min(actualEpisode / scopedEps, 1) : 0;
  const donutIssuedDeg = scopedPlannedPoints > 0 ? Math.min(scopedIssuedPoints / scopedPlannedPoints, 1) * 360 : 0;

  const getProjectDashboard = (project) => {
    const plannedPoints = calcProjectPoints(project, globalConfig, reserveRate).totalPoints;
    const records = pointRecords.filter(record => record.projectName === project.name);
    const issuedPoints = records.reduce((sum, record) => sum + (Number(record.grantedPoints) || 0), 0);
    const remainingPoints = plannedPoints - issuedPoints;
    const eps = Number(project.eps) || 0;
    const expectedRate = plannedPoints > 0 ? Math.min(issuedPoints / plannedPoints, 1) : 0;
    const expectedEp = Math.min(Math.floor(expectedRate * eps), eps);
    const progress = productionProgress[project.name] || {};
    const actualEp = Math.min(Math.max(Number(progress.actualEpisode) || 0, 0), eps);
    const actualRate = eps > 0 ? Math.min(actualEp / eps, 1) : 0;
    const issuedDeg = plannedPoints > 0 ? Math.min(issuedPoints / plannedPoints, 1) * 360 : 0;
    return { plannedPoints, issuedPoints, remainingPoints, eps, expectedRate, expectedEp, actualEp, actualRate, issuedDeg };
  };

  function getProjectRolePeople(row) {
    const rolePeople = people.filter(person => person.roleName === row.roleName && (person.status || 'active') !== 'inactive');
    if (Array.isArray(row.peopleIds) && row.peopleIds.length > 0) {
      return row.peopleIds.map(id => people.find(person => person.id === id)).filter(Boolean);
    }
    return rolePeople;
  }

  const buildRowsFromProject = (project) => {
    const staffing = project.staffing || [];
    const ratioTotal = staffing.reduce((sum, row) => sum + (Number(row.ratio) || 0), 0);
    if (ratioTotal <= 0) return [];
    const projectPoints = calcProjectPoints(project, globalConfig, reserveRate).totalPoints;
    const generatedRows = [];
    staffing.forEach((row) => {
      const roleRatio = Number(row.ratio) || 0;
      const rolePoints = projectPoints * roleRatio / ratioTotal;
      const selectedPeople = getProjectRolePeople(row);
      if (selectedPeople.length === 0) return;
      const perPersonPoints = rolePoints / selectedPeople.length;
      selectedPeople.forEach(person => {
        generatedRows.push({
          personId: person.id,
          personName: person.name,
          roleName: row.roleName,
          plannedPoints: Math.round(perPersonPoints),
          grantedPoints: '',
        });
      });
    });
    return generatedRows;
  };

  const projectPlanRows = activeProject ? buildRowsFromProject(activeProject) : [];

  const personUsageRows = useMemo(() => {
    const usage = new Map();
    if (activeProject) {
      projectPlanRows.forEach((row) => {
        const key = row.personId || row.personName;
        usage.set(key, {
          personId: row.personId,
          personName: row.personName || '未命名人员',
          roleName: row.roleName,
          plannedPoints: Number(row.plannedPoints) || 0,
          usedPoints: 0,
          batchCount: 0,
        });
      });
    }
    scopedPointRecords.forEach((record) => {
      const name = (record.personName || '').trim() || '未命名人员';
      const key = record.personId || name;
      const current = usage.get(key) || {
        personId: record.personId || '',
        personName: name,
        roleName: record.roleName || '',
        plannedPoints: Number(record.plannedPoints) || 0,
        usedPoints: 0,
        batchCount: 0,
      };
      if (!current.plannedPoints && record.plannedPoints) current.plannedPoints = Number(record.plannedPoints) || 0;
      current.usedPoints += Number(record.grantedPoints) || 0;
      current.batchCount += 1;
      usage.set(key, current);
    });
    return Array.from(usage.values())
      .map((item) => ({
        ...item,
        remainingPoints: item.plannedPoints - item.usedPoints,
        usageRate: item.plannedPoints > 0 ? item.usedPoints / item.plannedPoints : 0,
      }))
      .sort((a, b) => b.plannedPoints - a.plannedPoints);
  }, [activeProjectName, pointRecords, projects, people, globalConfig, reserveRate]);

  const selectedIssuePeopleIds = new Set(batchRows.map(row => row.personId).filter(Boolean));
  const selectableExtraPeople = people.filter(person => !selectedIssuePeopleIds.has(person.id) && (person.status || 'active') !== 'inactive');
  const issueProjectWarnings = useMemo(() => {
    if (!issueProject) return [];
    return (issueProject.staffing || [])
      .filter(row => getProjectRolePeople(row).length === 0)
      .map(row => row.roleName);
  }, [issueProject, people]);

  const updateBatchRow = (idx, patch) => {
    setBatchRows(batchRows.map((row, i) => i === idx ? { ...row, ...patch } : row));
  };

  const getProjectPersonHistory = (projectName, personId, personName) => (
    pointRecords
      .filter(record => (
        record.projectName === projectName
        && (
          (personId && record.personId === personId)
          || (!personId && record.personName === personName)
        )
      ))
      .reduce((sum, record) => sum + (Number(record.grantedPoints) || 0), 0)
  );

  const getRowCumulativeIssued = (row) => (
    getProjectPersonHistory(batchProject, row.personId, row.personName) + (Number(row.grantedPoints) || 0)
  );

  const getRowLimitClass = (row) => {
    const planned = Number(row.plannedPoints) || 0;
    if (planned <= 0) return 'b-gray';
    return getRowCumulativeIssued(row) > planned ? 'b-red' : 'b-green';
  };

  const addBatchRow = () => {
    setBatchRows([...batchRows, emptyBatchRow]);
  };

  const removeBatchRow = (idx) => {
    setBatchRows(batchRows.length === 1 ? [emptyBatchRow] : batchRows.filter((_, i) => i !== idx));
  };

  const applyProjectDraft = (project) => {
    const generatedRows = buildRowsFromProject(project);
    setBatchProject(project.name);
    setBatchName(`${project.name} · ${batchDate} 发放`);
    setBatchRows(generatedRows.length > 0 ? generatedRows : [emptyBatchRow]);
  };

  const handleIssueProjectChange = (value) => {
    if (value === issueProjectIdx) {
      setIssueProjectIdx('');
      setExtraPersonId('');
      setBatchProject('');
      setBatchRows([emptyBatchRow]);
      return;
    }
    setIssueProjectIdx(value);
    setExtraPersonId('');
    if (value === '') {
      setBatchProject('');
      setBatchRows([emptyBatchRow]);
      return;
    }
    const project = projects[Number(value)];
    if (project) applyProjectDraft(project);
  };

  const generateBatchFromProject = () => {
    if (!issueProject) return;
    const generatedRows = buildRowsFromProject(issueProject);
    if (generatedRows.length === 0) return;
    setBatchProject(issueProject.name);
    setBatchName(`${issueProject.name} · ${batchDate} 发放`);
    setBatchRows(generatedRows);
  };

  const addExtraPerson = (personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    setBatchRows([...batchRows, {
      personId: person.id,
      personName: person.name,
      roleName: person.roleName,
      plannedPoints: 0,
      grantedPoints: '',
      isTemporary: true,
    }]);
    setExtraPersonId('');
  };

  const submitBatch = (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const cleanRows = batchRows
      .map((row) => ({
        personId: row.personId || '',
        personName: row.personName.trim(),
        roleName: row.roleName || '',
        plannedPoints: Math.max(Number(row.plannedPoints) || 0, 0),
        grantedPoints: Math.max(Number(row.grantedPoints) || 0, 0),
        isTemporary: !!row.isTemporary,
      }))
      .filter((row) => row.personName && row.grantedPoints > 0);
    if (cleanRows.length === 0) return;
    const batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const records = cleanRows.map((row, idx) => ({
      id: `${batchId}-${idx}`,
      batchId,
      batchName: batchName.trim() || `积分批次 ${batchDate}`,
      date: batchDate,
      projectName: batchProject,
      note: batchNote.trim(),
      personId: row.personId,
      personName: row.personName,
      roleName: row.roleName,
      plannedPoints: row.plannedPoints,
      isTemporary: row.isTemporary,
      grantedPoints: row.grantedPoints,
      usedPoints: row.grantedPoints,
      createdAt: new Date().toISOString(),
    }));
    addPointRecords(records);
    setBatchName('');
    setBatchNote('');
    if (issueProject) {
      const refreshedRows = buildRowsFromProject(issueProject);
      setBatchRows(refreshedRows.length > 0 ? refreshedRows : [emptyBatchRow]);
    } else {
      setBatchRows([emptyBatchRow]);
    }
  };

  const batchGroups = useMemo(() => {
    const groups = new Map();
    scopedPointRecords.forEach((record) => {
      const key = record.batchId || `${record.batchName}-${record.date}`;
      const group = groups.get(key) || {
        id: key,
        batchName: record.batchName || '未命名批次',
        date: record.date || '',
        projectName: record.projectName || '',
        note: record.note || '',
        records: [],
        totalGranted: 0,
      };
      group.records.push(record);
      group.totalGranted += Number(record.grantedPoints) || 0;
      groups.set(key, group);
    });
    return Array.from(groups.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [scopedPointRecords]);

  const toggleBatch = (batchId) => {
    setOpenBatchIds(prev => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  return (
    <div>
      <div className="g2 points-total-summary">
        <div className="mc"><div className="ml">总申请积分</div><div className="mv">{fmtPoints(totalPoints)}</div><div className="ms">所有项目全集</div></div>
        <div className="mc"><div className="ml">预计金额</div><div className="mv bad">{fmt(estimatedCost)}</div><div className="ms">{platform.name} · {platform.rate || 0}积分/元</div></div>
      </div>
      {!canWrite && <div className="readonly-note">当前账号没有积分记录写权限，此页仅用于查看授权范围内的数据。</div>}

      <div className="points-dashboard-list">
        {projects.length === 0 ? (
          <div className="card" style={{ fontSize: 13, color: '#aaa', textAlign: 'center' }}>暂无项目，请先在「项目管理」中添加</div>
        ) : projects.map((project, idx) => {
          const dashboard = getProjectDashboard(project);
          const isActive = issueProjectIdx === String(idx);
          return (
            <div
              className={`card points-dashboard-card${isActive ? ' active' : ''}`}
              key={`${project.name}-${idx}`}
              onClick={() => handleIssueProjectChange(String(idx))}
            >
              <div className="points-dashboard-main">
                <div className="points-donut" style={{ background: `conic-gradient(#185FA5 0deg ${dashboard.issuedDeg}deg, #EAF3DE ${dashboard.issuedDeg}deg 360deg)` }}>
                  <div className="points-donut-inner">
                    <div className="points-donut-value">{dashboard.plannedPoints > 0 ? Math.round(dashboard.issuedPoints / dashboard.plannedPoints * 100) : 0}%</div>
                    <div className="points-donut-label">积分已发</div>
                  </div>
                </div>
                <div className="points-dashboard-copy">
                  <div className="points-dashboard-title">{project.name}</div>
                  <div className="points-dashboard-metrics">
                    <span className="badge b-blue">计划 {fmtPoints(dashboard.plannedPoints)}</span>
                    <span className="badge b-amber">已发 {fmtPoints(dashboard.issuedPoints)}</span>
                    <span className={`badge ${dashboard.remainingPoints >= 0 ? 'b-green' : 'b-red'}`}>剩余 {fmtPoints(dashboard.remainingPoints)}</span>
                  </div>
                  <div className="points-progress-rail">
                    <div className="points-progress-fill expected" style={{ width: `${dashboard.expectedRate * 100}%` }} />
                    <div className="points-progress-fill actual" style={{ width: `${dashboard.actualRate * 100}%` }} />
                  </div>
                  <div className="points-progress-legend">
                    <span><i className="legend-dot expected" />按积分应到第 {dashboard.expectedEp}/{dashboard.eps || 0} 集</span>
                    <span><i className="legend-dot actual" />实际做到第 {dashboard.actualEp}/{dashboard.eps || 0} 集</span>
                  </div>
                </div>
              </div>
              <div className="points-progress-input" onClick={e => e.stopPropagation()}>
                <div className="fld">
                  <label>实际制作进度（集）</label>
                  <input
                    type="number"
                    min="0"
                    max={dashboard.eps || 0}
                    value={productionProgress[project.name]?.actualEpisode ?? ''}
                    placeholder="填写集数"
                    disabled={!canWrite}
                    onChange={e => updateProductionProgress(project.name, { actualEpisode: Math.max(Number(e.target.value) || 0, 0) })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!issueProject && projects.length > 0 && (
        <div className="card points-select-empty">
          点击上方项目卡片查看该项目的积分发放、人员额度和历史批次。
        </div>
      )}

      {issueProject && (
      <>
      <div className="g4" style={{ marginBottom: 14 }}>
        <div className="mc"><div className="ml">项目申请积分</div><div className="mv">{fmtPoints(scopedPlannedPoints)}</div><div className="ms">{issueProject.name}</div></div>
        <div className="mc"><div className="ml">基础积分</div><div className="mv warn">{fmtPoints(calcProjectPoints(issueProject, globalConfig, 0).basePoints)}</div><div className="ms">不含预留</div></div>
        <div className="mc"><div className="ml">预留积分</div><div className="mv">{fmtPoints(scopedPlannedPoints - calcProjectPoints(issueProject, globalConfig, 0).basePoints)}</div><div className="ms">{reservePct}% 返工/试错</div></div>
        <div className="mc"><div className="ml">预计金额</div><div className="mv bad">{fmt(platform.rate > 0 ? scopedPlannedPoints / platform.rate : 0)}</div><div className="ms">{platform.name} · {platform.rate || 0}积分/元</div></div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div className="stitle" style={{ margin: 0 }}>积分计划口径</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 5 }}>
              按当前所有项目全集数计算，暂不拆月；项目变化后总积分实时重算
            </div>
          </div>
          <div className="fld" style={{ width: 150 }}>
            <label>安全预留比例（%）</label>
            <input type="number" min="0" step="5" value={reservePct}
              onChange={e => setReservePct(Number(e.target.value))} />
          </div>
        </div>
        <div className="g3">
          <div className="mc"><div className="ml">项目数</div><div className="mv">{projects.length}</div><div className="ms">个</div></div>
          <div className="mc"><div className="ml">总集数</div><div className="mv">{totalEps}</div><div className="ms">集</div></div>
          <div className="mc"><div className="ml">默认单集积分</div><div className="mv">{fmtPoints(globalEpPoints.totalPoints)}</div><div className="ms">分镜 {fmtPoints(globalEpPoints.videoPoints)} / 图像 {fmtPoints(globalEpPoints.imagePoints)}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="points-record-head">
          <div>
            <div className="stitle" style={{ margin: 0 }}>积分批次记录</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 5 }}>
              按批次给人员分配额度，并记录已使用积分
            </div>
          </div>
          <div className="points-record-metrics">
            <span className="badge b-blue">计划 {fmtPoints(scopedPlannedPoints)}</span>
            <span className="badge b-amber">已发 {fmtPoints(scopedIssuedPoints)}</span>
            <span className={`badge ${scopedRemainingPoints >= 0 ? 'b-green' : 'b-red'}`}>剩余 {fmtPoints(scopedRemainingPoints)}</span>
          </div>
        </div>

        <div className="points-issue-panel">
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>当前项目</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{issueProject ? issueProject.name : '点击上方项目卡片选择'}</div>
          </div>
          <div className="points-issue-summary">
            {issueProject ? (
              <>
                <span>{(issueProject.staffing || []).length} 个岗位</span>
                <span>{(issueProject.staffing || []).reduce((sum, row) => sum + getProjectRolePeople(row).length, 0)} 人</span>
                {issueProjectWarnings.length > 0 && <span className="bad">未选人：{issueProjectWarnings.join('、')}</span>}
              </>
            ) : (
              <span>先在项目管理中套模板并选择具体人员</span>
            )}
          </div>
          <button type="button" className="addbtn points-save-btn" onClick={generateBatchFromProject} disabled={!issueProject || !canWrite}>
            生成发放草稿
          </button>
        </div>

        <form onSubmit={submitBatch}>
          <div className="points-batch-meta">
            <div className="fld">
              <label>批次名称</label>
              <input value={batchName} disabled={!canWrite} placeholder="例如：5月第一批" onChange={e => setBatchName(e.target.value)} />
            </div>
            <div className="fld">
              <label>日期</label>
              <input type="date" value={batchDate} disabled={!canWrite} onChange={e => setBatchDate(e.target.value)} />
            </div>
            <div className="fld">
              <label>关联项目</label>
              <select value={batchProject} disabled={!canWrite} onChange={e => setBatchProject(e.target.value)}>
                <option value="">不指定项目</option>
                {projects.map((p, idx) => <option key={`${p.name}-${idx}`} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="points-batch-row points-batch-hdr">
            <span>人员</span>
            <span>岗位</span>
            <span>计划额度</span>
            <span>单次发放额度</span>
            <span>已使用</span>
            <span></span>
          </div>
          {batchRows.map((row, idx) => (
            <div className="points-batch-row" key={idx}>
              <input className="si" value={row.personName} disabled={!canWrite} placeholder="姓名/账号" onChange={e => updateBatchRow(idx, { personName: e.target.value })} />
              <input className="si" value={row.roleName} disabled={!canWrite} placeholder="岗位" onChange={e => updateBatchRow(idx, { roleName: e.target.value })} />
              <div className="points-plan-cell">
                {row.isTemporary ? '/' : fmtPoints(Number(row.plannedPoints) || 0)}
              </div>
              <input className="si" type="number" min="0" value={row.grantedPoints} disabled={!canWrite} placeholder="积分" onChange={e => updateBatchRow(idx, { grantedPoints: e.target.value })} />
              <div className={`points-used-cell ${getRowLimitClass(row)}`}>{fmtPoints(getRowCumulativeIssued(row))}</div>
              <button type="button" className="delbtn" disabled={!canWrite} onClick={() => removeBatchRow(idx)}>×</button>
            </div>
          ))}

          <div className="points-batch-actions">
            <input className="si" value={batchNote} disabled={!canWrite} placeholder="备注：用途、审批单、平台账号等" onChange={e => setBatchNote(e.target.value)} />
            <select className="si" value={extraPersonId} disabled={!canWrite} onChange={e => { setExtraPersonId(e.target.value); addExtraPerson(e.target.value); }}>
              <option value="">添加临时人员</option>
              {selectableExtraPeople.map(person => (
                <option key={person.id} value={person.id}>{person.name} · {person.roleName}</option>
              ))}
            </select>
            <button className="addbtn points-save-btn" type="submit" disabled={!canWrite}>保存批次</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="stitle">{activeProjectName ? `${activeProjectName} · 人员额度汇总` : '人员额度汇总'}</div>
        {personUsageRows.length === 0 ? (
          <div style={{ fontSize: 13, color: '#aaa', padding: '10px 0', textAlign: 'center' }}>
            暂无积分记录，先在上方保存一个批次
          </div>
        ) : (
          personUsageRows.map((person) => {
            const usedPct = Math.min(person.usageRate * 100, 100);
            return (
              <div className="points-usage-row" key={person.personName}>
                <div className="points-usage-person">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {person.personName}
                    <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 8 }}>
                      已使用 {fmtPoints(person.usedPoints)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {person.roleName || '未标记岗位'} · {person.batchCount} 个批次
                  </div>
                </div>
                <div className="points-usage-main">
                  <div className="bar-bg">
                    <div className="bar-fill" style={{ width: usedPct.toFixed(1) + '%', background: person.usageRate > 1 ? '#A32D2D' : '#3B6D11' }} />
                  </div>
                  <div className="points-usage-meta">
                    <span>已使用 {fmtPoints(person.usedPoints)}</span>
                    <span>额度 {fmtPoints(person.plannedPoints)}</span>
                    <span>剩余 {fmtPoints(person.remainingPoints)}</span>
                  </div>
                </div>
                <div className={`badge ${person.remainingPoints >= 0 ? 'b-green' : 'b-red'}`}>
                  {Math.round(person.usageRate * 100)}%
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="stitle">{activeProjectName ? `${activeProjectName} · 项目积分明细` : '项目积分明细'}</div>
        {detailRows.length === 0 && (
          <div style={{ fontSize: 13, color: '#aaa', padding: '10px 0', textAlign: 'center' }}>
            暂无项目，请先在「项目管理」中添加
          </div>
        )}
        {detailRows.map(({ project, points }, idx) => {
          const staffing = project.staffing || [];
          const ratioTotal = staffing.reduce((sum, s) => sum + (Number(s.ratio) || 0), 0);
          const projectEpPoints = calcEpisodePoints(getProjectAiConfig(project, globalConfig));
          const configLabel = hasProjectAiOverrides(project) ? '项目配置' : '全局默认';
          return (
            <div className="points-project" key={`${project.name}-${idx}`}>
              <div className="points-project-main">
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{project.name}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                    {points.eps}集 · 单集 {fmtPoints(projectEpPoints.totalPoints)} · {configLabel} · 预留 {reservePct}%
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{fmtPoints(points.totalPoints)}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                    基础 {fmtPoints(points.basePoints)} + 预留 {fmtPoints(points.reservePoints)}
                  </div>
                </div>
              </div>

              <div className="points-breakdown">
                <div className="points-pill">视频分镜 {fmtPoints(points.videoPoints)}</div>
                <div className="points-pill">图像生成 {fmtPoints(points.imagePoints)}</div>
                <div className="points-pill">预计金额 {fmt(platform.rate > 0 ? points.totalPoints / platform.rate : 0)}</div>
              </div>

              <div className="divider" />
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>人员/岗位分配（按 staffing ratio 自动拆分）</div>
              {staffing.length === 0 || ratioTotal <= 0 ? (
                <div style={{ fontSize: 12, color: '#aaa', padding: '6px 0' }}>当前项目未配置人员编排，无法拆分积分</div>
              ) : (
                staffing.map((s, sIdx) => {
                  const ratio = Number(s.ratio) || 0;
                  const allocated = ratioTotal > 0 ? points.totalPoints * ratio / ratioTotal : 0;
                  const pct = points.totalPoints > 0 ? allocated / points.totalPoints * 100 : 0;
                  return (
                    <div className="points-person-row" key={`${s.roleName}-${sIdx}`}>
                      <div style={{ minWidth: 110, fontSize: 12 }}>{s.roleName}</div>
                      <div style={{ flex: 1 }}>
                        <div className="bar-bg">
                          <div className="bar-fill" style={{ width: pct.toFixed(1) + '%', background: '#185FA5' }} />
                        </div>
                      </div>
                      <div style={{ width: 54, textAlign: 'right', fontSize: 11, color: '#999' }}>{pct.toFixed(1)}%</div>
                      <div style={{ width: 92, textAlign: 'right', fontSize: 12, fontWeight: 500 }}>{fmtPoints(allocated)}</div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="stitle">{activeProjectName ? `${activeProjectName} · 历史发放批次` : '历史发放批次'}</div>
        {batchGroups.length === 0 ? (
          <div style={{ fontSize: 13, color: '#aaa', padding: '10px 0', textAlign: 'center' }}>
            暂无历史批次
          </div>
        ) : (
          batchGroups.map((batch) => {
            const isOpen = !!openBatchIds[batch.id];
            return (
              <div className="points-batch-history" key={batch.id}>
                <button type="button" className="points-batch-history-head" onClick={() => toggleBatch(batch.id)}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{batch.batchName}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                      {batch.date}{batch.projectName ? ` · ${batch.projectName}` : ''} · {batch.records.length} 人
                    </div>
                  </div>
                  <div className="points-batch-history-total">
                    <span>{fmtPoints(batch.totalGranted)}</span>
                    <span style={{ color: '#bbb', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="points-batch-history-body">
                    {batch.note && <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>{batch.note}</div>}
                    {batch.records.map((record) => (
                      <div className="points-ledger-row" key={record.id}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{record.personName}</div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                            {record.roleName || '未标记岗位'} · 计划 {fmtPoints(Number(record.plannedPoints) || 0)}
                          </div>
                        </div>
                        <div className="points-ledger-edit">
                          <div className="fld">
                            <label>单次发放</label>
                            <input className="si" type="number" min="0" value={record.grantedPoints} disabled={!canWrite} onChange={e => updatePointRecord(record.id, { grantedPoints: Math.max(Number(e.target.value) || 0, 0), usedPoints: Math.max(Number(e.target.value) || 0, 0) })} />
                          </div>
                          <div className="fld">
                            <label>已使用</label>
                            <input className="si" type="number" min="0" value={record.usedPoints} disabled={!canWrite} onChange={e => updatePointRecord(record.id, { usedPoints: Math.max(Number(e.target.value) || 0, 0) })} />
                          </div>
                          <button className="delbtn" disabled={!canWrite} onClick={() => { if (confirm('删除这条积分记录？')) deletePointRecord(record.id); }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>
      )}
    </div>
  );
}
