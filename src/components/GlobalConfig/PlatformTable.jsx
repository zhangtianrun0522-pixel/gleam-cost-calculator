import { useState } from 'react';
import useStore from '../../store';
import { getWriteAccess } from '../../sync';

export default function PlatformTable() {
  const platforms = useStore(s => s.platforms);
  const updatePlatform = useStore(s => s.updatePlatform);
  const deletePlatform = useStore(s => s.deletePlatform);
  const setActivePlatform = useStore(s => s.setActivePlatform);
  const addPlatform = useStore(s => s.addPlatform);
  const orgContext = useStore(s => s.orgContext);
  const canWrite = getWriteAccess(orgContext?.member).canWriteGlobal;

  const [hint, setHint] = useState('已自动保存');

  const showHint = () => {
    setHint('已保存 ✓');
    setTimeout(() => setHint('已自动保存'), 2000);
  };

  const handleAdd = () => {
    if (!canWrite) return;
    addPlatform({ name: '新平台', rate: 50, active: false });
    showHint();
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="stitle" style={{ margin: 0 }}>AI 积分平台</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="addbtn" onClick={handleAdd} disabled={!canWrite}>+ 新增平台</button>
          <span className="save-hint">{hint}</span>
        </div>
      </div>
      <div className="plat-hdr">
        <span style={{ fontSize: 10, color: '#aaa' }}>平台名称</span>
        <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>1元兑积分数</span>
        <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>启用</span>
        <span></span>
      </div>
      {platforms.map((p, i) => (
        <div className="plat-row" key={i}>
          <input className="si" value={p.name} disabled={!canWrite}
            onChange={e => { updatePlatform(i, { name: e.target.value }); showHint(); }} />
          <input className="si" type="number" value={p.rate} disabled={!canWrite} style={{ textAlign: 'center' }}
            onChange={e => { updatePlatform(i, { rate: Number(e.target.value) }); showHint(); }} />
          <div style={{ textAlign: 'center' }}>
            <input type="radio" name="platact" checked={!!p.active} disabled={!canWrite}
              onChange={() => { setActivePlatform(i); showHint(); }} />
          </div>
          <button className="delbtn" onClick={() => {
            if (!canWrite) return;
            deletePlatform(i);
            showHint();
          }} disabled={!canWrite}>×</button>
        </div>
      ))}
    </div>
  );
}
