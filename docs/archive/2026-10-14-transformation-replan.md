# 转型阶段重规划

归档日期：2026-10-14。触发：调整 Agent 工作主线与阶段规则，自动归档。范围为文档与指引，未修改业务代码、构建配置或安装状态。

## 原因与决策

旧阶段报告同时混入计划、补验与 Desktop 增强任务，导致“统一验收 Core”被执行为同时完善旧 Desktop。用户明确要求 Core/MCP 为主产品，Agent、浏览器或游戏内的可选可视化替代 Desktop，随后退役旧入口。

统一路线为 P0 基础（合并旧 P0/P0.5 进度）→ P1 MCP 底座 → P2 独立 Core/Bench 收口 → P3 可选可视化 → P4 跨 Agent 分发 → P5 Desktop 退役。当前只推进 P2；P0/P1 保留本地验收成果，旧报告与代码证据全部保留。

Core/Bench/Stage/协议成果继续复用；Desktop diff 需按必要安全维护与额外接入逐段审阅，尚未实际回退。旧 Desktop E2E、全断言迁移与安装器生命周期退出转型门槛。P2 需解决 Bench 测试导入 Renderer、插件 CI 依赖旧界面及实机驱动绑定历史临时工程的问题。

## 文档变更与验证

新增 [统一路线](../transformation-roadmap.md)，更新 AGENTS、产品/架构入口、集成边界与文档索引；原 P1/P2 任务和 P2 报告只增加历史身份与新路线链接。可选展示层按共同 Core 契约实现，首批交付一个入口，不同时建设三套业务系统。

变更前文档、工作区清单及变更后验证位于 temp/transformation-replan/run-*。检查相对链接、AGENTS 行数、diff 空白、变更范围，以及原 main/9 个未跟踪文件哈希；未因纯文档改动重跑构建或游戏测试。最近一次 46/46、21/21、10/10 属于已有代码验收，不是本次重规划执行的结果。

没有修改原 main、删除用户文件、回退代码、暂存、提交或推送，没有升级实际账户插件。后续进度只在统一路线登记，实施细节与证据在各阶段报告记录。

## P2-01 实施补充

用户随后授权实施。已完成 63 个已有变更文件的分类和逐段纠偏：移出 Desktop 的额外 Core 判定/统一摘要接入、快照扩展；保留清理安全与标签能力限制。两项兼容回归从 Bench 移到专用文件，并补一项实体标签回归；插件 CI 删除旧界面路径，独立测试用 Node resolve hook 阻断直接/间接 Desktop 和 Electron 导入。

Node 22/24 独立回归各 45/45，兼容回归各 3/3；没有 Desktop/Electron、只安装 Zod 的独立副本同样通过 45/45 与离线 21/21。副本采用 pnpm 10.34.7 共享 Store，node_modules 独立。全仓 809/788/21 和 23 条类型错误与旧失败逐项一致，构建通过。

已有 Core/MCP/Bench 执行源码、正式锁、Stage 和历史证据未改。本轮无真实游戏或模型请求。原 main 与 9 个未跟踪文件哈希不变，未暂存、提交或推送。证据在 temp/p2-01-verification/run-m7dqd8xe/；下一项为 P2-02，整个 P2 尚未完成。详见 [当前报告](../phase-02-core-report.md)。

## P2-02 实施补充

已将构建、实例、Observer 动作/快照、测试及报告编排迁入独立 FabricRuntime，抽出 contracts.ts 的纯数据类型。MCP 保持 19 个名称/描述/输入 Schema，环境新增资源布局与能力诊断。实例固定绑定、目录占用与失败/取消语义经回归验证；原非零客户端退出误判 completed 的反例日志保留。资源准备并发合并，复用原下载和解包链路。

Node 22/24 独立测试与无 Desktop/Electron 的副本均 54/54，离线 21/21；Stage 和真实 SDK Smoke 通过。全仓 818/797/21，23 条旧类型错误逐项不变。冷资源成功/失败路径为受控网络与实际 tar 解包夹具，不是首次真实远端下载或游戏运行。

更新开发 Stage，未升级实际账户插件；未动原 main、用户文件或旧 Desktop，未提交/推送。证据在 temp/p2-02-verification/run-je16ndg8/。下一项 P2-03 固化 live Bench；P2-04 再做独立交付和实机/资源验收，P3 可视化未开始。详见 [Core 契约](../core-contracts.md) 与 [当前报告](../phase-02-core-report.md)。

## P2-03 实施补充

将原十例实机输入固化为独立 Core live Bench 和 CLI，增加 esbuild 自包含双模式交付包；复用现有执行器、runtime、工具链、桥和报告，不依赖私有 Codex 驱动。参数提供工程/资源/输出/JDK/Gradle 缓存。新运行只写工程、Observer 和专用世界副本；资源来源也不参与 Core ensureRuntimePaths，避免 mkdir 副作用。世界菜单选择等待按钮 active 后再执行，解决存档异步加载导致的早点击失败。

无 Desktop/Electron、仅 Zod 的副本 Node 22/24 各 64/64；仓库外 fixture 各 21/21，最终 live Node 22 构建/Observer/专用世界 10/10 预期匹配，实际 5 PASS / 3 FAIL / 2 INCONCLUSIVE。12 作业收敛，来源工程/资源/世界的文件及目录不变，相关进程剩余 0。故意清理失败和菜单入口中间失败报告全部保留，不将期望 FAIL 改称 PASS。全仓 828/807/21，23 条类型错误与旧基线相同。

新增 Bench/测试/离线 CI 构建和使用说明，未动 Desktop、既有 MCP 工具、正式锁、用户账户或原 main，未提交/推送/删除用户文件。证据在 temp/p2-03-verification/run-zw63hny1/ 与仓库外专用运行目录；完整说明见 [当前报告](../phase-02-core-report.md) 与 [Bench 指南](../fabric-bench.md)。P2-04 的首次真实资源准备/独立交接尚未完成，P3 可选展示尚未开始。

## P2-04 实施补充

完成仓库外同一 MCP 会话的冷根/项目检查、五包真实准备与发布 digest 核对、知识查询、构建、专用世界十例和停止。发现文档 limit 越界，增加循环边界及稳定反例；发现公开 Observer V1 对 v2/capabilities 返回 NOT_FOUND，保留超时和停止证据。源码 V2 另有两处容器文件的十个旧编译错误，按 Yarn 1.21.4 修正映射/API，在独立副本成功构建 2.0.0。未扩展容器/18 类验收或改 Desktop。

新增 product:stage，复用原 MCP、Bench 与显式 V2 产物，拒绝真实 V1，22 文件包含许可/源码 JAR与指纹。兼容资源需在 prepare_assets 后、启动前复制到自己的缓存；远端仍是 V1，再次准备要重新应用。不能把本地源码构建称为远端资源已升级，不能遗漏这个步骤再宣称首次游戏已就绪。

Node 22/24 回归及无 Desktop/Electron 副本各 65/65，SDK Smoke 19 工具；fixture 各 21/21，MCP 实机 10/10（5 PASS / 3 FAIL / 2 INCONCLUSIVE），独立 live CLI 代表三态 3/3。17 作业收敛、服务退出 0、相关进程剩余 0；来源与用户原 main/文件保持。全仓 829/808/21 与 23 类型错误仍是旧基线。共享 pnpm Store、各目录独立 node_modules，无新增依赖。

证据：temp/p2-04-verification/run-hiklip3w/ 与 D:/Temp/modcrafting-product-p2-04/run-e3tgkygx/；详见 [当前报告](../phase-02-core-report.md)、[交接](../product-handoff.md)。P2 本地验收完成，未提交/推送/发布，未升级账户插件；远端 CI、冷工具链、跨机器和完整 GUI 不宣称已验收。下一项 P3 可选展示，尚未开始。

## P3 浏览器首发补充

核对官方宿主资料后选浏览器首发，复用 React 19.2.7 / ReactDOM / esbuild、纯 SVG 与旧展示配色，避免引入第二个执行器。浏览器薄 loopback 适配连接 MCP 同一个 FabricRuntime；Core 只增只读 state/list 契约。--web/--web-only 显式启用，默认不开 HTTP；原 19 工具和九文件 Stage 保持，视图内嵌于同一个自包含 bundle，合并 React MIT 许可，不新增依赖或共享 node_modules。

Node 22/24 定向与仓库外仅 Zod 回归各 68/68，SDK Smoke 19、fixture 21/21；类型检查通过，全仓 832/811/21 与 23 TS 错误保持旧基线。实机 UI 完成工程/环境、构建、游戏/快照/图片、三态场景和指定任务的报告下载；390px 布局不溢出。关闭全部页面后构建 exitCode 0、有效 MCP 场景仍为 PASS，页面停止游戏；六个任务终态、服务退出 0，三次运行 12 个相关 PID 剩余 0。两次验证驱动字段/时序失败和语法检查失败保留，未修改业务判定来掩盖它们。

证据：temp/p3-verification/run-f7mpzmw0/ 与 D:/Temp/modcrafting-p3-1ucO27/evidence/，详见 [P3 报告](../phase-03-visualization-report.md) 与 [浏览器指南](../browser-view.md)。原 main/用户文件/正式锁保持，无提交/推送/发布或账户升级。Observer V1→随包 V2 手动应用仍必要，截图仅辅助；MCP Apps 与新游戏 HUD 未实现，跨宿主/远端 CI 留到 P4，不提前删除 Desktop。

## P4 跨 Agent 分发补充

复用原 bundle/Skills/许可，按 Codex、Claude Code、Qoder CLI 官方格式生成各自清单；host:stage 在新目录验证并保留完整产品，host:config 只创建 TOML/JSON，禁止覆盖/链接输出，数据根与安装根分开。没有新增 Core、模型接入、Desktop 或生产依赖。只将 Skill 中 Codex 文件工具用词改为宿主 Agent，避免三套指令分叉。

Codex App 随附 CLI/App Server 0.162.0-alpha.17.2 与 Claude Code 2.1.206 各在独立配置完成安装、两份 Skills、19 MCP 工具与实际调用；Claude 使用官方 Agent SDK + 本地回放，0 真实模型调用，不据此声称真实模型质量。原生 TOML/JSON 备用与活动会话的浏览器 API 验证通过。Qoder CLI 1.1.71 的官方 ZIP 发布 SHA 已核对，仅解包到验证目录；原生 validate/install/list 与 init 的 19 工具 connected 通过，未登录调用为 authentication_failed。用户选择“先完成其余开发并保留这项验收”，因此 P4 开发可交付，但全部退出条件尚未满足，不进入 P5。

三宿主隔离副本禁用后安装缓存/数据标记保持；Node 22/24 定向回归各 73/73、三配置 SDK Smoke 各 19 工具与浏览器备用通过，全仓 837/816/21 和 23 条旧 TS 错误不变。Core bundle SHA 与 P3 相同，无须重复游戏验收。中间 Claude 动态 MCP pending/会话 EOF/新文件拒绝覆盖的验证驱动失败保留；按真实生命周期定位，未修改业务判定。

证据：temp/p4-verification/run-mfg17pmn/ 与 D:/Temp/modcrafting-p4-IjlblL/；见 [P4 报告](../phase-04-distribution-report.md)、[分发指南](../host-distribution.md) 和 verification.json。正式锁、原 main、用户未跟踪文件和真实账户保持；无提交/推送/发布/数据删除。MCP Apps、GUI 宿主安装、账户升级、远端 CI 和 Qoder 实际调用仍明确未验收。
