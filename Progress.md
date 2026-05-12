# Progress

## 目标
继续开发成本核算器项目，新增第一版积分计划能力与积分批次记录系统，并把积分发放升级为“项目 → 制作组 → 人”的快速流程，补齐成本曲线全局分析，优化注册登录与用户数据同步。

## 范围
本轮新增总积分计划视角：按所有项目全集数汇总积分需求，按项目 staffing ratio 自动拆分到人员/岗位；新增岗位二级人员库、项目具体制作组名单、批次化积分发放/使用记录和人员额度汇总；成本曲线新增全局汇总/单项目分析切换；认证改为登录/注册门禁并按 Supabase 用户同步数据；暂不做月度拆分。

## 当前状态
- 已从当前功能分支切出 `codex/org-permissions`，准备实现组织邀请与权限管理 MVP。
- `打开成本核算器.html` 确认为本地直接打开网站的快捷方式，本轮不纳入功能改动。
- 已确认当前项目目录与仓库根目录一致。
- 已补充项目级 `AGENTS.md` 与 `Progress.md`。
- 技术栈：Vite + React 18 + Zustand + Chart.js + Supabase。
- 当前 Git 分支：`main`，本地 HEAD 与 `origin/main` 同步在 `cae8804`。
- 远端仓库：`https://github.com/zhangtianrun0522-pixel/gleam-cost-calculator.git`。
- 项目内未发现 Claude 专用说明文件；接力信息主要来自提交记录、源码和旧版 `gleam-cost-calculator.html`。
- 旧版单文件 HTML 仍保留，React 版已迁移核心功能：全局配置、项目管理、人员编排、制作组模板库、比例制资源池、成本曲线、人力 vs AI 成本对比图。
- 已修复早期认证组件未读取、保存、加载 `templates` 的问题。
- 已调整 `src/sync.js` 对云端 `templates` 的读取逻辑，区分“旧数据没有该字段”和“用户主动清空模板数组”。
- 已新增 `积分计划` Tab：展示总申请积分、基础积分、预留积分、预计金额、项目积分明细和人员/岗位分配。
- 已在 `积分计划` Tab 新增积分批次记录：支持批次名称、日期、关联项目、备注和多人员录入。
- 已新增人员额度汇总：按人员聚合已发额度、已使用积分、剩余额度、使用率和记录数。
- 已新增积分使用记录明细：支持直接调整单条记录的额度/已用积分，并可删除误录记录。
- 已在 Zustand 本地持久化新增 `pointRecords`，用于保存积分记录；已补充云同步字段 `point_records`。
- 已在 Zustand 本地持久化新增 `people`，用于保存具体人员：姓名、所属岗位、薪资覆盖、状态、积分账号、备注。
- 全局配置的人员资源池保持一级岗位表；新增岗位二级人员管理页，点击岗位“管理”进入，不在一级表塞具体人员。
- 项目人员编排支持按岗位选择具体人员，项目 `staffing` 保存 `peopleIds`，形成项目制作组名单。
- 人力成本计算已支持项目具体人员薪资：若岗位选了具体人员，用所选人员平均薪资乘岗位 ratio；未选人则回退岗位默认薪资。
- 积分计划新增“按项目制作组生成”：选择项目后按岗位 ratio 拆项目积分，再平均拆给该岗位已选人员，生成批次草稿后可手动微调。
- 积分计划选择项目后会自动填充该项目制作组人员，不再要求先点击按钮才生成明细。
- 发放草稿列已调整为：计划额度（系统按项目积分与制作组 ratio 计算）、单次发放额度（本批次手动填写）、已使用（历史同项目同人员发放 + 本次发放累计，超计划标红，未超标标绿）。
- 临时抽调人员可通过“从人员库添加”下拉选择，来源限定为全局配置里的具体人员。
- 项目 staffing 若没有显式 `peopleIds`，现在会默认把该岗位下全部可用人员视为项目制作组成员；积分计划和项目页展示都按这个容错口径读取。
- 已将单集积分、项目总积分、积分格式化抽到 `src/calc.js`，复用现有成本计算口径。
- 已给 `成本曲线` 增加分析范围切换：默认全局汇总，也可切回单项目分析。
- 全局分析汇总所有项目成本、收入、净利润和总集数；成本曲线按总集数视角展示整体单集摊销。
- 已新增 `AuthGate`：未登录时只显示登录/注册页，登录后才进入工作台。
- 登录后先读取当前 Supabase 用户的 `user_data`，再允许自动保存，避免默认本地数据覆盖云端数据。
- 新用户没有云端数据时重置到默认初始状态并自动建立该用户的数据；退出时清空当前 store，避免不同账号共享本地缓存。
- 已补充 `src/sync.js` 对 `people`、`pointRecords`、`productionProgress` 的云端保存/读取；若线上表尚未执行新列迁移，会自动回退到旧字段同步，避免登录卡死。
- 已新增 Supabase 迁移文件 `supabase/migrations/202605080830_add_points_ledger_columns.sql`，用于给 `user_data` 增加 `people`、`point_records`、`production_progress` 三个 JSONB 字段。
- 已将 AI 积分口径升级为项目级可覆盖：全局配置作为默认值，项目可单独设置生成速率、每集成片时长、片比、图像积分/张、每集图像数量；旧项目没有 `aiConfig` 时继续继承全局默认。
- 项目管理页已新增项目级 AI 积分配置面板；成本计算、积分计划、人员额度分配、项目积分明细和成本曲线已统一使用项目级 AI 配置。
- 已将本地预览与进程管理注意事项写入项目 `AGENTS.md`：启动前检查残留进程和端口、固定项目端口、避免根目录多 HTML 入口、按顺序验证预览链路。
- 已将同一套本地预览与进程管理注意事项同步到全局 `/Users/darius/AGENTS.md`，作为后续所有项目的默认开发纪律。
- 已收敛当前项目 Vite 配置：固定 dev 端口 `127.0.0.1:5173`、preview 端口 `127.0.0.1:4173`，并限定 Vite 依赖扫描/构建入口为 `index.html`，避免根目录旧 HTML 被当作入口扫描。
- 已按项目级积分口径调整配置入口：全局配置页移除“分镜积分配置”，项目管理页保留项目级 AI 积分配置，并补回“实际生成素材（成片 × 片比）→ 每集分镜积分”的说明条。
- 已新增组织权限迁移草案：组织、成员、邀请、部门、组织配置、项目、人员、积分记录和制作进度表，并启用 RLS。
- 已新增组织同步模块：登录后解析/创建组织、自动接受邮箱邀请、老 `user_data` 迁移为组织数据、按成员范围加载数据。
- 已新增“组织管理”Tab：Owner/Admin 可维护部门、邀请成员、调整成员角色和访问范围。
- 已在 Header 展示当前组织和角色，并在无全局写权限时禁用全局配置、项目、积分记录的主要编辑入口。

## 下一步
- 继续收敛组织权限 MVP：跑构建、检查 RLS SQL 可执行性，并用 Supabase 真实环境验证老用户迁移、Owner 邀请、受邀邮箱自动加入、成员范围过滤。
- 后续需要将 department_lead 的写入从“整体保存”升级为行级保存，避免 scoped 成员保存时覆盖不可见数据；当前前端先禁用非 Owner/Admin 写入口。
- 后续优化清单：人工检查项目级 AI 积分配置在多项目下的展示和计算口径是否符合预期。
- 使用本地预览服务人工检查：岗位二级人员管理、项目选人、积分计划从项目生成发放草稿、记录编辑删除与成本曲线全局分析展示。
- 人工验证邮箱+密码注册、邮箱验证、密码登录、忘记密码重置，以及同邮箱再次登录后的数据恢复。
- 后续若要做月度计划，需要先给项目补起止日期或月度制作量输入。
- 若构建耗时影响开发体验，再定位 Vite/Node 启动慢的环境原因或做 chunk 拆分。

## 风险
- 项目包含 `.env.local`，避免输出或提交敏感配置。
- 若本地与远端存在差异，需要先确认同步策略，避免覆盖未提交改动。
- 云端 `templates` 字段是否已在 Supabase 表中存在，需要实际登录同步验证；本轮未访问线上数据。
- `npm run build` 成功但耗时 3m37s，且 JS chunk 超过 500KB；短期不阻塞功能开发，后续可考虑懒加载 Chart.js 或手动分包。
- 目前 staffing 只有岗位名和 ratio，没有真实员工姓名；积分分配第一版显示为人员/岗位分配，后续如需到个人，需要新增员工资料模型。
- 安全预留比例目前是页面局部状态，刷新后回到默认 20%；若要作为正式计划参数，需要接入 store 和云同步。
- 积分批次记录已接入前端云同步代码；线上 Supabase 需要执行新增 JSONB 字段迁移后才会跨设备持久同步。
- 人员名称目前是自由文本输入，没有统一员工主数据；同一个人若写成不同名称会被视为不同人员。
- 具体人员库 `people` 与实际制作进度 `productionProgress` 已接入前端云同步代码；线上 Supabase 需要执行新增 JSONB 字段迁移后才会跨设备持久同步。
- 岗位改名会同步更新人员所属岗位，但不会自动更新已存在模板和项目 staffing 中的旧岗位名；后续若需要可加统一重命名动作。
- 项目中忙碌人员仍允许选择，只用浅色状态提示；是否禁止选择忙碌人员需要后续确认。
- 成本曲线全局模式的“总集数变化”是假设 AI 成本随集数变化，人力/固定/脚本按当前项目组合固定投入摊销；这是用于全局规模感分析，不等价于精确排期预测。
- 当前使用 Supabase 邮箱+密码认证；注册邮箱验证、忘记密码邮件和重定向依赖 Supabase Auth 配置。
- 本轮 `npm run build` 两次卡在 Vite 构建阶段，已手动结束残留 npm/vite 进程；模块导入与核心计算验证通过，但完整生产构建需要后续在环境恢复后重跑。
- 当前项目根目录仍存在旧版/临时 HTML 入口（如 `gleam-cost-calculator.html`、未跟踪的 `打开成本核算器.html`），Vite debug 会扫描这些入口；后续建议移入 `legacy/` 或 `archive/`。
- 当前 in-app browser 自动导航仍可能超时，但项目生产构建和 `vite preview` 已可用；若浏览器继续卡住，优先重置浏览器会话或手动打开 `http://127.0.0.1:4173/`。

## 关键决策
- 按工作区规则先建立项目级协作与进度文件，作为后续开发的状态锚点。
- 采用最小修复：认证同步补齐 store 读写和 effect 依赖，`sync.js` 保持兼容旧云端数据。
- 积分计划先做总量，不做月度：当前项目没有明确起止日期，先按项目全集数计算更符合现有数据约束。
- 预留比例默认 20%，作为返工/试错的计划缓冲，不影响现有成本计算。
- 积分记录先使用“批次 + 人员行”的最小模型：一批可录多人，每人包含发放额度和已用额度，便于快速看出个人剩余额度。
- 新增积分记录/人员/制作进度先采用 `user_data` JSONB 扩展列，避免拆分多表；后续组织权限功能再升级为组织级数据模型。
- 一个人只属于一个岗位；制作组模板仍只保存岗位比例，具体项目再选人。
- 人员薪资默认继承岗位薪资，但可在人员二级页单独覆盖。
- 项目选中多人时，人力成本按所选人员平均薪资 × 岗位 ratio 计算，保持 ratio 作为 FTE 占用口径。
- 积分自动发放按“项目总积分 × 岗位 ratio 占比 ÷ 岗位已选人数”生成每个人额度，保存前允许手动修改。
- 单次发放额度允许为空，便于先生成名单再按批次填写；保存时只保存本次发放额度大于 0 的人员。
- “已使用”用于和计划额度对比，当前口径等于同项目同人员所有已保存发放额度，加上本批次正在填写的单次额度。
- 项目人员 chip 现在默认选中岗位下可用人员；手动点掉后才保存显式排除后的 `peopleIds`。
- 积分批次记录顶部胶囊在选中项目后按项目总情况显示：计划额度、已发额度、剩余额度。
- 人员额度汇总在选中项目后按项目计划额度展示，剩余 = 计划额度 - 已使用；超额时保留负数并标红，未超额标绿。
- 人员额度汇总的姓名后显示“已使用 X 积分”。
- 原“积分使用记录”已改为页面底部的“历史发放批次”，按批次折叠/展开，展开后显示该批次给谁发了多少。
- 积分计划页顶部新增积分使用仪表盘：圆环显示当前项目/全部项目的计划积分消耗比例，并展示计划、已发、剩余。
- 顶部新增双层进度条：蓝色按当前积分消耗推算应制作到第几集，绿色显示用户填写的实际制作进度。
- 新增 `productionProgress` 本地持久化，按项目保存实际制作进度集数。
- 顶部仪表盘已从“单个总控卡”改为“每个项目一张卡”：每张卡显示该项目积分圆环、计划/已发/剩余、积分推算进度、实际制作进度输入。
- 点击项目进度卡会联动下方发放草稿、人员额度汇总、历史批次；页面不再需要额外的项目下拉作为主入口。
- 积分计划页项目详情改为点击卡片后才展开；未选择项目时只展示项目进度卡和提示，避免项目多时细节区过长不好找。
- 再次点击当前项目卡可收起详情。
- 全局总览固定到积分计划页最顶部，并简化为“总申请积分”和“预计金额”两个指标。
- 项目卡展开后保留项目级四个指标：项目申请积分、基础积分、预留积分、预计金额。
- 积分发放草稿里的人员下拉改为“添加临时人员”：选择后立即新增临时人员行，不再需要单独按钮。
- 临时人员不参与项目固定计划额度重分配，计划额度显示为“临时人员”；其单次发放仍计入项目总消耗、历史批次和该人员使用统计。
- 临时人员计划额度显示为 `/`；保存批次后不会固定留在当前项目草稿里，草稿会恢复为项目固定人员名单。
- 成本曲线保留单项目分析，同时默认进入全局汇总，符合“先看整体盘子，再下钻项目”的工作流。
- 认证门禁放在应用最外层，Header 只展示已登录用户和同步状态，避免未登录用户进入业务页。
- 云端加载使用 `maybeSingle()`，新用户没有 `user_data` 行时不当作错误。
- 注册使用 `signUp`，登录使用 `signInWithPassword`，忘记密码使用 `resetPasswordForEmail`；密码只由 Supabase Auth 处理，应用不保存、不比较密码。
- 先做项目级 AI 积分配置，而不是组织权限：它直接影响当前积分计划、成本曲线和项目金额，是现有核算口径的阻塞优化；组织权限涉及组织级数据模型和 RLS，适合后续单独分支处理。
- 项目级 AI 配置采用 `project.aiConfig` 小对象，不改 Supabase 表结构：项目本身已在 `projects` JSON 中云同步，可避免本轮引入数据库迁移。
- 旧项目未设置 `aiConfig` 时继承全局默认；新项目复制创建时的全局默认，避免后续全局默认变动意外影响已新建项目测算口径。
- 本地预览问题按开发环境基础设施处理，不视为业务功能设计缺失；优先制度化端口、进程、入口文件和验证顺序。

## 验证结果
- `node -e "import('./src/calc.js').then(m=>console.log(m.fmt(12345)))"` 通过，输出 `¥1.2万`。
- `npm run build` 通过：Vite 6.4.2，91 modules transformed，产物输出到 `dist/`。
- 构建警告：`dist/assets/index-Dvru_4k1.js` 约 591.10 kB，超过 Vite 默认 500 kB chunk 警告阈值。
- 修复后 `npm run build` 通过，耗时 821ms；产物 `dist/assets/index-BIZNmyE6.js` 约 591.22 kB，仍有同类 chunk 大小警告。
- `rg -n "templates|setTemplates|saveToCloud|loadFromCloud" src` 已确认 `templates` 进入保存、加载和 effect 依赖链路。
- 新增积分计划后 `npm run build` 通过：92 modules transformed，耗时 1.85s；产物 `dist/assets/index-DcUtP43l.js` 约 596.70 kB，仍有同类 chunk 大小警告。
- `rg -n "PointsPlanTab|calcEpisodePoints|calcProjectPoints|fmtPoints|points-project|积分计划" src` 已确认新 Tab、计算函数和样式接线完整。
- 新增成本曲线全局分析后 `npm run build` 通过：92 modules transformed，耗时 1.06s；产物 `dist/assets/index-B71KBmBX.js` 约 597.90 kB，仍有同类 chunk 大小警告。
- `vite preview` 当前服务在 `http://localhost:4180/`，已通过 `curl -I` 验证返回 `HTTP/1.1 200 OK`。
- 新增 AuthGate 后 `npm run build` 通过：92 modules transformed，耗时 1.10s；产物 `dist/assets/index-BQQofQ1m.js` 约 599.34 kB，仍有同类 chunk 大小警告。
- `node -e "import('./src/sync.js').then(...)"` 通过，确认 `sync.js` 模块可正常导入。
- AuthGate 改为邮箱+密码体系后 `npm run build` 通过：92 modules transformed，耗时 920ms；产物 `dist/assets/index-BF4Gcml9.js` 约 601.34 kB，仍有同类 chunk 大小警告。
- `rg -n "signInWithOtp|signInWithPassword|signUp|resetPasswordForEmail|updateUser|PASSWORD_RECOVERY|shouldCreateUser|发送登录链接|邮箱链接" src Progress.md` 已确认旧 Magic Link 登录 API 不再使用，密码认证 API 接线完整。
- 线上生产站 `https://gleam-cost-calculator.vercel.app/` 出现停留在“正在检查登录状态...”的问题；已给 AuthGate 增加登录检查超时、Supabase 回调异步解耦、云端数据读取超时和同步失败页，避免认证/数据请求卡住时无限等待。
- 本次 hotfix 后 `npm run build` 通过：92 modules transformed，耗时 880ms；产物 `dist/assets/index-BWlITj3l.js` 约 601.95 kB，仍有同类 chunk 大小警告。
- 新增积分记录系统后 `npm run build` 通过：92 modules transformed，耗时 1.10s；产物 `dist/assets/index-CWGsmg_9.js` 约 609.02 kB，仍有同类 chunk 大小警告。
- 新增具体人员与项目制作组发放流程后 `npm run build` 通过：92 modules transformed，耗时 1.77s；产物 `dist/assets/index-UT-OkzT3.js` 约 615.25 kB，仍有同类 chunk 大小警告。
- 调整积分发放草稿字段后 `npm run build` 通过：92 modules transformed，耗时 1.06s；产物 `dist/assets/index-sH-XweMB.js` 约 616.54 kB，仍有同类 chunk 大小警告。
- 修复项目制作组人员读取口径后 `npm run build` 通过：92 modules transformed，耗时 1.10s；产物 `dist/assets/index-CSc4b-SM.js` 约 616.98 kB，仍有同类 chunk 大小警告。
- 调整项目维度额度汇总与历史批次后 `npm run build` 通过：92 modules transformed，耗时 1.07s；产物 `dist/assets/index-CGHOGs--.js` 约 618.89 kB，仍有同类 chunk 大小警告。
- 新增积分圆环与制作进度对照后 `npm run build` 通过：92 modules transformed，耗时 1.09s；产物 `dist/assets/index-DZKcyKoV.js` 约 621.33 kB，仍有同类 chunk 大小警告。
- 项目进度卡片化后 `npm run build` 通过：92 modules transformed，耗时 1.10s；产物 `dist/assets/index-Cz2o-J5I.js` 约 622.10 kB，仍有同类 chunk 大小警告。
- 项目卡点击展开详情后 `npm run build` 通过：92 modules transformed，耗时 962ms；产物 `dist/assets/index-BZcOkIKq.js` 约 622.35 kB，仍有同类 chunk 大小警告。
- 调整顶部全局总览和项目级指标后 `npm run build` 通过：92 modules transformed，耗时 1.09s；产物 `dist/assets/index-B-73ei5U.js` 约 622.89 kB，仍有同类 chunk 大小警告。
- 调整临时人员发放逻辑后 `npm run build` 通过：92 modules transformed，耗时 1.12s；产物 `dist/assets/index-CRv9jGgm.js` 约 622.61 kB，仍有同类 chunk 大小警告。
- 调整临时人员显示与保存后刷新草稿后 `npm run build` 通过：92 modules transformed，耗时 1.07s；产物 `dist/assets/index-Dy080neC.js` 约 622.65 kB，仍有同类 chunk 大小警告。
- Supabase 新字段检查返回 `column user_data.people does not exist`，已新增迁移 SQL 并给前端同步增加缺列回退。
- 项目级 AI 积分配置后，`node -e "import('./src/calc.js').then(...calcProjectPoints...)"` 通过，项目覆盖示例输出 `2,600积分`。
- 本轮 `npm run build` 第一次无输出挂起，第二次停在 `transforming...` 超过 60 秒；已结束对应进程。完整 build 未完成，剩余风险是未获得 Vite 生产构建结果。
- 修复预览配置后，`./node_modules/.bin/vite build --debug` 通过：92 modules transformed，产物 `dist/assets/index-Chj4W1SX.js` 约 626.59 kB，仍有 chunk 大小警告。
- 当前 `npm run preview` 服务运行在 `http://127.0.0.1:4173/`，`curl -I --max-time 5 http://127.0.0.1:4173/` 返回 `HTTP/1.1 200 OK`。
- 移除全局分镜积分配置 UI 并补回项目说明条后，`npm run build` 通过：92 modules transformed，耗时 1.03s；产物 `dist/assets/index-DLoPTHmL.js` 约 625.31 kB，仍有 chunk 大小警告。
- 调整项目分镜积分说明条字体后，`npm run build` 通过：92 modules transformed，耗时 1.20s；产物 `dist/assets/index-B3y4qQsZ.js` 约 625.31 kB，仍有 chunk 大小警告。
- 组织邀请与权限管理 MVP 前端构建通过：`npm run build`，93 modules transformed，耗时 909ms；产物 `dist/assets/index-DC55gY-S.js` 约 643.10 kB，仍有 chunk 大小警告。
- `node -e "import('./src/sync.js').then(...)"` 通过，确认组织同步相关导出可正常导入。
- AuthGate 加载顺序修正后再次 `npm run build` 通过：93 modules transformed，耗时 1.10s；产物 `dist/assets/index-BfjWHOjR.js` 约 643.11 kB，仍有 chunk 大小警告。
- 本地预览验证：`lsof -nP -iTCP -sTCP:LISTEN` 未发现 4173/5173 占用；`npm run preview` 启动在 `http://127.0.0.1:4173/`，`curl -I --max-time 5 http://127.0.0.1:4173/` 返回 `HTTP/1.1 200 OK`。`ps` 检查因系统权限返回 `operation not permitted`。
- 修复“网页打不开”：确认本地 preview 被停止导致 4173 无监听，已重新启动 `npm run preview` 到 `http://127.0.0.1:4173/`；同时为未执行组织权限迁移的 Supabase 环境增加旧 `user_data` 兼容回退，避免新表不存在时登录同步失败。
- 兼容回退后 `npm run build` 通过：93 modules transformed，耗时 951ms；产物 `dist/assets/index-CTBu8enA.js` 约 644.76 kB，仍有 chunk 大小警告；`curl -I --max-time 5 http://127.0.0.1:4173/` 返回 `HTTP/1.1 200 OK`。
- 修复组织权限不可见：`resetStore()` 会清空 `orgContext`，导致 Owner/Admin 被误判为无权限；已调整为 reset 后重新写入组织上下文。`npm run build` 通过：93 modules transformed，耗时 935ms；`curl -I --max-time 5 http://127.0.0.1:4173/` 返回 `HTTP/1.1 200 OK`。
- 组织成员细节补齐：成员栏显示用户名/邮箱、绑定人员、部门和角色；人员库新增“对应成员”下拉用于把具体人员绑定到组织成员；组织管理顶部支持当前用户修改自己的用户名。
- 成员细节补齐后 `npm run build` 通过：93 modules transformed，耗时 904ms；产物 `dist/assets/index-nCoLx1Io.js` 约 646.70 kB，仍有 chunk 大小警告；`curl -I --max-time 5 http://127.0.0.1:4173/` 返回 `HTTP/1.1 200 OK`。
- 根据产品口径调整成员栏：组织成员是注册管理账号维度，不再联动制作人员库；已移除人员库“对应成员”下拉，成员栏改为展示注册成员、部门和角色。`npm run build` 通过：93 modules transformed，耗时 942ms；`curl -I --max-time 5 http://127.0.0.1:4173/` 返回 `HTTP/1.1 200 OK`。
- 修复新增部门交互：空输入时默认创建“新部门 N”，按钮点击后立即乐观显示部门并给出状态提示；兼容模式下本地新增，Supabase 写入失败时回滚并显示错误。`npm run build` 通过：93 modules transformed，耗时 1.39s。
- 已完成上线同步：提交 `760e750 Add organization permissions MVP` 已推送到 `origin/codex/org-permissions`；Vercel 生产站 `https://gleam-cost-calculator.vercel.app/` 已部署并返回 `HTTP/2 200`。
- Supabase 远端已执行组织权限迁移 SQL；迁移前通过 Management API 备份 `public.user_data` 到 `/private/tmp/gleam-supabase-backups/user_data-before-org-permissions-20260512-management.json`，备份包含 2 行。
- Supabase 迁移后验证：`public.organizations`、`public.organization_members`、`public.organization_projects` 已存在；旧 `public.user_data` 行数仍为 2，未被删除或清零。
