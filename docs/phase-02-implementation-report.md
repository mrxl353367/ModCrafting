# P2 实施报告：统一验收摘要与 Fabric-Bench MVP

> 原 P2 实施记录：下文结果和证据保留。当前进度按 [统一转型路线](./transformation-roadmap.md) 重新归类；末尾的 Desktop 前台验收与全断言迁移不再是转型必修项。本次重规划尚未回退历史代码。

日期：2026-10-14。范围见 [P2 任务](./phase-02-acceptance-bench.md)。已完成共用三态判定、Desktop 清理/快照证据适配、离线基准与真实 Minecraft 最小基准；不代表 Desktop 全部断言迁移或整个 P2 已完成。

## 实现与复用

- `packages/modcrafting-core/src/acceptance.ts` 提供无 Node/Electron 依赖的判定及 reportVersion=1 摘要。Core/MCP 保留原响应字段、增加 acceptance；Desktop 保存 session/spec/acceptance，保留原 IPC/UI 流程。
- 摘要包含 producer、fixture/live、场景、版本、断言、前后快照标识/时间和清理状态。正式 PASS 需要非空有效证据、两份新鲜快照和已验证清理；诊断重放不能算正式 PASS，历史日志不被重新认证。
- Desktop session 现在记录前后 requestId/observedAt 和 cleanup。每个清理动作前重新确认专用测试世界；动作失败继续尝试其他安全动作，桥失败/世界切换立即停止剩余清理。清理失败优先判为 INCONCLUSIVE / CLEANUP_FAILED，不再忽略清理错误。旧 session 缺证据仍是 unverified。
- `fabric-bench.ts` 与离线 CLI 直接复用 executeGameTest、[Zod](https://zod.dev/api)、[Node 测试运行器](https://nodejs.org/api/test.html)，没有添加依赖、模型调用或 MCP 工具。每次生成新目录，保存输入、JSON/Markdown、Node/平台及案例/执行源码 SHA-256。
- 独立插件 CI 接入离线 Bench；包括 Desktop runner/protocol 的路径触发，权限仍是 contents:read，无发布步骤。pnpm Store 与独立 node_modules、锁文件未改。

## 实机发现与最小修正

第一轮真实实体标签用例出现 FAIL。服务端日志显示猪已召唤且标签清理成功；独立实体探针观察到 minecraft:pig，但 tags=[]。本地 Observer 的 GameQueries.nearby 使用 client.world，entitySummary 读取客户端 Entity.getCommandTags。结合 [Fabric Yarn 1.21.4 Entity API](https://maven.fabricmc.net/docs/yarn-1.21.4+build.1/net/minecraft/entity/Entity.html#getCommandTags())，实测限制是客户端观察不能验证这次服务端命令标签；不能将空数组当作产品失败或不存在的证明。

最小修正在 Core 的 live 执行路径与 Desktop 实体断言中将 tag 过滤判为能力不足，保留 fixture 标签算法及按实体类型观察。没有修改 Observer、Java 模组或服务端查询架构。清理仍用服务端标签定位本轮自建实体；新增回归和真实 entity_tag_unavailable 案例证明门控。旧 Desktop 的标签场景也会保守返回能力不足，完整迁移仍待后续。

## 必要验证

| 验证 | 最终实际结果 |
|---|---|
| plugin:typecheck | Core、插件与离线 Bench CLI 通过 |
| plugin:test，Node 24.19.0 / 22.23.3 | 均 46/46，包括 P1 防线、Desktop 清理安全、标签能力与报告保守性 |
| bench:fabric，Node 24 / 22 | 均 21/21 预期 verdict/code 匹配；fixture 5 PASS、5 FAIL、11 INCONCLUSIVE |
| 全仓 pnpm test | 807 条、786 通过、21 个旧失败，名称与开始前完全相同 |
| 全仓 typecheck | 23 条旧错误逐条相同，未新增 |
| Electron-vite build | 通过，既有动态/静态 import 提示保留 |
| 插件 build / Stage / SDK Smoke | Node 22/24 协议与仓库外模块隔离通过，仍 19 个工具 |
| 最新 Stage → 真实 Codex 后端 → MC | 构建成功后 Observer ready；专用世界 10/10 预期判定/错误码匹配，实际 5 PASS、3 FAIL、2 INCONCLUSIVE |

实机案例使用独立工程和独立 gameDirectory，仅复制以前由本任务创建的 ModCrafting Test World，在预留区域执行。私有 CODEX_HOME 通过官方插件安装方式加载当前 Stage；没有模型请求，也没有读取或修改实际账户配置。构建复用已验证的系统 JDK 21 与隔离 Gradle 缓存。结果来自实际 MCP 调用；截图仅是辅助证据。

| 实机案例 | 实际判定 / 代码 |
|---|---|
| inventory_pass / inventory_fail | PASS / OK；FAIL / ASSERTION_FAILED |
| block_pass / block_fail | PASS / OK；FAIL / ASSERTION_FAILED |
| entity_pass / entity_fail（按类型） | PASS / OK；FAIL / ASSERTION_FAILED |
| value_pass / change_pass | PASS / OK；PASS / OK |
| cleanup_failed（刻意错误） | INCONCLUSIVE / CLEANUP_FAILED |
| entity_tag_unavailable | INCONCLUSIVE / CAPABILITY_UNAVAILABLE |

10/10 表示包含反例在内的预期结果全部匹配，不能写成 10 个游戏功能通过。清理失败案例另执行受控 clear 补清理；客户端/后端已停止，复核无本轮残留 Java/Node/Codex 进程。

## 证据与阶段边界

- 最终验证日志与旧失败逐项对照：`temp/p2-verification/final-*`，其中 final-baseline-comparison.json 保存 21 个失败名称。
- 最新离线报告：`temp/fabric-bench/run-3uFHHy/`（Node 24）、`run-Hde8Bp/`（Node 22）。首批 run-rDQj5h / run-CCwPNh 与更早证据保留。
- 最新实机证据：`temp/p2-live-bench/run-DBklGy/`，含 build.json、10 个 test-*.json、实体探针、summary.json、report.md、套件与执行指纹、停止记录及截图。
- 原实体标签失败 `run-uIRCWo/` 与门控前类型基准 `run-nuw8zR/` 保留，未掩盖失败。实机案例源为 scripts/bench/fabric-bench-live-mvp.json；执行驱动复用 P1 本地验收脚本，保存在 temp/p2-live-bench/driver.mjs，尚不是发布的通用 live CLI。bench:fabric 仍只接受离线 Schema，不会启动游戏。
- P1 开始前清单/patch 为 p1-before-*，被修改的 P1 未跟踪 Core/CI 原文在 p1-source/。最终 source-inventory.json 按相对 P1 的文件哈希记录 P2 改动；original-verification.json 复核原 main HEAD、状态和 9 个未跟踪文件哈希不变。

全部项目修改仍在隔离 feat/mcp-foundation-p1 分支，P0.5/P1/P2 未提交 diff 并存；没有暂存、提交、推送、发布或删除用户文件。独立 Stage 已更新，用户已安装的 P1 缓存未升级。

尚未完成 Desktop 前台端到端运行及全部断言迁移、通用实机 Bench CLI、远端 CI、正式安装器生命周期和首次资源下载。全仓红色旧基线保留，没有开始 P3。已按核心模块与行为规则修改的约定更新 [归档](./archive/2026-10-14-acceptance-fabric-bench.md)。

首批历史状态：本轮补验前仅完成 44 项定向测试、805/784/21 的全仓对照和离线 MVP，Desktop 清理/快照适配与本轮实机均未完成；以上结果为补验后的最新状态。
