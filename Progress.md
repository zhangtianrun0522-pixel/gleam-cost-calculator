# Progress

## 目标
继续开发成本核算器项目，新增第一版积分计划能力，补齐成本曲线全局分析，优化注册登录与用户数据同步。

## 范围
本轮新增总积分计划视角：按所有项目全集数汇总积分需求，按项目 staffing ratio 自动拆分到人员/岗位；成本曲线新增全局汇总/单项目分析切换；认证改为登录/注册门禁并按 Supabase 用户同步数据；暂不做月度拆分、不新增数据库结构。

## 当前状态
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
- 已将单集积分、项目总积分、积分格式化抽到 `src/calc.js`，复用现有成本计算口径。
- 已给 `成本曲线` 增加分析范围切换：默认全局汇总，也可切回单项目分析。
- 全局分析汇总所有项目成本、收入、净利润和总集数；成本曲线按总集数视角展示整体单集摊销。
- 已新增 `AuthGate`：未登录时只显示登录/注册页，登录后才进入工作台。
- 登录后先读取当前 Supabase 用户的 `user_data`，再允许自动保存，避免默认本地数据覆盖云端数据。
- 新用户没有云端数据时重置到默认初始状态并自动建立该用户的数据；退出时清空当前 store，避免不同账号共享本地缓存。

## 下一步
- 使用 `vite preview` 服务构建产物，人工检查 `积分计划` 与 `成本曲线` 全局分析展示。
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
- 成本曲线全局模式的“总集数变化”是假设 AI 成本随集数变化，人力/固定/脚本按当前项目组合固定投入摊销；这是用于全局规模感分析，不等价于精确排期预测。
- 当前使用 Supabase 邮箱+密码认证；注册邮箱验证、忘记密码邮件和重定向依赖 Supabase Auth 配置。

## 关键决策
- 按工作区规则先建立项目级协作与进度文件，作为后续开发的状态锚点。
- 采用最小修复：认证同步补齐 store 读写和 effect 依赖，`sync.js` 保持兼容旧云端数据。
- 积分计划先做总量，不做月度：当前项目没有明确起止日期，先按项目全集数计算更符合现有数据约束。
- 预留比例默认 20%，作为返工/试错的计划缓冲，不影响现有成本计算。
- 成本曲线保留单项目分析，同时默认进入全局汇总，符合“先看整体盘子，再下钻项目”的工作流。
- 认证门禁放在应用最外层，Header 只展示已登录用户和同步状态，避免未登录用户进入业务页。
- 云端加载使用 `maybeSingle()`，新用户没有 `user_data` 行时不当作错误。
- 注册使用 `signUp`，登录使用 `signInWithPassword`，忘记密码使用 `resetPasswordForEmail`；密码只由 Supabase Auth 处理，应用不保存、不比较密码。

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
