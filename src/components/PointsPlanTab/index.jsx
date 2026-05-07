import { useMemo, useState } from 'react';
import useStore from '../../store';
import { calcEpisodePoints, calcProjectPoints, fmt, fmtPoints } from '../../calc';

export default function PointsPlanTab() {
  const projects = useStore(s => s.projects);
  const platforms = useStore(s => s.platforms);
  const globalConfig = useStore(s => s.globalConfig);

  const [reservePct, setReservePct] = useState(20);
  const reserveRate = Math.max(Number(reservePct) || 0, 0) / 100;
  const platform = platforms.find(p => p.active) || platforms[0] || { name: '未配置平台', rate: 0 };
  const epPoints = calcEpisodePoints(globalConfig);

  const rows = useMemo(() => projects.map(project => ({
    project,
    points: calcProjectPoints(project, globalConfig, reserveRate),
  })), [projects, globalConfig, reserveRate]);

  const totalBase = rows.reduce((sum, row) => sum + row.points.basePoints, 0);
  const totalReserve = rows.reduce((sum, row) => sum + row.points.reservePoints, 0);
  const totalPoints = totalBase + totalReserve;
  const estimatedCost = platform.rate > 0 ? totalPoints / platform.rate : 0;
  const totalEps = projects.reduce((sum, p) => sum + (Number(p.eps) || 0), 0);

  return (
    <div>
      <div className="g4" style={{ marginBottom: 14 }}>
        <div className="mc"><div className="ml">总申请积分</div><div className="mv">{fmtPoints(totalPoints)}</div><div className="ms">所有项目全集</div></div>
        <div className="mc"><div className="ml">基础积分</div><div className="mv warn">{fmtPoints(totalBase)}</div><div className="ms">不含预留</div></div>
        <div className="mc"><div className="ml">预留积分</div><div className="mv">{fmtPoints(totalReserve)}</div><div className="ms">{reservePct}% 返工/试错</div></div>
        <div className="mc"><div className="ml">预计金额</div><div className="mv bad">{fmt(estimatedCost)}</div><div className="ms">{platform.name} · {platform.rate || 0}积分/元</div></div>
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
          <div className="mc"><div className="ml">单集积分</div><div className="mv">{fmtPoints(epPoints.totalPoints)}</div><div className="ms">视频 {fmtPoints(epPoints.videoPoints)} / 图像 {fmtPoints(epPoints.imagePoints)}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="stitle">项目积分明细</div>
        {rows.length === 0 && (
          <div style={{ fontSize: 13, color: '#aaa', padding: '10px 0', textAlign: 'center' }}>
            暂无项目，请先在「项目管理」中添加
          </div>
        )}
        {rows.map(({ project, points }, idx) => {
          const staffing = project.staffing || [];
          const ratioTotal = staffing.reduce((sum, s) => sum + (Number(s.ratio) || 0), 0);
          return (
            <div className="points-project" key={`${project.name}-${idx}`}>
              <div className="points-project-main">
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{project.name}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                    {points.eps}集 · 单集 {fmtPoints(epPoints.totalPoints)} · 预留 {reservePct}%
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
    </div>
  );
}
