> P5 状态更新（2026-10-15）：默认入口已切换 Core/MCP + 可选浏览器；旧 Electron 仅保留显式兼容入口，源码与用户数据不删除。迁移与功能替代以 [Desktop 退役指南](./desktop-retirement.md) 为准；下文中 P2/P3 的未来时态保留为早期设计背景。

# Core / MCP、可选可视化与 Desktop 的边界

当前阶段和任务以 [转型路线](./transformation-roadmap.md) 为准。新业务能力放在 `packages/modcrafting-core`，由 `plugins/modcrafting-fabric` 提供 MCP 薄适配。Core 不依赖 Electron，不接入模型 API，不承担 Agent Loop；对话、规划和代码编辑由宿主 Agent 负责。

Core 通过 Observer / Bridge 连接 Minecraft；可选可视化层支持 Agent 内 MCP Apps、浏览器 Web 界面或游戏内 HUD/面板。三入口共用 Core 的状态、报告与操作契约，Agent/浏览器尽量共用 Web 视图，游戏内界面复用协议。所有界面关闭时，Core/MCP 的构建与验收仍可运行。具体宿主的交互展示能力需实测。

展示层承接项目、环境、任务日志、游戏状态、截图和验收报告及必要操作。业务执行与状态保持在 Core，仅按实际需要增加最薄的传输适配；不为三种入口各写一套执行器，不复制旧 Harness 或加入新模型路由。

Desktop 冻结功能扩张，为既有用户提供必要兼容维护；其 Agent、Controller、WorkflowEngine 仅做明确缺陷修复。旧 UI、IPC 与 Harness 暂时保留，待 P5 的功能替代与数据保留验证后退役。旧前台 E2E、全断言迁移和安装器生命周期不是新产品阶段的验收门槛。

P2-01 已逐段处理原 Desktop 改动：额外 Core 判定/摘要接入与快照扩展已移出，清理失败、世界切换和标签能力的安全修复保留。兼容回归单列，Core/插件回归和 CI 不再绑定 Renderer；详见 [当前 P2 报告](./phase-02-core-report.md)。

`scripts/mcp/modcrafting-test-mcp.ts` 是开发者使用的 Electron Test Lab，依赖桌面测试环境。用户独立安装的是 `plugins/modcrafting-fabric`：二者不是同一产品入口，Test Lab 的能力不能作为插件验收证据。

当前 P2 只收口独立 Core 与 Bench；P3 才交付可选展示的一个最小入口，P4 扩展跨 Agent 分发，P5 处理旧 Desktop 退出。游戏内可视化不等于另建 AI 陪伴 Mod，不提前建设通用 Gateway 或三套界面。

P2-02 的 FabricRuntime 统一持有任务与实例，MCP 复用该对象，浏览器/游戏内入口以后通过同一所有者读写状态。纯数据与业务契约见 [Core 接口](./core-contracts.md)；跨进程展示不能另外创建 runtime 并假定其状态与 MCP 自动共享。

插件 CI 验证封装、协议和可控夹具；真实游戏验收需要独立授权、JDK 21、Observer V2 与专用测试世界。缺少证据时必须 INCONCLUSIVE，不能用启动或构建成功替代游戏 PASS。
