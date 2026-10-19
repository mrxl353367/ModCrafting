# 架构概览

ModCrafting 的当前产品由一个本地 Node.js MCP 后端、可选浏览器工作台、Minecraft Observer V2 和外部 Agent 组成。旧 Electron/Desktop 程序不属于 `release` 分支。

```mermaid
flowchart LR
    Agent[Qoder / Codex / 其他 Agent] <-->|stdio MCP| Plugin[Fabric Plugin]
    Browser[可选浏览器工作台] <-->|受鉴权 HTTP| Plugin
    Plugin --> Core[ModCrafting Core]
    Core --> Project[共享 Fabric 工程源码]
    Core --> Session[session 专属游戏实例 / 作业 / 报告]
    Core <-->|Observer V2| Game[Minecraft 1.21.4]
```

## 模块职责

| 路径 | 职责 |
|---|---|
| `packages/modcrafting-core/` | Fabric 工程检查、资源准备、session、测试配置、Gradle/游戏任务、Observer、报告与创作工作区逻辑 |
| `packages/modcrafting-view/` | 配方、内容参数、MC 界面、构建、游戏、测试及报告页面；按 session 保存草稿 |
| `plugins/modcrafting-fabric/src/mcp-server.ts` | 工具注册和输入校验；将操作委托给 Core |
| `plugins/modcrafting-fabric/src/browser-server.ts` | Token 鉴权、静态工作台服务、按 session 查询和操作 |
| `plugins/modcrafting-fabric/src/workbench.ts` | 本地浏览器打开与链接返回 |
| `bridge-mod/` | Observer V2 的游戏内状态、命令和准备阶段接口 |
| `scripts/plugin/` | 插件构建、验证、Stage、Qoder ZIP 和候选包 |
| `scripts/bench/` | 离线案例集与可选的真实游戏回归 |

## 运行边界

Core 和工作台共享工程源码，但 session 的页面状态、游戏实例、作业、日志和报告相互隔离。所有游戏相关操作都需要 `sessionId`；省略实例时只会选择该 session 的实例。同一工程构建串行，同一工程正在运行的游戏不会被另一 session 抢占。

浏览器链接携带本地后端标识和 Token。页面关闭不停止作业；session 结束只停止该 session 拥有的任务。后端重启后，未结束作业记录为 `interrupted`，保留历史结果但不伪装为仍在运行。

游戏启动准备有独立阶段：准备文件、启动客户端、等待桥接、处理首次向导、准备世界、进入世界、可测试。`bridgeReady` 仅代表 Observer 可通信；测试只有在 `canRunTests=true` 后才可执行。

## 构建与打包

`plugin:build` 将 MCP 服务及浏览器资源打成自包含入口。完整候选还需 JDK 21 构建 Observer V2，再由 `product:stage` 和 `host:stage` 生成本地交付包。Qoder ZIP 由 `plugin:qoder` 从候选包中的插件目录生成。此流程不安装宿主插件、不修改账户配置、不创建 GitHub Release。

命令和验证边界见 [命令清单](commands.md)、[Core 接口契约](core-contracts.md) 与 [候选验收](candidate-validation.md)。
