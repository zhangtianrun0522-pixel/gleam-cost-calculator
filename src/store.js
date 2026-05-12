import { create } from "zustand";
import { persist } from "zustand/middleware";

const defaultPlatforms = [
  { name: "即梦 AI", rate: 100, active: true },
  { name: "可灵 AI", rate: 66, active: false },
  { name: "Midjourney", rate: 50, active: false },
  { name: "Runway", rate: 40, active: false },
];

const defaultRoles = [
  { name: "编剧", count: 1, salary: 12000, hrsPerEp: 4, dayHrs: 8 },
  { name: "导演", count: 1, salary: 15000, hrsPerEp: 3, dayHrs: 8 },
  { name: "美术/提示词", count: 1, salary: 10000, hrsPerEp: 2, dayHrs: 8 },
  { name: "后期剪辑", count: 1, salary: 10000, hrsPerEp: 2, dayHrs: 8 },
  { name: "制片统筹", count: 1, salary: 12000, hrsPerEp: 1, dayHrs: 8 },
];

const defaultProjects = [
  {
    name: "Fractured Recall S1", eps: 20, days: 30, scriptCost: 0,
    revPlat: 800, revBrand: 50000, revLic: 30000, revMerch: 10000, revViews: 500, revCpm: 8,
    staffing: [],
  },
];

const defaultTemplates = [
  {name:"标准BL轻量组", roles:[{roleName:"编剧",ratio:0.5},{roleName:"导演",ratio:1.0},{roleName:"美术/提示词",ratio:1.5},{roleName:"后期剪辑",ratio:1.0}]},
  {name:"快速登场组", roles:[{roleName:"编剧",ratio:0.2},{roleName:"导演",ratio:0.8},{roleName:"美术/提示词",ratio:0.5},{roleName:"后期剪辑",ratio:0.8}]}
];

const defaultGlobalConfig = { aiRate: 5, aiDur: 120, shotRatio: 3.0, aiImgPts: 10, aiImgN: 80, cSoft: 2000, cServer: 1500, cMisc: 3000 };

const defaultState = {
  platforms: defaultPlatforms,
  roles: defaultRoles,
  globalConfig: defaultGlobalConfig,
  projects: defaultProjects,
  templates: defaultTemplates,
  people: [],
  pointRecords: [],
  productionProgress: {},
  orgContext: null,
  departments: [],
  organizationMembers: [],
  organizationInvites: [],
};

function migrateFromOldKeys() {
  const SK = { plat: "gleam_v3_plat", roles: "gleam_v3_roles", global: "gleam_v3_global", proj: "gleam_v3_proj", templates: "gleam_v3_templates" };
  const result = {};
  try {
    const plat = localStorage.getItem(SK.plat);
    if (plat) result.platforms = JSON.parse(plat);
    const roles = localStorage.getItem(SK.roles);
    if (roles) result.roles = JSON.parse(roles);
    const global = localStorage.getItem(SK.global);
    if (global) result.globalConfig = JSON.parse(global);
    const proj = localStorage.getItem(SK.proj);
    if (proj) result.projects = JSON.parse(proj);
    const templates = localStorage.getItem(SK.templates);
    if (templates) result.templates = JSON.parse(templates);
  } catch (e) { /* ignore */ }
  return result;
}

const migrated = migrateFromOldKeys();

const useStore = create(
  persist(
    (set) => ({
      platforms: migrated.platforms || defaultState.platforms,
      roles: migrated.roles || defaultState.roles,
      globalConfig: migrated.globalConfig || defaultState.globalConfig,
      projects: migrated.projects || defaultState.projects,
      templates: migrated.templates || defaultState.templates,
      people: defaultState.people,
      pointRecords: defaultState.pointRecords,
      productionProgress: defaultState.productionProgress,
      orgContext: defaultState.orgContext,
      departments: defaultState.departments,
      organizationMembers: defaultState.organizationMembers,
      organizationInvites: defaultState.organizationInvites,

      setPlatforms: (platforms) => set({ platforms }),
      setRoles: (roles) => set({ roles }),
      setGlobalConfig: (globalConfig) => set({ globalConfig }),
      setProjects: (projects) => set({ projects }),
      setTemplates: (templates) => set({ templates }),
      setPeople: (people) => set({ people }),
      setPointRecords: (pointRecords) => set({ pointRecords }),
      setProductionProgress: (productionProgress) => set({ productionProgress }),
      setOrgContext: (orgContext) => set({ orgContext }),
      setDepartments: (departments) => set({ departments }),
      setOrganizationMembers: (organizationMembers) => set({ organizationMembers }),
      setOrganizationInvites: (organizationInvites) => set({ organizationInvites }),
      resetStore: () => set(defaultState),

      updateProject: (index, patch) =>
        set((state) => ({ projects: state.projects.map((p, i) => i === index ? { ...p, ...patch } : p) })),
      deleteProject: (index) =>
        set((state) => ({ projects: state.projects.filter((_, i) => i !== index) })),
      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),

      addPlatform: (platform) =>
        set((state) => ({ platforms: [...state.platforms, platform] })),
      deletePlatform: (index) =>
        set((state) => ({ platforms: state.platforms.filter((_, i) => i !== index) })),
      updatePlatform: (index, patch) =>
        set((state) => ({ platforms: state.platforms.map((p, i) => i === index ? { ...p, ...patch } : p) })),
      setActivePlatform: (index) =>
        set((state) => ({ platforms: state.platforms.map((p, i) => ({ ...p, active: i === index })) })),

      addRole: (role) =>
        set((state) => ({ roles: [...state.roles, role] })),
      deleteRole: (index) =>
        set((state) => ({ roles: state.roles.filter((_, i) => i !== index) })),
      updateRole: (index, patch) =>
        set((state) => ({ roles: state.roles.map((r, i) => i === index ? { ...r, ...patch } : r) })),

      addPerson: (person) =>
        set((state) => ({ people: [...state.people, { ...person, id: person.id || `${Date.now()}-${Math.random().toString(16).slice(2)}` }] })),
      deletePerson: (id) =>
        set((state) => ({
          people: state.people.filter((p) => p.id !== id),
          projects: state.projects.map((project) => ({
            ...project,
            staffing: (project.staffing || []).map((row) => ({
              ...row,
              peopleIds: (row.peopleIds || []).filter((personId) => personId !== id),
            })),
          })),
        })),
      updatePerson: (id, patch) =>
        set((state) => ({ people: state.people.map((p) => p.id === id ? { ...p, ...patch } : p) })),

      addTemplate: (template) =>
        set((state) => ({ templates: [...state.templates, template] })),
      deleteTemplate: (index) =>
        set((state) => ({ templates: state.templates.filter((_, i) => i !== index) })),
      updateTemplate: (index, patch) =>
        set((state) => ({ templates: state.templates.map((t, i) => i === index ? { ...t, ...patch } : t) })),

      addPointRecords: (records) =>
        set((state) => ({ pointRecords: [...records, ...state.pointRecords] })),
      deletePointRecord: (id) =>
        set((state) => ({ pointRecords: state.pointRecords.filter((r) => r.id !== id) })),
      updatePointRecord: (id, patch) =>
        set((state) => ({ pointRecords: state.pointRecords.map((r) => r.id === id ? { ...r, ...patch } : r) })),
      updateProductionProgress: (projectName, patch) =>
        set((state) => ({
          productionProgress: {
            ...state.productionProgress,
            [projectName]: {
              ...(state.productionProgress[projectName] || {}),
              ...patch,
            },
          },
        })),
    }),
    {
      name: "gleam_v4_store",
      partialize: (state) => ({
        platforms: state.platforms,
        roles: state.roles,
        globalConfig: state.globalConfig,
        projects: state.projects,
        templates: state.templates,
        people: state.people,
        pointRecords: state.pointRecords,
        productionProgress: state.productionProgress,
      }),
    }
  )
);

export default useStore;
