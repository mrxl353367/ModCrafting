# P2 独立 Core / Bench 实施报告

日期：2026-10-14。当前范围按 [转型路线](./transformation-roadmap.md)：**P2-01～04 已完成本地验收，P3 待开始**。旧 [P2 报告](./phase-02-implementation-report.md) 保留原验收证据，不再将 Desktop 完善视为转型门槛。下文各阶段验证表保留当时快照，最新结果见 P2-04；本地完成不等于已发布或远端 CI 通过。

## P2-01：主线整理与测试解耦

已按 P1 开始前的清单、当前混合 diff 和本轮变更前副本审阅 63 个已有变更文件。P1 清单显示 Desktop runner/protocol 当时是干净文件，本轮逐段处理 P2 接入，未整文件 reset，也未覆盖 P0/P1 工作。

| 分类 | 结果 |
|---|---|
| Core / MCP / Bench 的行为、Schema、报告与证据 | 保留，执行源码未修改 |
| P0 pnpm / 原生与打包修复、P1 Stage / 协议 / 工具 | 保留，本轮未改其业务或构建逻辑 |
| Desktop 的 Core 判定/统一摘要接入、额外快照记录 | 已移出；恢复旧判定入口和 session/spec 报告保存结构 |
| Desktop 清理失败撤销 PASS、每动作前检查测试世界、标签能力不足 | 作为兼容安全修复保留，继续冻结功能扩张 |
| Desktop 专用判定/清理回归 | 移到 harness-desktop-game-test-compat.test.ts，单独覆盖标签限制 |
| 插件 CI 的 Desktop 路径触发 | 移除；插件回归只加载 Core/插件/Bench 用例 |

`scripts/plugin/desktop-import-guard.mjs` 复用现有 SDK Smoke 的 Node resolve-hook 方案，阻止 plugin:test 直接或间接加载仓库 src/ 与 Electron。新的反例回归实际尝试 Renderer、Main、Electron 及间接导入，并确认被拒绝。[Node 官方 API](https://nodejs.org/download/release/v22.15.0/docs/api/module.html#moduleregisterhooksoptions)

Bench 的回归只导入 Core；统一摘要的保守性继续在 Core 测试覆盖。没有新建执行引擎、引入依赖或增加 MCP 工具。

## 验证

| 验证 | 结果 |
|---|---|
| 工作区 Node 24 / 22 定向插件回归 | 各 45/45，带 Desktop 导入守卫 |
| 工作区 Node 24 / 22 Desktop 兼容回归 | 各 3/3，仅验证保留的旧安全行为，不启动前台应用 |
| 无 Desktop / Electron 的副本 | 只复制 Core、三份定向测试、Bench 与测试入口，只安装固定 Zod 4.4.3；Node 22/24 各 45/45 |
| 副本离线 Bench，Node 22 / 24 | 各 21/21 预期匹配；fixture 5 PASS / 5 FAIL / 11 INCONCLUSIVE |
| plugin:typecheck | 通过 |
| Electron-vite build | 通过，保留旧 import 提示；仅验证本轮旧代码调整的编译兼容 |
| 全仓 Harness | 809 条、788 通过、21 个旧失败；失败名称逐项一致 |
| 全仓 typecheck | 23 条旧错误逐项一致 |
| 插件 CI | YAML 解析、只读权限、Desktop 路径与兼容测试不触发插件工作流检查通过；远端未运行 |

原定向 46 项中两个 Desktop 用例迁出，新增一个导入边界回归，独立入口变为 45 项；兼容入口有迁出的两项和新增的一项标签回归，共 3 项。全仓新增两项回归，没有通过删用例改善失败基线。

隔离副本使用 pnpm 10.34.7、共享 Store D:\.pnpm-store\v10，只有自己的独立 node_modules；离线首次安装复用 1 个包、下载 0。初次探针漏写 packageManager 时使用了全局 10.11.0，已保留该日志、补齐固定版本并再次验证；没有更改正式锁或共享任何 Worktree 的 node_modules。

## 证据与剩余任务

证据位于 `temp/p2-01-verification/run-m7dqd8xe/`：before/ 原文、before.json、change-review.json、baseline-comparison.json、isolation-summary.json、verification.json、logs/；standalone/ 保存不含 Desktop/Electron 的副本、独立锁及 Bench 结果。旧 P1/P2 的实机结果与临时工程均保留。

本轮未启动真实 MC、运行模型请求、修改 Observer、更新 Stage/用户插件或执行资源首次下载。Core/MCP 执行源码没有变化，因此历史实机验收继续作为历史证据，没有重复跑游戏或协议烟测冒充本轮新结果。

接下来执行 P2-02：核对 Core 与 MCP 的项目/资源/任务/实例/验收契约及业务边界；P2-03 固化可移植实机驱动；P2-04 独立交付验收。整个 P2 尚未完成，P3 可视化未开始。

仅在隔离 Worktree 修改；原 main、9 个未跟踪文件哈希及分支/HEAD 复核不变，无暂存、提交、推送或用户文件删除。归档已更新 [重规划记录](./archive/2026-10-14-transformation-replan.md#p2-01-实施补充)。

## P2-02：Core runtime 与数据契约

新增 contracts.ts 的纯数据类型与 runtime.ts 的 FabricRuntime，复用已有 JobManager、SystemToolchainProvider、Bridge、executeGameTest、资源下载/解包与报告函数。构建、游戏实例、动作、快照、测试及报告保存由 Core 持有，MCP 只做注册、参数和响应适配；没有另写 Agent Loop、引入依赖或扩展工具数量。

环境响应新增 contractVersion=1、资源 missing/present/invalid 和 Core 能力声明；旧主要字段保留。项目、任务、实例、场景/证据、截图与报告接口、错误分类及 P3 接入边界见 [Core 契约](./core-contracts.md)。截图只接入 Core，尚未新增 MCP 截图工具或展示服务。

迁移同时处理了实际生命周期问题：测试在开始时捕获实例，避免后续“最近实例”变化重定向动作；相同 gameDirectory 的活跃/停止中实例不能重复启动；退出非零为 CLIENT_FAILED，主动停止为 CANCELLED。新增稳定反例先复现了旧 runClient 非零退出仍 completed，修正后通过，原失败日志保留。

资源准备并发请求合并为一个过程，避免原 PID staging 冲突。新数据根中用受控 Release/API/下载夹具，实际执行 tar ZIP 解包、五个布局的消费检查、代理失败直连回退和网络失败诊断。夹具 JAR/知识包只用于测试，不能算真实资源或游戏验收。

| P2-02 验证 | 实际结果 |
|---|---|
| 工作区 Node 22/24、带 Desktop 守卫 | 各 54/54，新增 9 项 Core runtime 回归 |
| 无 Desktop/Electron、仅固定 Zod 的副本 | Node 22/24 各 54/54；pnpm 10.34.7 离线复用 1 包、下载 0、独立 node_modules |
| 副本离线 Bench | Node 22/24 各 21/21，仍是 fixture 判定匹配 |
| plugin:typecheck | 通过 |
| 插件 build / Stage / Node 22/24 SDK Smoke | 通过，仓库外模块隔离、真实协议与冷资源诊断正常 |
| MCP 兼容检查 | 19 个名称、描述和 inputSchema 表达式逐项与本轮之前一致 |
| 全仓 Harness / typecheck | 818/797/21；原 21 个失败与 23 条类型错误逐项相同，新增失败 0 |

证据在 `temp/p2-02-verification/run-je16ndg8/`：before/、baseline-comparison.json、mcp-contract-comparison.json、verification.json、logs/，以及 standalone/ 与原失败复现日志。更新了开发 Stage，实际账户安装缓存未升级；用户数据、原 main/9 个未跟踪文件与 P0/P1 其他工作保持不变。

本轮没有真实 MC/JDK/Gradle 运行或模型请求；HTTP Observer 和 Node 子进程是明确夹具。首次真实 Release 下载/资源完整性、实机复验、远端 CI 和可视化均未执行。下一项为 P2-03 可移植 live Bench，整个 P2 尚未完成。

## P2-03：可移植 fixture / live Bench

新增 `bench:fabric:live` 与 `bench:build`；离线命令保持兼容并支持显式 `--mode fixture`。实机直接复用 FabricRuntime 的系统工具链、构建/游戏/测试作业与 Core 报告，沿用原十例，不调用模型、不创建另一套 MCP/Codex 驱动。两模式共用摘要与 Markdown/JSON 输出，增加 executed/notRun 计数；预期匹配与真实三态分别保存。

输入为工程、资源根、输出根、可选 JDK/Gradle 缓存与 suite；均由参数/环境提供，代码没有本机固定路径。每轮复制工程（排除历史缓存、输出、Git、node_modules 和 .env）、Observer 及可选专用世界到新 run-*；拒绝链接和输出嵌入输入。所有 Core runtime 目录属于本轮，避免报告函数 mkdir 影响资源来源。来源工程、资源、世界的文件及目录清单均核对不变。

世界自动创建或从专用副本进入，精确世界名门控后才初始化预留区域和执行命令。保存菜单观测、输入案例、源码/执行包 SHA-256、项目/Observer/构建 JAR 指纹、Core 原始报告和停止证据。协作取消/超时等待 finally 清理，故意清理失败保持 INCONCLUSIVE；停止确认依赖工作回调/子进程收敛，不仅是 stopped 状态。

复用项目 esbuild 构建 8 文件交付包：两条自包含 mjs、两套 JSON 案例、README、GPL/MIT 许可和 manifest。无 Electron、源码解析或 node_modules 依赖。说明与可复制命令见 [Bench 指南](./fabric-bench.md)。本轮只改 Bench、相关测试/CI 和说明；既有 MCP runtime/server、19 工具、Desktop、锁文件、工具链下载逻辑与真实账户插件未改。

| P2-03 验证 | 实际结果 |
|---|---|
| 定向类型检查 | plugin:typecheck 通过，包含两个 Bench CLI |
| Node 22/24 独立副本 | 各 64/64；无 Desktop/Electron，只有 Zod 4.4.3；固定 pnpm 10.34.7、共享 Store、独立 node_modules，离线复用 1 包/下载 0 |
| 仓库外最终包的 fixture | Node 22/24 各 21/21；实际 5 PASS / 5 FAIL / 11 INCONCLUSIVE |
| 仓库外最终包的 live | Node 22.23.3 + 系统 JDK 21.0.3 + 预热 Gradle 缓存；真实构建退出 0、专用世界 10/10 匹配，5 PASS / 3 FAIL / 2 INCONCLUSIVE |
| 来源保留 / 进程停止 | 工程、资源、世界文件和目录清单不变；12 作业收敛，owned PID/范围进程剩余 0 |
| 全仓 Harness / typecheck | 828/807/21；原 21 个失败名称和 23 条类型错误逐项一致 |
| CI | 增加新 Bench 回归路径及离线构建步骤；默认不启动真实 MC，远端未执行 |

首次独立 live 在 Node 24 新建世界并 10/10 匹配；发现资源根会被报告 writer 创建目录后，改为完全独立的数据根。随后复制已有专用世界的入口在按钮尚未激活时失败（0 例执行），已保留原报告，并用“观察按钮 active 后进入”修正异步存档加载时序、增加反例。最终 Node 22 实机再次 10/10 匹配；明确区分这些中间结果，没有覆盖失败证据。

工作证据：`temp/p2-03-verification/run-zw63hny1/`，含 before/、logs/、standalone-final/、baseline-comparison.json、live-verification.json、final-process-check.json、verification.json。最终实机原始报告：`D:/Temp/modcrafting-bench-p2-03/verified-io4lj1j1/live/run-3hLoPt/report.json`；所有阶段、中间失败和截图保留。可移植工程改为官方 HTTPS Wrapper URL，缓存是显式验证输入，未在产品代码写入历史缓存路径。

本轮没有首次真实 Release 资源下载、冷 Gradle 依赖下载、远端 Actions 或跨机器/其他 OS 验证。实机十例仍是原版游戏与 Observer 管线验收；不能代替任意模组验收。下一项 P2-04 独立产品资源准备、完整闭环验收与交接；整个 P2 尚未完成，P3 未开始。

原 main HEAD、9 个用户未跟踪文件哈希保持不变；未删除用户文件，未暂存、提交或推送。按核心/构建流程变动要求追加 [归档](./archive/2026-10-14-transformation-replan.md#p2-03-实施补充)。

## P2-04：独立产品验收与交接

在 `D:/Temp/modcrafting-product-p2-04/run-e3tgkygx/` 完成仓库外交付验证。使用项目已有官方 MCP SDK Client/StdioTransport，服务的模块守卫拒绝 Stage 外加载；真实协议发现 19 个工具，环境诊断和项目检查 → 显式资源下载 → 知识查询 → 构建 → 专用世界十例 → Core 报告 → 停止均来自同一 MCP 会话。验收客户端本身是测试代码，未接入模型或私有 Codex 驱动，未升级用户账户插件。

两个真实 Release（knowledge-1.21.4-20261012 / v1.0.1）共五个 ZIP 成功下载、解包，大小和 SHA-256 与 GitHub API 的发布记录逐项一致。冷根最初无数据，环境返回五项 missing；准备后标准 stone 数据、中文 Fabric 文档及 Wiki 关键词查询实际可用。Wiki 模型/完整向量检索不在当前 Core 查询链路内，没有用关键词结果冒充语义能力。发布 digest 的核对属于本轮验收，生产 prepareAssets 当前没有强制 digest 校验。

本轮发现并最小修复两类实际缺口：

- `searchFabricDocs` 在一个目录内未及时停止，真实 limit=2 返回 16；稳定夹具先复现 3!==1，再在循环增加一处 limit 检查。新回归覆盖 assets/legacy 两种布局及跨目录限制；真实下载后的 limit=2 正常返回 2。
- 公开 base-mods.zip 的 Observer 1.0.0 对 `/v2/capabilities` 返回 NOT_FOUND。原运行没有进入世界/提交测试，最终 TIMEOUT，作业和服务收口，失败报告完整保留。当前源码 V2 构建另暴露十个旧编译错误，集中在两份容器源码；按 Yarn 1.21.4 的 [HandledScreen](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/client/gui/screen/ingame/HandledScreen.html)、[ScreenHandler](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/screen/ScreenHandler.html)、[SlotActionType](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/screen/slot/SlotActionType.html) 和 [NbtComponent](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/component/type/NbtComponent.html) 修正映射名、syncId、CUSTOM_DATA 与缺失 import。没有扩展容器功能、18 类断言或游戏逻辑。仓库外源码副本在系统 JDK 21.0.3、Gradle 9.5、既有预热缓存中成功构建 Observer 2.0.0；失败编译日志保留。

完整产品由新 `product:stage` 复用原 MCP Stage、Bench 包和已构建 Observer 组成，不改 MCP 内部白名单或增加工具。验证 Bench 指纹、Observer 声明协议/版本，拒绝真实 V1 JAR后才组装；运行时兼容仍以实际 capabilities 为准。含可选 sources.jar 的产品共 22 文件、许可和 manifest，无 Electron、node_modules 或运行时源码解析要求。交付命令、声明环境、兼容资源的明确步骤及 P3 契约见 [产品交接](./product-handoff.md)。

**明确的当前兼容步骤**：资源准备后、启动前，用产品附带的 V2 覆盖自己的 assets/base-mods/modcrafting-observer.jar。prepareAssets 再执行会恢复远端 V1，需重新覆盖；本轮没有更新远端 Release。原下载 ZIP 与发布 digest 不变，实际 V2 的来源和指纹另记。不能把替换后的 V2 称为远端下载得到的版本，也不能只分发原 MCP Stage 就宣称游戏首启资源已兼容。

| P2-04 验证 | 实际结果 |
|---|---|
| plugin:typecheck / Node 22、24 定向回归 | 通过；各 65/65 |
| 无 Desktop/Electron、仅 Zod 的独立副本 | Node 22/24 各 65/65；pnpm 10.34.7、共享 Store、独立 node_modules，离线复用 1 包/下载 0 |
| Node 22/24 真实 SDK 协议 Smoke | 通过；19 工具，冷根/无 Java 诊断、别名/非法路径/异常退出与 EOF 正常 |
| 五个真实远端资源与查询 | 5/5 下载/解包、发布大小/digest 一致；stone 标准 ID、文档 2 条、Wiki 2 条命中 |
| 兼容 Observer 的源码构建 | 修正前十个编译错误；修正后 BUILD SUCCESSFUL，产物/源码 JAR 与指纹保留 |
| 完整产品 Stage，Node 22/24 | 通过；22 文件，拒绝真实 V1、无源码/依赖解析要求 |
| 仓库外 MCP 构建及实机十例 | 构建退出 0；10/10 预期匹配，5 PASS / 3 FAIL / 2 INCONCLUSIVE；实际协议 2 |
| 仓库外 Bench | fixture Node 22/24 各 21/21；最终包 Node 22 live 代表三例 3/3（1 PASS / 1 FAIL / 1 INCONCLUSIVE） |
| 停止与来源保留 | MCP 12 作业、Bench 5 作业收敛；服务退出 0，相关进程剩余 0；Bench 来源工程/资源/世界与原专用世界文件/目录均不变 |
| 全仓 Harness / typecheck | 829/808/21；原 21 失败名称和 23 类型错误逐项一致 |

MCP 验收用例沿用 Bench 十例输入，未调用另一套判定器；截图/界面检查为辅助证据，不能作为 PASS。代表性 Bench 使用相同 Core，启动自己的实例，关闭 MCP 会话之后仍能独立执行。桥接 token 未出现在公开协议/报告证据中。Container GUI、空槽交互及完整组件指纹语义没有独立验收，不据此扩大支持声明。

证据在 `temp/p2-04-verification/run-hiklip3w/`：before/、logs/、standalone/、baseline-comparison.json、observer 构建/源码指纹、live-verification.json、bench-verification.json、final-process-check.json、verification.json。仓库外 `evidence-final/summary.json` 为最终 MCP 闭环，`live-bench/run-S1z2Mc/report.json` 为代表性 CLI 结果；原始下载、V1 超时、错误复现和所有运行均保留。产品副本在仓库外 `product/`，最终说明更新后另存新的交付目录与 manifest，位置见 verification.json。

P2 达到本地退出条件：独立 Core/MCP + Bench、真实资源（含显式 V2 兼容方案）、可信三态与交接可复现。远端 CI/发布、冷 Gradle/JDK 下载、其他机器/OS/MC 版本和实际宿主安装缓存升级未验证。公开 V1 资源缺口仍需在后续获授权发布时更新，当前使用随包 V2；不因此自动推送。下一阶段为 P3 可选可视化，尚未建设界面或启动宿主支持调查。

所有修改保留在隔离 Worktree；原 main/9 个未跟踪文件、用户数据与历史证据保持，无暂存、提交、推送或删除用户文件。按核心、构建和复杂问题修复要求追加 [归档](./archive/2026-10-14-transformation-replan.md#p2-04-实施补充)。
