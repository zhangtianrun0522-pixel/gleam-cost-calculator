import { useEffect, useMemo, useState } from "react";
import useStore from "../../store";
import { getWriteAccess } from "../../sync";
import { getActiveRolePeople, getEffectiveRoleCount } from "../../calc";

function PersonRow({ person, selectedRole, canWrite, updatePerson, deletePerson }) {
  const [draft, setDraft] = useState({
    name: person.name || "",
    salary: person.salary ?? "",
    status: person.status || "active",
    pointsAccount: person.pointsAccount || "",
    note: person.note || "",
  });

  useEffect(() => {
    setDraft({
      name: person.name || "",
      salary: person.salary ?? "",
      status: person.status || "active",
      pointsAccount: person.pointsAccount || "",
      note: person.note || "",
    });
  }, [person.id, person.name, person.salary, person.status, person.pointsAccount, person.note]);

  const commitDraft = () => {
    if (!canWrite) return;
    const patch = {
      name: draft.name,
      salary: draft.salary === "" ? "" : Number(draft.salary),
      status: draft.status,
      pointsAccount: draft.pointsAccount,
      note: draft.note,
    };
    const current = {
      name: person.name || "",
      salary: person.salary ?? "",
      status: person.status || "active",
      pointsAccount: person.pointsAccount || "",
      note: person.note || "",
    };
    if (
      patch.name === current.name
      && patch.salary === current.salary
      && patch.status === current.status
      && patch.pointsAccount === current.pointsAccount
      && patch.note === current.note
    ) return;
    updatePerson(person.id, patch);
  };

  const commitOnEnter = (event) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <div className="person-row">
      <input
        className="si"
        value={draft.name}
        disabled={!canWrite}
        onChange={e => setDraft({ ...draft, name: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <input
        className="si"
        type="number"
        disabled={!canWrite}
        placeholder={String(selectedRole.salary || 0)}
        value={draft.salary}
        onChange={e => setDraft({ ...draft, salary: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <select
        className="si"
        value={draft.status}
        disabled={!canWrite}
        onChange={e => {
          const status = e.target.value;
          setDraft({ ...draft, status });
          updatePerson(person.id, { status });
        }}
      >
        <option value="active">可用</option>
        <option value="busy">忙碌</option>
        <option value="inactive">停用</option>
      </select>
      <input
        className="si"
        value={draft.pointsAccount}
        disabled={!canWrite}
        placeholder="平台账号"
        onChange={e => setDraft({ ...draft, pointsAccount: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <input
        className="si"
        value={draft.note}
        disabled={!canWrite}
        placeholder="备注"
        onChange={e => setDraft({ ...draft, note: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <button className="delbtn" disabled={!canWrite} onClick={() => { if (confirm("删除人员「" + (draft.name || person.name) + "」？")) deletePerson(person.id); }}>×</button>
    </div>
  );
}

function RoleRow({ role, index, people, canWrite, updateRole, deleteRole, setPeople, onManage }) {
  const rolePeople = useMemo(
    () => people.filter(person => person.roleName === role.name),
    [people, role.name]
  );
  const activeCount = getActiveRolePeople(people, role.name).length;
  const effectiveCount = getEffectiveRoleCount(role, people);
  const isLinkedCount = activeCount > 0;
  const [draft, setDraft] = useState({
    name: role.name || "",
    count: String(effectiveCount ?? 0),
    salary: role.salary ?? "",
    dayHrs: role.dayHrs ?? "",
  });

  useEffect(() => {
    setDraft({
      name: role.name || "",
      count: String(effectiveCount ?? 0),
      salary: role.salary ?? "",
      dayHrs: role.dayHrs ?? "",
    });
  }, [role.name, role.count, role.salary, role.dayHrs, effectiveCount]);

  const commitDraft = () => {
    if (!canWrite) return;
    const nextName = draft.name.trim() || role.name || "未命名岗位";
    const patch = {
      name: nextName,
      salary: Number(draft.salary) || 0,
      dayHrs: Number(draft.dayHrs) || 0,
    };
    if (!isLinkedCount) patch.count = Math.max(Number(draft.count) || 0, 0);

    const nameChanged = nextName !== role.name;
    const roleChanged = (
      patch.name !== role.name
      || patch.salary !== role.salary
      || patch.dayHrs !== role.dayHrs
      || (!isLinkedCount && patch.count !== role.count)
    );
    if (!nameChanged && !roleChanged) return;
    if (nameChanged) {
      setPeople(people.map(person => person.roleName === role.name ? { ...person, roleName: nextName } : person));
    }
    updateRole(index, patch);
  };

  const commitOnEnter = (event) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <div className="res-row role-row-grid">
      <input
        className="si"
        value={draft.name}
        disabled={!canWrite}
        onChange={e => setDraft({ ...draft, name: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <input
        className="si"
        type="number"
        value={isLinkedCount ? effectiveCount : draft.count}
        disabled={!canWrite || isLinkedCount}
        min="0"
        style={{ textAlign: "center" }}
        title={isLinkedCount ? "已按具体人员自动统计" : "未维护具体人员时使用手动计划人数"}
        onChange={e => setDraft({ ...draft, count: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <input
        className="si"
        type="number"
        value={draft.salary}
        disabled={!canWrite}
        onChange={e => setDraft({ ...draft, salary: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <input
        className="si"
        type="number"
        value={draft.dayHrs}
        disabled={!canWrite}
        style={{ textAlign: "center" }}
        onChange={e => setDraft({ ...draft, dayHrs: e.target.value })}
        onBlur={commitDraft}
        onKeyDown={commitOnEnter}
      />
      <div style={{ textAlign: "center", fontSize: 12, color: "#888" }}>
        {activeCount}/{rolePeople.length}
      </div>
      <button className="addbtn" onClick={() => onManage(role.name)}>管理</button>
      <button className="delbtn" disabled={!canWrite} onClick={() => {
        if (!confirm("删除岗位「" + role.name + "」？该岗位下人员会从人员库移除。")) return;
        setPeople(people.filter(person => person.roleName !== role.name));
        deleteRole(index);
      }}>×</button>
    </div>
  );
}

export default function RoleTable() {
  const roles = useStore(s => s.roles);
  const people = useStore(s => s.people);
  const updateRole = useStore(s => s.updateRole);
  const deleteRole = useStore(s => s.deleteRole);
  const addRole = useStore(s => s.addRole);
  const setPeople = useStore(s => s.setPeople);
  const addPerson = useStore(s => s.addPerson);
  const updatePerson = useStore(s => s.updatePerson);
  const deletePerson = useStore(s => s.deletePerson);
  const orgContext = useStore(s => s.orgContext);
  const canWrite = getWriteAccess(orgContext?.member).canWriteGlobal;

  const [selectedRoleName, setSelectedRoleName] = useState(null);
  const selectedRole = selectedRoleName === null ? null : roles.find(r => r.name === selectedRoleName);
  const selectedPeople = useMemo(
    () => people.filter(p => p.roleName === selectedRoleName),
    [people, selectedRoleName]
  );

  useEffect(() => {
    if (selectedRoleName !== null && !selectedRole) setSelectedRoleName(null);
  }, [selectedRoleName, selectedRole]);

  const handleAddPerson = () => {
    if (!selectedRole || !canWrite) return;
    addPerson({
      name: "新人员",
      roleName: selectedRole.name,
      salary: "",
      status: "active",
      pointsAccount: "",
      note: "",
    });
  };

  if (selectedRole) {
    return (
      <div className="card">
        <div className="role-detail-head">
          <div>
            <button className="linkbtn" type="button" onClick={() => setSelectedRoleName(null)}>← 返回岗位资源池</button>
            <div className="stitle" style={{ marginTop: 10, marginBottom: 4 }}>{selectedRole.name} · 人员管理</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              默认薪资 {Number(selectedRole.salary || 0).toLocaleString()} 元；人员薪资为空时继承岗位默认值
            </div>
          </div>
          <button className="addbtn" onClick={handleAddPerson} disabled={!canWrite}>+ 新增人员</button>
        </div>

        <div className="person-row person-hdr">
          <span>姓名</span>
          <span>月薪覆盖</span>
          <span>状态</span>
          <span>积分账号</span>
          <span>备注</span>
          <span></span>
        </div>

        {selectedPeople.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, padding: "14px 0", textAlign: "center" }}>
            当前岗位暂无具体人员
          </div>
        )}

        {selectedPeople.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            selectedRole={selectedRole}
            canWrite={canWrite}
            updatePerson={updatePerson}
            deletePerson={deletePerson}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="stitle" style={{ margin: 0 }}>人员资源池（公司标准工时）</div>
        <button className="addbtn"
          disabled={!canWrite}
          onClick={() => addRole({ name: "新岗位", count: 1, salary: 8000, dayHrs: 8 })}>
          + 新增岗位
        </button>
      </div>
      <div className="res-hdr role-row-grid">
        <span style={{ fontSize: 10, color: "#aaa" }}>岗位名称</span>
        <span style={{ fontSize: 10, color: "#aaa", textAlign: "center" }}>计划人数</span>
        <span style={{ fontSize: 10, color: "#aaa", textAlign: "center" }}>月薪（元）</span>
        <span style={{ fontSize: 10, color: "#aaa", textAlign: "center" }}>日工时(h)</span>
        <span style={{ fontSize: 10, color: "#aaa", textAlign: "center" }}>具体人员</span>
        <span></span>
        <span></span>
      </div>
      {roles.map((r, i) => (
        <RoleRow
          key={`${r.name}-${i}`}
          role={r}
          index={i}
          people={people}
          canWrite={canWrite}
          updateRole={updateRole}
          deleteRole={deleteRole}
          setPeople={setPeople}
          onManage={setSelectedRoleName}
        />
      ))}
      <div style={{ marginTop: 8, fontSize: 11, color: "#bbb" }}>
        一级只维护岗位口径，具体人员在二级页维护；制作组模板仍按岗位比例搭建
      </div>
    </div>
  );
}
