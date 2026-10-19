# 测试实例准备、任务会话隔离与工作台重排

**归档日期**：2026-10-18（Asia/Shanghai）
**基线**：隔离修复分支 `2264ac0`
**交付版本**：ModCrafting Fabric 插件 `0.1.2`，Observer `2.0.0` / protocol 2
**触发方式**：复杂运行时、Agent 行为及工作台流程修改自动归档

## 问题与目标

开发者实测中，首次启动的 Minecraft 辅助功能界面让自动化停住；测试实例没有可配置的语言、地图和游戏规则；浏览器工作台把所有创作区纵向堆叠，阅读困难；不同聊天任务可能串用实例、状态和报告。本轮以完整的“描述需求 → 构建 → 准备游戏 → 进入专用世界 → 验证 → 报告”链路修复，不依赖验收脚本预写游戏设置或存档。

## 实现

| 位置 | 变化 |
| --- | --- |
| `packages/modcrafting-core/src/domain.ts`、`sessions.ts`、`runtime.ts` | 增加版本化游戏测试配置、默认值、持久任务 session、作业和报告归属；工程源码共享，实例和报告按 session 隔离；同工程构建串行、运行实例占用明确拒绝。 |
| `packages/modcrafting-core/src/fabric-bench-live.ts`、`plugins/modcrafting-fabric/src/mcp-server.ts` | Bench 与 Minecraft 启动、构建、测试、停止、状态查询要求显式 session；测试作业等待真实 `test_ready`，桥接连接本身不作为就绪；新增 `modcrafting_session`、`modcrafting_test_profile`、模板入口并公开真实 GameTestSpec。 |
| `bridge-mod/src/client/java/com/modcrafting/observer/GamePreparation.java` | 复用 1.21.4 原生创建世界页面和 `WorldCreator` 设置，自动处理无障碍向导；识别原生加载界面时等待；新地图或 Core 复制后的存档副本都写入 session 归属标记，只调整会话副本。 |
| `plugins/modcrafting-fabric/src/browser-server.ts`、`packages/modcrafting-view/src/client.ts` | 工作台链接携带 session/backend；所有 API 按 token、backend 和 session 校验；切换会话取消旧请求并丢弃迟到响应。 |
| `packages/modcrafting-view/src/App.tsx`、`view.css`、编辑器组件 | 重排为任务状态栏、侧栏导航和单一主区域；跟随 Agent 自动切页与手动导航可切换；窄窗口折叠菜单；配置、诊断与报告归入对应模块；编辑草稿按会话/工程保存，并在恢复时检查工程版本。 |
| 技能、指南、接口文档、Smoke 与验收脚本 | 将状态和恢复建议改为通俗中文；说明各阶段能力边界；验收入口创建真实 session 并使用产品配置、实例复制和自动进图，不手动预置 `options.txt`、存档或模拟菜单点击。 |

自动创建和加载世界依据 Minecraft 1.21.4 的原生页面/配置 API；当前世界根目录通过 `level.dat` 的父目录定位，避免把 `WorldSavePath.ROOT` 的语义当作存档文件夹名。参考 [CreateWorldScreen](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/client/gui/screen/world/CreateWorldScreen.html)、[WorldSavePath](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/util/WorldSavePath.html) 和 [LevelStorage.Session](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/world/level/storage/LevelStorage.Session.html)。

## 验收证据

- TypeScript 两侧 typecheck 通过；插件全量回归 `114/114` 通过；最后一轮候选流水线从当前源码完成 Bench、迁移、Observer、MCP、产品及三宿主包构建，Gradle 在线模式。Observer Java 改动经完整候选流水线编译。
- MCP SDK 冒烟覆盖 26 项工具；Codex、Claude、Qoder 三宿主 SDK/config 烟测通过（不等于真实宿主聊天调用）。Edge 桌面与 420px 窄屏工作台截图检查通过，单工作区和窄屏导航可见、无横向溢出。
- Qoder ZIP：`temp/qoder-artifacts/modcrafting-73tCab/modcrafting-fabric-qoder.zip`，版本 `0.1.2`、非机器专用、后端 SHA-256 `d8cf40e545833a15330c1573e61bde5dbc8e04420ab70bd981e35c211607a773`。只生成本地候选，未安装、未发布、未改真实 Qoder 配置。
- 最终真实首次启动：`temp/acceptance-results/run-1PBwo3/acceptance.json`。空 session 游戏目录由产品生成设置，自动准备专用世界；`bridgeReady:true`、`canRunTests:true`、`phase:test_ready`。启动就绪 PASS，三项真实玩法用例为两 PASS、一个重复操作 PASS；两个反例返回预期 FAIL。清理完整，会话结束后客户端退出码 0；报告和浏览器 session 隔离通过；验收输入未变化。
- 调试中有三项真实边界被最终修复：首次 Gradle 资产下载超过 300 秒时安全超时；加载中的 buttonless `MessageScreen` 曾被误判未知界面；进入世界后 `ROOT` 路径比较曾误判存档。后两项修复后，第四次全新游戏目录验收通过。该成功复用了系统 Gradle/Minecraft 资产缓存，因此完全冷网络下载仍需单列，不声称已通过。

## 交付边界

本地候选源码及 Qoder ZIP 已准备好供审查。Qoder 插件没有安装，未修改宿主配置；没有进行新 Qoder 聊天/真实模型行为验收，宿主模型是否每轮选择合适模块仍待实测。浏览器截图、SDK/config 冒烟、Minecraft 启动就绪与玩法断言分别代表不同证据，不能互相替代。没有发布候选、创建 tag 或推送。
