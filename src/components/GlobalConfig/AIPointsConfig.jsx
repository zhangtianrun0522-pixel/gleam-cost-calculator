import useStore from '../../store';
import { getWriteAccess } from '../../sync';

export default function AIPointsConfig() {
  const globalConfig = useStore(s => s.globalConfig);
  const setGlobalConfig = useStore(s => s.setGlobalConfig);
  const orgContext = useStore(s => s.orgContext);
  const canWrite = getWriteAccess(orgContext?.member).canWriteGlobal;

  const set = (key, val) => {
    if (!canWrite) return;
    setGlobalConfig({ ...globalConfig, [key]: val });
  };

  const { cSoft, cServer, cMisc } = globalConfig;

  return (
    <div className="card">
      <div className="stitle">固定成本（月）</div>
      <div className="g3">
        <div className="fld">
          <label>软件订阅（元）</label>
          <input type="number" value={cSoft} disabled={!canWrite}
            onChange={e => set('cSoft', Number(e.target.value))} />
        </div>
        <div className="fld">
          <label>服务器/云计算（元）</label>
          <input type="number" value={cServer} disabled={!canWrite}
            onChange={e => set('cServer', Number(e.target.value))} />
        </div>
        <div className="fld">
          <label>其他杂费（元）</label>
          <input type="number" value={cMisc} disabled={!canWrite}
            onChange={e => set('cMisc', Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}
