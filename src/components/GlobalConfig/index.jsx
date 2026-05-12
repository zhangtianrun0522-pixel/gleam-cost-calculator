import PlatformTable from "./PlatformTable";
import AIPointsConfig from "./AIPointsConfig";
import RoleTable from "./RoleTable";
import TemplateLibrary from "./TemplateLibrary";
import useStore from "../../store";
import { getWriteAccess } from "../../sync";

export default function GlobalConfig({ onNext }) {
  const orgContext = useStore(s => s.orgContext);
  const access = getWriteAccess(orgContext?.member);
  return (
    <div>
      {!access.canWriteGlobal && <div className="readonly-note">当前账号没有全局配置写权限，此页仅用于查看。</div>}
      <PlatformTable />
      <AIPointsConfig />
      <RoleTable />
      <TemplateLibrary />
      <button className="cbtn" onClick={onNext} disabled={!access.canWriteGlobal}>保存配置，管理项目 →</button>
    </div>
  );
}
