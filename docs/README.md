# ModCrafting 文档导航

本目录是 ModCrafting 项目的详细文档库，按主题分类组织。

> 项目根目录的 [README.md](../README.md) 是面向用户的快速入门。
> [AGENTS.md](../AGENTS.md) 与 [CLAUDE.md](../CLAUDE.md) 是 AI Agent 工作时的精简指引（≤150 行），仅包含项目摘要、关键约定、文档索引。

**当前开发入口**：[转型路线与阶段进度](./transformation-roadmap.md)。P2/P3 已本地验收；当前 P4 [跨 Agent 分发](./host-distribution.md) 与 [实施报告](./phase-04-distribution-report.md)：Codex/Claude 调用通过，Qoder 调用待已登录环境。P5 未开始。浏览器用法见 [指南](./browser-view.md)。下列旧 phase 文档保留历史任务与验收依据，不单独决定当前优先级。

## 文档分类

### 项目架构
- [agent-integration-boundaries.md](./agent-integration-boundaries.md) — Core/MCP、可选展示、Desktop 兼容与退役边界
- [core-contracts.md](./core-contracts.md) — Core runtime、资源/任务/实例/报告及 P3 最小展示契约
- [architecture.md](./architecture.md) — 现有实现与旧 Desktop 三进程架构参考

### 开发流程
- [transformation-roadmap.md](./transformation-roadmap.md) — 当前统一阶段表、已有成果映射、P2 清单与后续退出条件
- [phase-02-core-report.md](./phase-02-core-report.md) — 当前 P2 实施：范围整理、Core 契约、可移植 Bench 与独立验收证据
- [fabric-bench.md](./fabric-bench.md) — fixture/live 命令、仓库外交付包、工具链输入、专用世界与报告
- [product-handoff.md](./product-handoff.md) — P2 完整本地交付、Observer V2 兼容资源、首次使用与 P3 接口交接
- [workflow.md](./workflow.md) — Vibecoding 工作流、三模式路由、Plan → Execute 双阶段
- [commands.md](./commands.md) — 完整命令清单、脚本目录结构、发布流程
- [phase-00-git-report.md](./phase-00-git-report.md) — P0 Git 安全隔离的实际记录
- [phase-00-pnpm-report.md](./phase-00-pnpm-report.md) — P0.5 pnpm 迁移验证、打包启动修复与剩余既存失败
- [phase-01-implementation-report.md](./phase-01-implementation-report.md) — P1 D1–D8 本地交付、实际验证与未验证边界
- [phase-02-acceptance-bench.md](./phase-02-acceptance-bench.md) — 已被统一路线替代的原 P2 范围，保留历史依据
- [phase-02-implementation-report.md](./phase-02-implementation-report.md) — 原 P2 实施与实机证据，完成项按统一路线重新归类

### 候选版本与真实模组

- [candidate-validation.md](./candidate-validation.md) — 干净源码构建完整候选包、真实物品交互验收与本地固化

### P5 Desktop 退役

- [desktop-retirement.md](./desktop-retirement.md) — 功能替代、工程路径迁移、旧数据保留、回退和默认入口切换
- [phase-05-retirement-report.md](./phase-05-retirement-report.md) — P5 实施与验证结果
- [legacy-desktop.md](./legacy-desktop.md) — 原 README 的历史 Desktop 说明

### Codex 插件

- [phase-01-live-acceptance-report.md](./phase-01-live-acceptance-report.md) — 真实 Codex 后端加载、系统 JDK 构建、专用世界三态验收及入口修复
- [插件 README](../plugins/modcrafting-fabric/README.md) — 独立 Stage、实测 Codex CLI 安装、协议检查与能力限制
- [architecture.md](./architecture.md) - `modcrafting-fabric` 插件与共享核心架构
- [commands.md](./commands.md) - 插件构建、隔离测试、校验和本地 marketplace 使用方式

### AI Harness 系统
- [harness.md](./harness.md) — Harness 模块清单、工具集、计划阶段门控、护栏机制
- [skill.md](./skill.md) — Skill 技能模块：SKILL.md 格式、自动发现与按需加载、管理与打包
- [test-lab-mcp.md](./test-lab-mcp.md) — 真实 Electron 自动化桥、开发专用 MCP、黑盒场景与报告
- [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md) — AI Agent 当前开发入口与强制验证清单

### 工具链
- [toolchain.md](./toolchain.md) — 离线工具链、版本类型、初始化流程、维护注意

### Minecraft 知识库
- [knowledge-base.md](./knowledge-base.md) — minecraft-data 数据集、中文 MC 百科向量库、Fabric 官方文档、构建流程

### 归档机制
- [archiving.md](./archiving.md) — 归档触发时机、命名规范、归档模板
- [archive/](./archive/) — 已归档的工作总结（按时间倒序）

## 快速查找

| 我想了解 | 看哪个文件 |
|---------|-----------|
| 项目整体架构 | [architecture.md](./architecture.md) |
| 常用 npm 命令 | [commands.md](./commands.md) |
| AI Agent 是怎么工作的 | [harness.md](./harness.md) |
| 计划阶段为什么会被锁定 | [harness.md](./harness.md#计划阶段门控) |
| 内置了哪些 AI 工具 | [harness.md](./harness.md#工具集46) |
| 怎么运行应用级 Harness 回归 | [test-lab-mcp.md](./test-lab-mcp.md) |
| 游戏内测试如何裁决 | [harness.md](./harness.md#确定性游戏内测试-v2) |
| 离线工具链怎么工作 | [toolchain.md](./toolchain.md) |
| 知识库怎么构建 | [knowledge-base.md](./knowledge-base.md) |
| Vibecoding 流程 | [workflow.md](./workflow.md) |
| 怎么发布新版本 | [commands.md](./commands.md#发布新版本) |
| 归档机制怎么用 | [archiving.md](./archiving.md) |

## 文档维护原则

1. **精简的根目录文件**：`README.md`、`AGENTS.md`、`CLAUDE.md` 只保留摘要和索引，详细内容在 `docs/` 下
2. **分类清晰**：每个文件对应一个明确主题，避免跨文件重复
3. **随改动同步**：每次大功能改动后，相应文档同步更新；并通过归档机制保留本次工作记录
4. **避免过度文档化**：只在必要时新增文件，优先在现有文件内更新
