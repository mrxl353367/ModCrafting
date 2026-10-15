# ModCrafting

面向外部 Agent 的 Minecraft Fabric 1.21.4 开发与可信游戏验收工具。

Agent / IDE 负责模型、对话、规划和编辑；ModCrafting Core 提供项目、知识、构建、Minecraft 运行与 Observer V2 测试。可选浏览器工作台与 MCP 使用同一 Core，关闭页面后任务继续运行。

当前支持 Windows x64、Node.js 22.15+ 或 24、系统 JDK 21 和工程 Gradle Wrapper。源码安装使用 pnpm 10.34.7；无需配置 ModCrafting 模型密钥。

## 快速开始

本地跨宿主交付、安装与配置见 [产品交接](docs/product-handoff.md) 和 [Codex / Claude / Qoder 指南](docs/host-distribution.md)。产品包无需 Electron、源码或 node_modules；MCP 默认不启用 HTTP，显式加 `--web` 共用浏览器，或使用 `--web-only` 独立运行。

```powershell
# 产品根目录：数据根放在安装包外，使用自己的绝对路径
$env:MODCRAFTING_DATA = 'D:\ModCrafting-Data\core'
node ./plugin/dist/mcp-server.js --web-only
```

打开终端打印的完整本机链接。已有工程 → 检查 JDK / Wrapper → 显式准备资源 → 应用产品中的 Observer V2 → 构建 → 启动隔离游戏 → 查看测试证据。公开 base-mods 包仍含 V1，具体替换步骤见产品交接。自动测试只进入 **ModCrafting Test World**；截图不能证明 PASS，能力不足为 INCONCLUSIVE。

Codex、Claude 原生调用已本地验证；Qoder 已安装并连接 19 工具，实际调用待可用登录环境。MCP Apps 嵌入和新游戏内界面尚未实现，浏览器为现有替代入口。完整状态见 [转型路线](docs/transformation-roadmap.md)。本地交付不代表远端发布或远端 CI 已执行。

## 从源码开发

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build       # 独立 MCP + Bench + 数据迁移 CLI
pnpm run start       # 可选浏览器工作台，打开打印链接
pnpm run dev         # 重建 MCP 后启动工作台；源码变更后重新运行
pnpm run typecheck   # Core/MCP 与浏览器
pnpm test            # 独立 Core / 浏览器 / 分发 / 迁移回归
```

只共享 pnpm Store，各 Worktree 使用独立 node_modules。源码仓暂保留旧 Desktop 开发依赖；使用 `--ignore-scripts` 避免 Electron 等依赖生命周期下载，独立交付包不携带它们。默认 postinstall 只检查 esbuild。完整 Observer 产品组装见产品交接，`pnpm run build` 不构建 Java、不启动游戏或发布。

完整候选包与真实模组验收：`pnpm run candidate:build` 从当前 Observer 源码组装三宿主产品，系统 JDK21 必需；步骤见 [候选指南](docs/candidate-validation.md)。MCP 新建工程已包含固定版本 Wrapper，首次构建可能下载 Gradle/依赖。

## 从旧 Desktop 迁移

先退出旧 Desktop，按 [迁移与功能替代清单](docs/desktop-retirement.md) 对明确的配置目录执行只读盘点，然后显式导入到全新 Core 数据根。仅迁移工程路径引用；工程、node_modules、密钥、聊天、存档和大缓存原地保留。Agent 和浏览器重新检查路径，可继续打开原工程。

旧 Electron 启动/构建改用 `desktop:*`，历史命令 `build:win*` 保留作兼容入口；标签推送不再自动发布 Desktop。旧源码保留作兼容参考，不参与独立产品构建，见 [历史 Desktop 说明](docs/legacy-desktop.md)。

## 文档与许可

[架构](docs/architecture.md) · [Core 契约](docs/core-contracts.md) · [命令](docs/commands.md) · [Fabric-Bench](docs/fabric-bench.md) · [文档索引](docs/README.md)

GPL-3.0；Observer MIT，分发包附各依赖许可。ModCrafting 与 Mojang / Microsoft 无官方关联；不含 Minecraft 游戏本体，使用游戏需遵守其 EULA。
