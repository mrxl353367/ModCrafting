# 本地候选版本与真实模组验收结果

日期：2026-10-15。工作分支 feat/mcp-foundation-p1；不修改原 main，不删除用户数据，不推送。

**候选源码已本地固化，干净源码复建与真实物品交互验收通过。** 这是内部开发试用，未安排外部用户试用或执行远端发布；Qoder 原生调用继续按此前决定待验收。

## 候选与交付

- 源码提交：`74e8504e71d91b93d78c973d0d834e2a83e87b2c`，源码树 `d9a365bf153c660ab1dbe614cc1bce2d4d65b9c9`。包含此前 P0～P5 的审查后改动及本轮首次使用补齐；没有创建 tag 或推送。
- 固化交付：`<本地候选根>/74e8504-uvkwsmac`。distribution/ 为 **54 文件**完整三宿主包，example/ 为真实模组 JAR 与 GPL 许可，evidence/ 保存构建、工具轨迹、作业结果与四份原始 V2 报告。candidate.json 记录最终 source.zip 提交、已验收代码基线及交付文件 SHA；后续结果文档和交付指南链接修正与实机基线单列。
- MCP bundle：`a8a60093f26bc3b2cab3fb0adfb8280e5fde78bf626cda95c23c1b09e75668db`。工作区重新构建与独立源码构建相同；真实模组验收使用的 bundle 与最终交付相同。
- 示例：`example/iron_ticket-0.1.0.jar`，4,889 字节，SHA-256 `d8b29575a97ce6c76131a5dd952a1ecf9837c7389bd7ae2a772f196ac1c2a6b0`。JAR 的 id/version、初始化类和物品实现字节码均已检查。

## 首次使用补齐

1. MCP scaffold 嵌入仓库已有 Windows Wrapper、Gradle 9.5.0 与官方分发 SHA-256，保留 Apache-2.0 许可。新工程可以直接进入构建；已有工程仍需 Wrapper，JDK21 由系统提供。Core 可选注入 Wrapper，未注入时保持原行为。
2. 工程元数据使用有效的 0.1.0，去掉未展开的版本占位符；嵌入批处理统一行尾，避免 Git 导出行尾影响 bundle。
3. 新 candidate:build 复用现有构建/Stage，系统 JAVA_HOME + bridge-mod Wrapper 从源码构建 Observer V2，再组装完整产品和三宿主包。普通 pnpm build 保持纯 Node 路径。
4. examples/iron-ticket 与 acceptance:first-use 固化实际开发任务。测试脚本通过官方 SDK 调用独立产品 MCP，不接模型 API，不回放或伪造游戏结果；显式复制专用世界和资源缓存，检查输入指纹。
5. Git 导出复建发现 resources/ 忽略规则误伤示例资源，为该示例目录增加精确例外；新增资源/契约校验，完整产品以明确文件清单携带示例。提交前修正少量 Markdown 行尾和 Icon EOF 检查问题，保留文档文字与渲染换行。

## 可复现验证

Git 树导出到 `D:\Temp\modcrafting-candidate-checkout-5xbfcolx\source`，独立安装 node_modules。pnpm10.34.7 --frozen-lockfile --offline --ignore-scripts，Store D:\.pnpm-store\v10：**下载 0 包，安装 13.3 秒**。目录与原 Worktree 的 node_modules 不同，均非目录链接。

独立源码通过类型检查、**82/82 测试**、MCP 协议烟测与 candidate:build --offline；Observer 使用系统 Oracle JDK21.0.3、Gradle9.5 和已有缓存，从当前 Java 源码编译，没有复制历史临时 JAR。已验收代码基线与该验证目录逐字节一致；后续仅补充结果文档和修正交付示例指南链接，重新组装校验，MCP bundle 保持相同。Node22.23.3 再跑 82/82；Node22/24 三宿主 SDK/config 各验证 19 工具和浏览器回退，不冒充新的原生宿主验收。

## 真实模组闭环

要求：使用一张 iron_ticket:ticket 获得一枚 minecraft:iron_ingot，同时消耗兑换券。生成代码前通过 minecraft_data_lookup 得到铁锭标准 ID、stackSize=64，核对 Fabric/Yarn 对应版本 API。测试前再次查询铁锭、石头、空气等标准数据。

流程：MCP 环境检查 → scaffold 新工程/Wrapper → 写入示例源码 → validate → 真实 Gradle build → runClient → Observer V2 就绪 → 进入专用世界副本 → 测试 → 导出 JAR。只在 ModCrafting Test World 与保留区域操作。资源和 Gradle 缓存为显式既有输入，不能称为冷下载验收。

| 场景 | 实际结果 | 证据 |
|---|---|---|
| 未启动游戏实例 | INCONCLUSIVE / ENVIRONMENT_UNAVAILABLE | MCP 未排入虚假测试任务 |
| 不执行右键 | FAIL | 完整库存中铁锭数量为 0；负对照只检查奖励是否出现 |
| 右键一次 | PASS | 新鲜快照证明兑换券 2→1、铁锭恰好 1 枚 |
| 错误预期应得到至少 2 枚铁锭 | FAIL | 实际只有 1 枚，其他状态与清理正常 |
| 再次独立准备后右键 | PASS | 不同快照请求再次证明 2→1 和 1 枚铁锭 |

四次实机报告均 cleanup.completed=3 / failed=false，浏览器状态接口读到相同六个任务；MCP 服务退出码 0，输入产品、资源缓存和世界源目录指纹保持。奖励来自模组服务端 use，测试动作没有 give 铁锭来代替功能。截图不参与 PASS。

成功证据：`D:\Temp\modcrafting-first-use-acceptance\run-qqUKqy`；完整开发校验记录在 `temp/candidate-lrrh1v2z`，固化副本位于交付 evidence/。

## 保留失败与限制

保留三次失败的运行目录，没有删除或改写结果：run-zDZrX3 中空背包 clear 使准备和清理失败；run-BWybIU 中负对照读取不存在的奖励槽，正确得到 EVIDENCE_MISSING；run-zNyzCC 中 JSON 省略 null 界面类名，脚本严格 null 判断导致就绪超时。修正场景前置条件、负对照观测与脚本字段判断后通过；没有放松 Core 的证据/清理规则。

首次源码复建失败也保留日志，根因为示例资源未入 Git；修正后完整复建通过。既存旧 Desktop Harness 失败和类型错误按 P5 记录单列，本轮没有扩展为旧代码清理任务。Qoder 登录后实际调用、其他系统、冷工具链/资源下载、外部用户体验与远端 CI/发布仍未完成。
