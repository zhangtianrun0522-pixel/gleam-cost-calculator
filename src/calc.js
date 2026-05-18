export function getSelectedPeopleForStaffing(staffing, people) {
  const rolePeople = people.filter(person => person.roleName === staffing.roleName && (person.status || 'active') !== 'inactive');
  const ids = staffing.peopleIds || [];
  if (ids.length === 0) return rolePeople;
  return ids.map(id => people.find(person => person.id === id)).filter(Boolean);
}

export function getActiveRolePeople(people = [], roleName) {
  return people.filter(person => person.roleName === roleName && (person.status || 'active') === 'active');
}

export function getEffectiveRoleCount(role, people = []) {
  const activeCount = getActiveRolePeople(people, role?.name).length;
  return activeCount > 0 ? activeCount : Number(role?.count) || 0;
}

function getPersonSalary(person, role) {
  return Number(person.salary) > 0 ? Number(person.salary) : (Number(role?.salary) || 0);
}

export function getRoleMonthlyCost(role, people = []) {
  const rolePeople = people.filter(person => person.roleName === role?.name && (person.status || 'active') !== 'inactive');
  if (rolePeople.length > 0) {
    return rolePeople.reduce((sum, person) => sum + getPersonSalary(person, role), 0);
  }
  return getEffectiveRoleCount(role, people) * (Number(role?.salary) || 0);
}

export function getStaffingMonthlyCost(staffing, role, people = []) {
  const selectedPeople = getSelectedPeopleForStaffing(staffing, people);
  if (selectedPeople.length > 0) {
    return selectedPeople.reduce((sum, person) => sum + getPersonSalary(person, role), 0);
  }
  return getRoleMonthlyCost(role, []);
}

const aiPointKeys = ['aiRate', 'aiDur', 'shotRatio', 'aiImgPts', 'aiImgN'];

export function getProjectAiConfig(project, globalConfig) {
  const overrides = project?.aiConfig || {};
  return aiPointKeys.reduce((config, key) => {
    const value = overrides[key];
    if (value === '' || value === null || value === undefined) return config;
    return { ...config, [key]: Number(value) };
  }, { ...globalConfig });
}

export function hasProjectAiOverrides(project) {
  const overrides = project?.aiConfig || {};
  return aiPointKeys.some(key => overrides[key] !== '' && overrides[key] !== null && overrides[key] !== undefined);
}

export function calcProjectCost(p, platforms, globalConfig, roles, people = []) {
  const plat = platforms.find(x => x.active) || platforms[0] || { rate: 100 };
  const projectAiConfig = getProjectAiConfig(p, globalConfig);
  const ptsPerEp = calcEpisodePoints(projectAiConfig).totalPoints;
  const aiCost = plat.rate > 0 ? (ptsPerEp * p.eps) / plat.rate : 0;
  const months = p.days / 30;
  const hrCost = p.staffing && p.staffing.length > 0
    ? p.staffing.reduce((a, s) => {
      const role = roles.find(r => r.name === s.roleName);
      return a + getStaffingMonthlyCost(s, role, people) * months;
    }, 0)
    : roles.reduce((a, r) => a + getRoleMonthlyCost(r, people) * months, 0);
  const fixCost = (globalConfig.cSoft + globalConfig.cServer) * months + globalConfig.cMisc;
  const scriptCost = p.scriptCost || 0;
  const total = aiCost + hrCost + fixCost + scriptCost;
  const rev = (p.revPlat || 0) * p.eps + (p.revBrand || 0) + (p.revLic || 0) + (p.revMerch || 0)
    + (p.revViews || 0) * 10000 / 1000 * (p.revCpm || 0);
  return { aiCost, hrCost, fixCost, scriptCost, total, rev, net: rev - total, months };
}

export function calcEpisodePoints(globalConfig) {
  const videoPoints = (globalConfig.aiRate || 0) * (globalConfig.aiDur || 0) * (globalConfig.shotRatio || 1);
  const imagePoints = (globalConfig.aiImgPts || 0) * (globalConfig.aiImgN || 0);
  return { videoPoints, imagePoints, totalPoints: videoPoints + imagePoints };
}

export function calcProjectPoints(p, globalConfig, reserveRate = 0) {
  const projectAiConfig = getProjectAiConfig(p, globalConfig);
  const ep = calcEpisodePoints(projectAiConfig);
  const eps = Math.max(Number(p.eps) || 0, 0);
  const videoPoints = ep.videoPoints * eps;
  const imagePoints = ep.imagePoints * eps;
  const basePoints = videoPoints + imagePoints;
  const reservePoints = basePoints * Math.max(Number(reserveRate) || 0, 0);
  const totalPoints = basePoints + reservePoints;
  return { eps, videoPoints, imagePoints, basePoints, reservePoints, totalPoints };
}

export function fmtPoints(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + "万积分";
  return n.toLocaleString() + "积分";
}

export function fmt(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 10000) return "¥" + (n / 10000).toFixed(1) + "万";
  return "¥" + n.toLocaleString();
}

export function getBottleneck(projects, roles, people = []) {
  if (!projects.length) return null;
  let bn = null, mx = 0;
  roles.forEach(r => {
    const demand = projects.reduce((a, p) => {
      if (p.staffing && p.staffing.length > 0) {
        const s = p.staffing.find(st => st.roleName === r.name);
        return a + (s ? s.ratio : 0);
      }
      return a;
    }, 0);
    const supply = getEffectiveRoleCount(r, people);
    const ratio = supply > 0 ? demand / supply : (demand > 0 ? 99 : 0);
    if (ratio > mx) { mx = ratio; if (ratio > 1) bn = r.name; }
  });
  return bn;
}
