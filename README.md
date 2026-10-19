# ModCrafting

**和 AI Agent 一起制作、构建并验证 Minecraft Fabric 模组。**

ModCrafting 为 Qoder、Codex 等外部 Agent 提供 MCP 工具和浏览器工作台。Agent 负责交流、规划和代码修改；ModCrafting 负责 Fabric 工程检查、知识查询、内容/配方/界面编辑、构建、游戏准备与测试报告。

当前发布主线为 `release`。仓库原 `main` 保留为旧版 Desktop 历史分支，不再作为新版本开发或发布基线。新发布分支不包含旧 Electron 应用、安装器或旧 Harness。

## 当前能力

| 模块 | 能力 |
|---|---|
| Agent 工具 | Fabric 工程检查/创建、Minecraft 数据和文档查询、构建、游戏控制与测试 |
| 浏览器工作台 | 内容参数、配方、MC 界面编辑；侧栏导航、单一工作区和 session 隔离 |
| 游戏验证 | Observer V2、独立测试实例、简体中文默认配置、首次启动准备和三态报告 |
| 交付 | Codex Plugin、Qoder Plugin ZIP、跨宿主配置包；`release` 分支 CI 验证，匹配版本的 `v*` tag 构建 GitHub Release |

未知或外部改写的 Java 文件保持只读。测试报告区分 `PASS`、`FAIL` 和 `INCONCLUSIVE`；截图、桥接成功或构建成功不能替代玩法验收。

## 从源码运行

要求 Node.js 22.15+、pnpm 10.34.7；构建 Observer 或运行真实游戏还需 JDK 21。当前验证目标为 Windows x64、Fabric 1.21.4。

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
$env:MODCRAFTING_DATA = 'D:\ModCraftingData\qoder'
pnpm start
```

终端会输出本机浏览器工作台链接。MCP 和浏览器共用同一个后端与任务状态；运行时使用单独的 `MODCRAFTING_DATA` 目录保存 session、作业、配置快照和报告。

## 构建 Qoder Plugin

先构建完整候选包（需要 JDK 21；首次 Gradle 解析可能联网）：

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
pnpm run candidate:build
```

从 `temp/candidate-artifacts/run-*/candidate.json` 找到 `product` 目录，再把其中的 `plugin` 子目录交给 Qoder 打包器：

```powershell
pnpm run plugin:qoder -- --source 'D:\path\to\candidate\plugin'
```

命令在 `temp/qoder-artifacts/` 生成 ZIP。默认不修改 Qoder 设置、不安装插件，也不发布到远端。打包说明和手动安装步骤见 [Qoder 使用指南](docs/qoder-user-guide.md)。

## 定向验证

```powershell
pnpm run typecheck
pnpm test
pnpm run plugin:validate
pnpm run plugin:smoke
pnpm run bench:fabric
```

离线测试不能证明 Qoder 新聊天的实际模型行为；需要在宿主真实登录环境中单独验证。候选包、首次启动、游戏和测试证据见 [候选验收记录](docs/candidate-validation.md) 与 [交接指南](docs/product-handoff.md)。

## 文档

- [架构与模块边界](docs/architecture.md)
- [命令清单](docs/commands.md)
- [Qoder Plugin 指南](docs/qoder-user-guide.md)
- [GitHub Actions 与 Release 规则](RELEASE.md)
- [浏览器工作台](docs/browser-view.md)
- [Core 接口契约](docs/core-contracts.md)
- [游戏测试与产品交接](docs/product-handoff.md)
- [知识库](docs/knowledge-base.md)
- [归档记录](docs/archive/README.md)

ModCrafting 与 Mojang/Microsoft 无官方关联，不包含 Minecraft 游戏本体。使用者需遵守 Minecraft 最终用户许可协议。
