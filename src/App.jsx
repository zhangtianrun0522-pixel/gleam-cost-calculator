import { lazy, Suspense, useState } from 'react';
import Header from './components/Header';
import AuthGate from './components/AuthGate';
import TabBar from './components/TabBar';
import GlobalConfig from './components/GlobalConfig';
import ProjectsTab from './components/ProjectsTab';
import PoolTab from './components/PoolTab';
import PointsPlanTab from './components/PointsPlanTab';
import OrgAdminTab from './components/OrgAdminTab';
import useStore from './store';
import { getWriteAccess } from './sync';

const CurveTab = lazy(() => import('./components/CurveTab'));

export default function App() {
  const [activeTab, setActiveTab] = useState('global');
  const orgContext = useStore((s) => s.orgContext);
  const access = getWriteAccess(orgContext?.member);
  const tabs = [
    { id: 'global', label: '全局配置' },
    { id: 'projects', label: '项目管理' },
    { id: 'points', label: '积分计划' },
    { id: 'pool', label: '资源池' },
    { id: 'curve', label: '成本曲线' },
    ...(access.canManageOrg ? [{ id: 'org', label: '组织管理' }] : []),
  ];

  return (
    <AuthGate>
      {({ user, syncStatus, onLogout }) => (
        <div className="wrap">
          <Header user={user} syncStatus={syncStatus} onLogout={onLogout} />
          <TabBar activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />
          {activeTab === 'global' && <GlobalConfig onNext={() => setActiveTab('projects')} />}
          {activeTab === 'projects' && <ProjectsTab />}
          {activeTab === 'points' && <PointsPlanTab />}
          {activeTab === 'pool' && <PoolTab />}
          {activeTab === 'curve' && (
            <Suspense fallback={<div className="card" style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>正在加载成本曲线...</div>}>
              <CurveTab />
            </Suspense>
          )}
          {activeTab === 'org' && <OrgAdminTab />}
        </div>
      )}
    </AuthGate>
  );
}
