export function calcProjectCost(p, platforms, globalConfig, roles) {
  const plat = platforms.find(x => x.active) || platforms[0] || { rate: 100 };
  const ptsPerEp = globalConfig.aiRate * globalConfig.aiDur * (globalConfig.shotRatio || 1) + globalConfig.aiImgPts * globalConfig.aiImgN;
  const aiCost = plat.rate > 0 ? (ptsPerEp * p.eps) / plat.rate : 0;
  const months = p.days / 30;
  const hrCost = p.staffing && p.staffing.length > 0
    ? p.staffing.reduce((a, s) => { const role = roles.find(r => r.name === s.roleName); return a + (role ? role.salary * s.ratio : 0) * months; }, 0)
    : roles.reduce((a, r) => a + r.count * r.salary * months, 0);
  const fixCost = (globalConfig.cSoft + globalConfig.cServer) * months + globalConfig.cMisc;
  const scriptCost = p.scriptCost || 0;
  const total = aiCost + hrCost + fixCost + scriptCost;
  const rev = (p.revPlat || 0) * p.eps + (p.revBrand || 0) + (p.revLic || 0) + (p.revMerch || 0)
    + (p.revViews || 0) * 10000 / 1000 * (p.revCpm || 0);
  return { aiCost, hrCost, fixCost, scriptCost, total, rev, net: rev - total, months };
}

export function fmt(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 10000) return "¥" + (n / 10000).toFixed(1) + "万";
  return "¥" + n.toLocaleString();
}

export function getBottleneck(projects, roles) {
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
    const supply = r.count;
    const ratio = supply > 0 ? demand / supply : (demand > 0 ? 99 : 0);
    if (ratio > mx) { mx = ratio; if (ratio > 1) bn = r.name; }
  });
  return bn;
}
