# P1 独立 MCP 底座与可信验收

归档日期：2026-10-13。触发：Core 新模块、游戏验收缺陷修复及插件构建流程修改，自动归档。

## 背景与边界

P0 隔离与 P0.5 pnpm 迁移、EXE 启动修复后，用户授权开始 P1。新业务优先 Core/MCP，旧 Desktop/Harness 仅维护。本轮保留工具名称、清单格式与安装版本，不引入模型 API、Agent Loop、Gateway 或新游戏逻辑。

## 根因与决策

旧自测硬编码数量，没有 MCP 协议证据；交付复制范围含开发残留，默认数据落在安装目录。旧游戏规格仅粗略校验，历史 HUD、缺失实体/库存字段、查询失败和异常绕过 cleanup 都可能给出错误结论。

复用已有 esbuild、Zod 和 MCP SDK。增加文件白名单 Stage、官方 SDK Client stdio 烟测、持久数据目录与初始化可写检查；SDK Client 仅为同版开发依赖。小型 Core 验收模块检查不同标识的前后快照，HUD/command_result 保守 INCONCLUSIVE，finally 记录清理，清理失败撤销 PASS。未确认测试世界时禁止清理命令，避免将“总要清理”误用到普通存档。

Windows Wrapper 复用现有 cmd 启动方向；停止只针对插件拥有的 PID 树。任务状态不序列化 ChildProcess，已停止任务不会被晚到 callback 改为 completed。Fabric 文档查询兼容原缓存并读取资源准备实际写入的位置。

## 关键文件

- Core：domain.ts、game-test.ts、node.ts、index.ts。
- 插件：mcp-server.ts、README、GPL/第三方许可、游戏 Skill。
- 脚本：scripts/plugin 的 build/validate/stage/smoke/test，两个定向 harness 测试。
- 门禁与文档：plugin.yml、package/唯一 pnpm 锁、架构边界、实施报告。

## 验证与限制

39 项定向回归全过；Node 22/24 真实 MCP 初始化、工具发现与调用通过。仓库外 Stage 禁止解析外部模块，stdout 仅协议消息，非法/不可写数据目录及意外退出及时报错。空依赖目录使用共享 Store 冻结安装、忽略 Desktop 脚本，不下载 Electron，独立插件 CI 序列通过。

Codex CLI 0.162.0-alpha.17.2 的本地安装与安装缓存入口协议 Smoke 通过，仅使用测试专有配置。完整 build 通过；全仓类型检查仍有相同 23 条错误，Harness 800 条中 779 通过/21 既存失败，新增失败 0。

真实 MC/Observer、Gradle 编译、资源首次下载、桌面安装界面和远端 Actions 未执行，不将夹具 PASS 宣传为游戏能力验证。原 main 与 9 个未跟踪文件 Hash 不变，无提交、推送或发布。明细与日志位置见 [P1 实施报告](../phase-01-implementation-report.md)。

## 可复用经验

工具计数来自 tools/list；构建/注册成功不等于协议或游戏通过。数据根与安装文件分离，初始化不联网。以缺失证据返回 INCONCLUSIVE，只有有效观察不匹配才 FAIL；清理结果是最终 verdict 的一部分。隔离测试保留自己的证据，拒绝未知 Stage 残留而不删除用户文件。
