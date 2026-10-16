# 本地候选固化与真实模组首次使用验收

**归档日期**：2026-10-15<br>
**触发方式**：Core/构建与验收流程变更自动归档<br>
**问题类型**：交付收口、工程脚手架补齐、真实模组验收

## 背景

主体重构完成后，用户授权固化可回退的本地候选，并从真实模组需求验证新产品。继续使用隔离分支，不修改原 main、不删除用户文件、不推送。

## 实现与复用

复用已有 Wrapper、官方分发校验、Observer 源码、Core 项目/作业/V2、Bench 世界复制和官方 MCP SDK。新建工程附带 Wrapper，版本元数据可直接加载；candidate:build 从源码构建完整包。以 Iron Ticket 右键兑换为最小真实行为，例子、V2 spec、实机命令和许可随源码/完整产品保留，没有引入生产依赖或新的 Agent Loop。

## 定位结果

独立 Git 导出暴露 resources/ 规则误过滤示例元数据，使用精确例外和资源契约测试修正。三次实机失败分别为初始化命令的空状态、稀疏库存空槽不能视为已观测字段，以及 JSON 省略 null 字段造成的就绪判断错误。先读报告、Observer 实现和实际接口，再修正脚本/场景；Core 证据门控与清理裁决保持。

## 验证与交付

源码提交 `74e8504e71d91b93d78c973d0d834e2a83e87b2c`。Git 导出目录使用 pnpm Store 安装独立 node_modules，下载 0 包；类型、82 项回归、完整 Observer 源码构建及协议验证通过。Node22/24 的三宿主 SDK/config 验证仍与原生账户验收分开。

实机 2 PASS / 2 FAIL 加缺失实例 INCONCLUSIVE 均符合预期，四次清理完整，导出真实 JAR。完整三宿主包 54 文件，源码、样例和证据固化到 ModCrafting-candidates/74e8504-uvkwsmac；完整位置、SHA、失败目录和限制见 [验收报告](../candidate-validation-report.md)。原 main/9 项用户未跟踪文件保持，Qoder 原生调用继续待验收，无推送或发布。
