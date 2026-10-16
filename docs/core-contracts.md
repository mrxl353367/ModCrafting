# 独立 Core 业务与展示契约

契约版本：1，日期：2026-10-14。当前目标为 Windows x64 / Fabric 1.21.4。实现为 packages/modcrafting-core/src/contracts.ts、runtime.ts、node.ts、game-test.ts；不依赖 Electron、MCP SDK、模型 API 或旧 Harness。

## 入口与状态所有者

一个后端由一个 FabricRuntime 持有构建、Minecraft 和测试任务及实例映射。MCP 负责注册/参数解析/响应包装，调用该 runtime；live Bench 已直接复用相同 Core 能力，可选界面后续接入。

同进程入口复用同一个 runtime 对象。跨进程入口需连接已有所有者，不能另建 runtime 并假定会共享任务状态。P3 的可选 loopback HTTP 服务直接接入 MCP 已有对象，浏览器不另建所有者；未实现 MCP Apps 或 WebSocket。启动见 [浏览器指南](./browser-view.md)。

浏览器只消费 contracts.ts 的数据类型与序列化响应，运行时留在 Node 后端。既有静态 Core 函数继续导出，不因抽取而破坏旧调用者。

| 业务 | Core 入口 | 主要结果 |
|---|---|---|
| 环境、资源与能力 | runtime.environmentStatus(projectPath?) | CoreEnvironmentStatus；contractVersion、paths、assets、capabilities 与原工具链字段 |
| 资源准备 | runtime.prepareAssets() | ok、assets[].ok/error/path、dataRoot、localAssets |
| 项目检查/创建/校验 | inspectFabricProject、scaffoldFabricProject、validateFabricProject；检查已有路径用 resolveProjectPath | FabricProject、检查项；脚手架不自动生成 Wrapper |
| 标准数据与知识 | lookupMinecraftData、searchFabricDocs、searchWiki | 已有结构化查询/命中/缺失诊断；Wiki 当前为关键词索引查询 |
| 构建 | runtime.startBuild(projectPath, task?) | jobId；轮询 jobStatus |
| 游戏运行与状态 | runClient、runtimeStatus、stopClient | instanceId、jobId、gameDirectory；GameRuntimeStatus |
| 游戏观察与控制 | snapshot、command、input | BridgeResult；只使用本地 Observer 的允许路径 |
| 截图 | runtime.screenshot(instanceId?) | BridgeResult.data.path；本阶段仅 Core API，未增加 MCP 截图工具 |
| 确定性测试 | startTest(spec, instanceId?) | jobId、scenarioId；结果含原判定、acceptance、reportPath |
| 任务日志与停止 | jobStatus、stopJob、close | JobSnapshot / CoreFailure、最近 300 条日志；只停止本 runtime 拥有的进程 |
| 可选视图状态 | runtime.state() | CoreRuntimeState，contractVersion=1，jobs 与 instances；无需 UI 持有另一份任务映射 |

MCP 的 19 个工具名、描述和 inputSchema 表达式保持；环境、任务错误及实例状态仅增加字段。响应继续包含 structuredContent 及其 JSON 文本，沿用 [MCP 结构化结果规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content)。

## 环境与资源语义

environmentStatus.ok 沿用系统工具链检查结果，不能解释为所有资源、游戏或验收已就绪。必须分别读取 assets 与 runtimeStatus.bridgeReady。

| 资源 | 当前消费路径，相对 runtime 数据根 |
|---|---|
| minecraft-data | knowledge/minecraft-data/1.21.4/index.json |
| Wiki 包 | knowledge/mc-wiki-zh/ |
| Wiki 关键词索引 | knowledge/mc-wiki-zh-index/chunks.json |
| Fabric 文档 | 优先旧 knowledge/agent-knowledge/fabric；否则 assets/agent-knowledge/fabric |
| 基础模组 / Observer | assets/base-mods/ 下 JAR；需要 modcrafting-observer 命名的 JAR |

LocalAssetStatus.status 为 missing / present / invalid。present 只证明本地文件与基本布局/JSON 形状存在，不认证资源来源、内容完整性、JAR 兼容性或知识查询结果；不能代替真实构建/Observer 验证。

P2-04 冷下载验证了这个边界：公开 v1.0.1 的 Observer 文件 present，但 `/v2/capabilities` 返回 NOT_FOUND。完整本地交付另带源码重建的 Observer 2.0.0 / 协议 2，准备资源后显式复制到自己的缓存再启动；见 [交接步骤](./product-handoff.md)。prepareAssets 不自动应用兼容 JAR，再次准备会恢复远端版本，当前需重做该步骤。P3 应分别显示资源布局与实际协议/能力就绪状态。

runtime 构造和环境诊断不会下载或创建资源。MCP 启动仍沿用 P1 的数据目录可写检查，但不触发 prepareAssets。资源准备需显式调用，写入独立 dataRoot；同一 runtime 内并发请求合并为一次准备，避免既有 PID staging 冲突。

下载继续沿用已有 GitHub Release API、gh.xmly.dev 代理优先/直连回退及 ZIP 解包路径。P2-04 已在冷数据根下载五个真实 Release 包并核对发布 digest；生产 prepareAssets 不强制校验 digest，也不自动替换 Observer V1。受控夹具与真实远端验证分别记录，不使用原 Desktop 缓存冒充首装结果。

工具链来自系统 JDK 21 和工程 Wrapper，automaticDownload=false、scaffoldIncludesWrapper=false。资源准备不安装 JDK/Gradle；需要 Windows tar，Wrapper 与对应依赖由明确的工程环境提供。

## 任务、实例与错误

JobSnapshot 包含 id、kind、status、startedAt、finishedAt、output、pid、result、error/code；没有 ChildProcess 对象。当前 kind 为 build / minecraft / game_test，status 为 running / completed / failed / stopped。

- completed 表示执行完成，不能当作游戏 PASS；测试需要读取 result.verdict、result.code、acceptance 和 cleanup。
- 客户端/构建非零退出为 failed，分别为 CLIENT_FAILED / BUILD_FAILED。
- stopped 表示停止请求已接受；进程终止和 callback 可能稍后结束，result.code=CANCELLED 区分主动停止。close 复用现有进程树停止机制，退出处理遵循 [Node 子进程 close 语义](https://nodejs.org/api/child_process.html#event-close)。
- 缺失任务为 ok=false / JOB_NOT_FOUND；非法 Gradle 参数为 INVALID_ARGUMENT；缺路径为 PROJECT_UNAVAILABLE；缺系统工具链/Wrapper 为 ENVIRONMENT_UNAVAILABLE；缺基础模组为 ASSET_UNAVAILABLE。
- 缺实例为 INSTANCE_UNAVAILABLE；活跃或仍在停止回调中的实例占用相同 gameDirectory 时为 INSTANCE_CONFLICT；未运行或缺桥为 OBSERVER_UNAVAILABLE。未知内部失败为 JOB_FAILED 或保留 Node errno；MCP 的其他操作异常为 OPERATION_FAILED。

BridgeResult 保留 ok、HTTP status、data 与 error；查询失败还应读取 Observer data.code。CoreError 的 code 可直接供调用者分类，无需根据自然语言日志猜测。

GameRuntimeStatus 包含 instanceId、projectPath、gameDirectory、jobId、job、bridgeReady 和原始 Observer capabilities。BridgeDiscovery 的端口/token 不进入公开状态或报告；每次动作重新读取指定实例的发现文件，停止实例不能继续控制。

startTest 在启动时固定实际实例，避免另一 runClient 改变“最近实例”后将后续动作/报告切换到别的世界。省略 instanceId 只在选取时使用最近实例；明确指定 ID 更便于调用方管理。

## 场景、证据与能力

场景仍为 GameTestSpec version=2，严格校验后执行；报告摘要为 reportVersion=1。CoreCapabilities.contractVersion=1 是业务/展示契约版本，三种版本各自独立。

支持 inventory_contains、block_equals、entity_exists、snapshot_value、snapshot_changed。实体查询半径 32、上限 64；live 标签过滤、HUD、command_result 与 trace 来源断言仍为能力不足。Observer 原始 capabilities 出现某字段，不表示 Core 已支持对应可信断言。

PASS 需要有效断言、独立新鲜快照及完整清理；观测不匹配为 FAIL；能力/环境/证据不足及清理失败为 INCONCLUSIVE。有效场景缺实例时，MCP 为兼容保留 ENVIRONMENT_UNAVAILABLE / INCONCLUSIVE；Core 直接调用通过 CoreError 细分原因。

## P3 展示接入约定

最小界面读取项目/资源、任务日志、实例/桥状态、截图或报告产物及验收三态；必要操作调用 Core，不另建执行器。模型、对话和代码编辑由外部 Agent 承担。

截图 path 是后端产物路径，不能假定浏览器或 Agent iframe 可直接访问。P3 只传递 Observer 返回的有界图片数据，不读取任意桥端路径；报告只能通过本 runtime 任务的 reportPath 且位于 reportsRoot 获取。浏览器与 MCP 共用状态，宿主嵌入 UI 尚未实现。

P2 已完成本地独立产品闭环与交接。P3 的浏览器工作台沿用本契约，最小用户流程与验证见 [P3 报告](./phase-03-visualization-report.md)；阶段状态以 [转型路线](./transformation-roadmap.md) 为准。


## P5 Desktop 工程路径导入

Core 的 inspectDesktopProfile / migrateDesktopProfile / readProjectCatalog 复用既有工程检查，只迁移绝对路径引用。projects.json 为 catalogVersion=1 的路径清单，desktop-migration.json 最后提交并记录 SHA-256；不完整/被改动则拒绝读取。读回 projects 每次重新检查元数据，不采信迁移时的 valid。

MCP 仍为 19 个工具，输入不变；modcrafting_environment_status 增加 projectCatalog（catalogVersion、imported、projects）。可选浏览器 GET /api/projects 使用相同读取函数和现有 Bearer / Host / Origin 门控；无迁移数据返回空清单，不新增导入/任意文件读取 HTTP 操作。用户显式运行迁移 CLI 后重新连接使用新数据根。迁移不自动读取凭据、启动任务、导入旧报告或共享 node_modules，细节见 [退役指南](./desktop-retirement.md)。


候选收口更新：MCP scaffold 使用构建时嵌入的 Windows Wrapper（Gradle 9.5.0 + 分发 SHA-256），不增加工具或输入参数。Core scaffold 可选注入 ProjectWrapper；默认未注入时保持原行为。元数据版本固定为可加载的 0.1.0，不留下未展开的版本占位符。
