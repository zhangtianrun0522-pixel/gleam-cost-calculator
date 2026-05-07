import useStore from '../store';
import { calcProjectCost, fmt, getBottleneck } from '../calc';

export default function Header({ user, syncStatus, onLogout }) {
  const projects = useStore((s) => s.projects);
  const platforms = useStore((s) => s.platforms);
  const globalConfig = useStore((s) => s.globalConfig);
  const roles = useStore((s) => s.roles);

  const totalCost = projects.reduce(
    (sum, p) => sum + calcProjectCost(p, platforms, globalConfig, roles).total,
    0
  );
  const bottleneck = getBottleneck(projects, roles);

  return (
    <div className="hd">
      <div>
        <div className="hd-title">制作成本核算器</div>
        <div className="hd-sub">Gleam Studio · AI短剧</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="hd-badges">
          <span className="badge b-gray">项目 {projects.length} 个</span>
          <span className="badge b-amber">总成本 {fmt(totalCost)}</span>
          <span className={`badge ${bottleneck ? 'b-red' : 'b-green'}`}>
            {bottleneck ? '瓶颈: ' + bottleneck : '资源充足'}
          </span>
        </div>
        <div className="auth-chip">
          <span className={syncStatus === 'error' ? 'bad' : ''}>
            {syncStatus === 'syncing' ? '同步中...' : syncStatus === 'saved' ? '已同步' : syncStatus === 'loading' ? '读取中...' : syncStatus === 'error' ? '同步失败' : '已登录'}
          </span>
          <span>{user?.user_metadata?.team_name || user?.email}</span>
          <button onClick={onLogout}>退出</button>
        </div>
      </div>
    </div>
  );
}
