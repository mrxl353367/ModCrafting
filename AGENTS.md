# AGENTS.md

本文件为 AI Agent（Codex / Claude Code / Cursor / Trae 等）在此仓库中工作时提供精简指引。

> **完整文档**位于 [`docs/`](./docs/) 目录，按主题分类。本文件仅保留摘要与关键约定。

当前阶段与任务以 [转型路线](./docs/transformation-roadmap.md) 为准：P2 Core/Bench → P3 可选可视化 → P4 跨 Agent → P5 Desktop 退役。
新业务优先 Core/MCP；Desktop 冻结扩张，只做必要兼容维护。旧 phase 文档是历史任务与验收记录，Fixture 匹配不能当作真实游戏 PASS。

---

## 项目摘要

**ModCrafting** 正转型为面向外部 Agent 的 Minecraft Fabric 开发 Core/MCP 产品，提供项目、知识、构建与游戏验收；可选 Agent/浏览器/游戏内界面替代旧 Desktop。

- **技术栈**：Node.js · TypeScript · React 19 可选浏览器 · Fabric 1.21.4 · JDK 21 · Gradle 9.5；旧 Desktop 为 Electron 42
- **目标平台**：Windows x64
- **许可证**：GPL-3.0
- **仓库**：[github.com/newstarbar/ModCrafting](https://github.com/newstarbar/ModCrafting)

## 核心架构

新产品采用 Core/MCP + Observer，展示层可选；旧 Desktop 三进程架构作为兼容参考：
- **主进程**（`src/main/`）：IPC、工具链、游戏实例、终端、知识库服务
- **预加载**（`src/preload/`）：`contextBridge` 安全桥接
- **渲染进程**（`src/renderer/`）：React UI + AI Harness 系统

详见 [docs/architecture.md](./docs/architecture.md)。
P3 浏览器入口与共享 Core 状态见 [docs/browser-view.md](./docs/browser-view.md)，构建后使用 `pnpm run view:start`；Desktop 不作为新增界面的运行依赖。
P5 默认入口、工程路径迁移和旧数据保留见 [Desktop 退役指南](./docs/desktop-retirement.md)；旧源码仅兼容参考，不删除用户数据。
P4 清单/配置/分发与验收边界见 [docs/host-distribution.md](./docs/host-distribution.md)；原生宿主调用与 SDK Smoke 分开记录，Qoder 调用待已登录环境。

## 常用命令

```bash
pnpm run dev                     # 重建独立 MCP 后启动可选浏览器
pnpm run test                    # Core/MCP、浏览器、分发与迁移回归
pnpm run test:app                # 前台真实 Electron + 回放 Provider 回归
pnpm run test:mcp                # Test Lab MCP 协议烟测
pnpm run bridge:build            # 构建 Observer V2 桥接模组
pnpm run build:win               # Windows 构建（Setup + Portable）
pnpm run toolchain:verify       # 检查 JDK/Gradle 是否齐全
pnpm run knowledge:download    # 下载所有离线知识库
```

完整命令清单见 [docs/commands.md](./docs/commands.md)。

## AI Harness 关键约定

| 主题 | 说明 | 文档 |
|------|------|------|
| 三模式路由 | Chat / Plan / Execute，每轮独立分类 | [docs/harness.md](./docs/harness.md#三模式路由) |
| 计划阶段门控 | `MAX_READONLY_ROUNDS = 15`，锁定后仍允许只读与知识库工具 | [docs/harness.md](./docs/harness.md#计划阶段门控) |
| 验收契约 | 每条需求映射到构建、游戏断言或用户确认 | [docs/harness.md](./docs/harness.md#确定性游戏内测试-v2) |
| 工具集（48） | 文件 / Fabric / 构建 / 游戏 / 用户交互 / 流程控制 | [docs/harness.md](./docs/harness.md#工具集48) |
| 证据推进 | 本轮写入产物可跨步采纳；连续两次缺证据进入 `evidence_deadlock` 暂停 | [docs/harness.md](./docs/harness.md#关键护栏) |
| Test Lab | 隔离 Electron、回放 Provider、MCP、黑盒场景 | [docs/test-lab-mcp.md](./docs/test-lab-mcp.md) |
| 关键护栏 | 证据推进、修复范围、20/40/3 预算、三态裁决 | [docs/harness.md](./docs/harness.md#关键护栏) |
| 输出截断 | read_file 默认 400 行；工具输出 32KB；不显示原始大小 | [docs/harness.md](./docs/harness.md#输出截断) |
| 技能模块 | `SKILL.md` 指令包：索引进系统提示词，正文由 `read_skill` 按需取回，不改工具与门控 | [docs/skill.md](./docs/skill.md) |

## Minecraft 知识库

内置两套离线知识库 + Fabric 官方中文文档，运行时不联网。知识库构建已迁移到独立仓库 [ModCrafting-knowledge-base](https://github.com/newstarbar/ModCrafting-knowledge-base)。详见 [docs/knowledge-base.md](./docs/knowledge-base.md)。

| 知识库 | 工具入口 | 下载命令 |
|--------|---------|---------|
| minecraft-data 结构化数据 | `minecraft_data_lookup` | `pnpm run knowledge:download` |
| 中文 MC 百科向量库 | `mc_wiki_search` | `pnpm run knowledge:download` |
| Fabric 官方中文文档 | `fabric_docs_search` | `pnpm run docs:sync-fabric` |

**代码生成铁律**：编写方块/物品/实体/附魔注册代码前**必须**先调用 `minecraft_data_lookup` 查询标准 ID 与原版属性，禁止凭记忆填写参数。

## 维护红线

- **工具链下载逻辑双份**：`scripts/toolchain/toolchain-download.mjs` 与 `src/main/toolchain-download.ts` 需同步修改
- **GitHub + gh.xmly.dev 代理**：所有 GitHub 资产（Release 直链 / raw.githubusercontent.com）下载均通过 `https://gh.xmly.dev/` 反代加速，常量集中在 [src/main/github-mirror.ts](./src/main/github-mirror.ts) 的 `wrapGithubProxy` / `githubDirectAndProxy`；新增下载源时一律提供「代理 + 直连」双 URL，主进程用 `pickFastestUrls` 实测选优，禁止再用 ghproxy.com / gh-proxy.com（已失效）
- **Gitee 仅承载发布二进制**：Setup / Portable / latest.yml / blockmap 上传 Gitee 主仓；环境产物（seed / jre shards、extra-zips）一律走 GitHub Release + gh.xmly.dev 代理
- **MC 版本升级**：升级 `resources/fabric-versions.json` 后必须重新运行 `pnpm run knowledge:download`
- **内置技能需强制入库**：`.gitignore` 忽略了 `resources/`，新增 `resources/skills/<id>/SKILL.md` 要 `git add -f`，否则打包后技能缺失
- **AGENTS.md / CLAUDE.md ≤ 150 行**：只保留摘要与索引，详细内容写到 `docs/`
- **提交前确认**：未包含 API Key、`.env`、个人路径；未提交 `node_modules/`、`release/`、`runtime/`、`resources/jdk-21/`

## 发布流程

当开发者要求发布新版本时，Agent 按以下步骤执行：

P5 起标签推送不再自动发布 Desktop；新产品只做本地 Stage。需要维护旧 Desktop 发布时，先按 [退役指南](./docs/desktop-retirement.md) 明确授权，旧脚本为 `desktop:release:publish`，工作流仅显式确认的 v* tag 手动触发。下列为历史版本流程参考。

1. 读取 `package.json` version，基于近期 commit 推荐下一迭代版本（`feat:`→minor，`fix:`→patch，破坏性变更→major），说明推荐理由
2. 开发者确认版本后，更新 `package.json` version
3. 运行旧 `pnpm run desktop:release:publish`（标签推送不再自动触发 CI），一条命令完成：
   - 生成 `packaging/release-body.md` + 归档 `docs/releases/vX.Y.Z.md`
   - 创建并推送 tag 到 GitHub；旧 Desktop 发布须另行对该 tag 手动派发工作流
   - 推送 git + tag 到 Gitee 并上传 Release 附件

**前置条件**：本地已构建产物（`pnpm run build:win` 等）；`.env` 配置 `GITEE_TOKEN`（见 `.env.example`，已 gitignore）。

**幂等**：Gitee 已存在该版本时自动跳过。详见 [RELEASE.md](./RELEASE.md)。

## 归档机制（重要）

AI Agent 必须在以下场景触发归档，将工作总结写入 [`docs/archive/`](./docs/archive/)：

1. **开发者主动触发**：用户说"归档"、"archive"、"沉淀经验"等关键词时立即归档
2. **大功能改动自动触发**：新增核心模块 / 重构主流程 / 修复复杂 bug / 调整 Agent 行为规则 / 修改构建流程
3. **繁琐问题解决后提醒**：复杂问题解决后在总结末尾提醒"可考虑归档"

详见 [docs/archiving.md](./docs/archiving.md)。

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/README.md](./docs/README.md) | 文档导航总索引 |
| [docs/architecture.md](./docs/architecture.md) | 架构、模块、目录结构 |
| [docs/commands.md](./docs/commands.md) | 完整命令清单 |
| [docs/workflow.md](./docs/workflow.md) | Vibecoding 工作流 |
| [docs/harness.md](./docs/harness.md) | AI Harness 系统详细说明 |
| [docs/skill.md](./docs/skill.md) | Skill 技能模块：SKILL.md 格式、加载链路、管理界面 |
| [docs/test-lab-mcp.md](./docs/test-lab-mcp.md) | Test Lab 应用级自动化与 MCP |
| [docs/toolchain.md](./docs/toolchain.md) | 离线工具链 |
| [docs/knowledge-base.md](./docs/knowledge-base.md) | Minecraft 知识库 |
| [docs/archiving.md](./docs/archiving.md) | 归档机制 |
| [docs/archive/](./docs/archive/) | 已归档的工作总结 |
| [docs/AI_AGENT_GUIDE.md](./docs/AI_AGENT_GUIDE.md) | AI Agent 完整指南（综合旧版） |

## 测试

```bash
pnpm test
```

默认测试：`scripts/plugin/test.mjs`，独立 Core/MCP 定向回归。旧全仓 `scripts/test/run-harness.mjs` 使用 test:harness，自动收集 harness-*.test.ts；新增测试沿用该命名。
