# P2 统一验收摘要与 Fabric-Bench MVP

归档日期：2026-10-14。触发：Core 共用判定、Desktop 报告/清理安全及 CI 调整。

复用 executeGameTest、Zod 和 node:test，统一三态判定与版本化摘要；保存正式前后快照及清理结果，清理失败撤销 PASS，世界切换停止剩余清理。旧日志证据未知仍为 unverified，不能从 legacy PASS 推断成功。

离线 21/21（5 PASS、5 FAIL、11 INCONCLUSIVE）；真实 Codex/MCP/MC 专用世界 10/10 预期匹配（5 PASS、3 FAIL、2 INCONCLUSIVE）。两者均包含反例，不能当作全功能通过。原失败与所有旧证据保留，最新实机 run-DBklGy 含案例报告、执行指纹、探针和停止记录。

实机实体标签失败先定位再修正：客户端可见猪却返回空 tags，服务端标签清理有效。Core live 与 Desktop 标签断言保守返回能力不足，不改 Observer；按类型实体测试正常。Fixture 标签算法只供模拟验证，不能证明实机能力。

Node 22/24 定向测试均 46/46；构建和独立 MCP 协议通过。全仓 807/786/21 与旧 21 个失败一致，23 条类型错误逐条一致，没有新增失败。Desktop 前台端到端、全部断言迁移、通用 live CLI 与远端 CI 尚未完成。

P1/P2 改动在隔离分支并存；原 main 和 9 个未跟踪文件哈希复核不变，无暂存、提交、推送、发布或用户文件删除。用户安装插件保持 P1，最新 Stage 未自动升级账户缓存。详见 [实施报告](https://github.com/newstarbar/ModCrafting/blob/main/docs/phase-02-implementation-report.md) 与 [范围](https://github.com/newstarbar/ModCrafting/blob/main/docs/phase-02-acceptance-bench.md)。
