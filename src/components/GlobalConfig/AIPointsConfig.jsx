import useStore from '../../store';

export default function AIPointsConfig() {
  const globalConfig = useStore(s => s.globalConfig);
  const setGlobalConfig = useStore(s => s.setGlobalConfig);

  const set = (key, val) => setGlobalConfig({ ...globalConfig, [key]: val });

  const { cSoft, cServer, cMisc } = globalConfig;

  return (
    <div className="card">
      <div className="stitle">固定成本（月）</div>
      <div className="g3">
        <div className="fld">
          <label>软件订阅（元）</label>
          <input type="number" value={cSoft}
            onChange={e => set('cSoft', Number(e.target.value))} />
        </div>
        <div className="fld">
          <label>服务器/云计算（元）</label>
          <input type="number" value={cServer}
            onChange={e => set('cServer', Number(e.target.value))} />
        </div>
        <div className="fld">
          <label>其他杂费（元）</label>
          <input type="number" value={cMisc}
            onChange={e => set('cMisc', Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}
