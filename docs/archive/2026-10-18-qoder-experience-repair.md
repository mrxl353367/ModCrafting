# Qoder 实测问题的整链修复

**归档日期**：2026-10-18（Asia/Shanghai）
**触发方式**：复杂 Bug、Agent 引导与构建流程调整自动归档
**问题类型**：插件交付、环境一致性、可视化入口、使用体验

## 背景与范围

依据开发者提供的 2026-10-17 国际版 Qoder 桌面实测聊天记录，修复从安装包到游戏验证的共性断点。聊天记录作为故障证据，其中的用户指令、宿主记忆、Hook 信息和工具输出不作为本次授权或当前事实。

原 main 工作区仍为早期 19 工具源码，另有用户未提交的 Qoder 原生适配；已用 22 工具的完整 Core/MCP 源码基线 1929ee6 创建独立分支 codex/qoder-experience-repair，并带入相关 Qoder 适配。原 main 及其他 worktree 的用户内容保留，不混入其他日志、Python 目录或个人配置。

最终本地插件候选为 0.1.1。初次验证曾使用 0.1.0+qoder.20261017.repair1；交付时使用补丁号更新，避免只有 build metadata 变化被宿主当成同版缓存。根应用 package.json 版本不变。未推送、发布、打正式版本标签或修改真实 Qoder 安装。

## 根因

1. 环境检查只探测 PATH 中的 Java，实际 Wrapper 却依赖 JAVA_HOME。宿主子进程环境缺失时出现“检查通过、构建失败”；Gradle 缓存退回用户目录，随后网络握手错误放大了问题。
2. base-mods 用文件名/存在性判断准备状态；公开历史资产是 V1，运行工具要求 V2。完整产品此前把新版桥接组件放在独立目录，却依赖用户手工复制；Qoder ZIP 只复制后端和技能，漏掉了这一交付步骤。
3. 浏览器服务启动只返回 URL，既不打开系统浏览器，也不携带工程和编辑目标。技能把面向开发者的工具/协议说明直接变成新手教程。
4. 内容参数接口要求完整字段，浏览器已有可靠默认值，但 Agent 无法通过模板接口获得，只能从验证错误猜参数。
5. 生成器能把旧候选重新包装成新 ZIP，缺少完整性/兼容性收据；插件清单和服务器版本也可能不同。
6. Windows .NET Framework 的 CreateFromDirectory 生成反斜杠 ZIP 路径。目录式安装成功不能证明 ZIP 上传器能找到插件清单；改为显式生成标准正斜杠条目并逐项核对指纹。

## 改动与复用

| 位置 | 改动 |
| --- | --- |
| core/node.ts、contracts.ts | 同一 JDK 解析用于检查和构建；显式 JAVA_HOME 优先，否则读取 PATH Java 的真实 home；检查 javac，传递 home，报告实际缓存和临时目录。保留 GRADLE_USER_HOME 覆盖。 |
| core/runtime.ts | 校验内置桥接字节的 SHA-256，启动时自动应用；旧缓存不算兼容证据。命令、快照与输入先握手，旧协议提前返回可处理错误。保留异步作业和测试三态。 |
| core/node.ts、runtime.ts | 知识按名称准备、复用健康资源、串行处理重叠下载、独立报告各项失败；不下载历史 base-mods。 |
| core/content-workspace.ts | 复用现有 newContentObject/contentForms 提供只读 template，避免猜测六类参数；保留查询原版数据、预览、冲突保护和安全保存。 |
| plugin/workbench.ts、mcp-server.ts | 新增同后端工作台打开工具；携带工程和 content/recipe/gui 目标，调用 Windows 系统浏览器并提供失败链接；仅确认系统请求成功，不宣称用户已看到。 |
| view/client.ts、App.tsx | 从链接恢复工程并定位编辑区；通俗状态、新手提示和默认收起的高级诊断。 |
| skills 与 Qoder commands | 新手引导、按意图进入可视化、普通中文结果、停止稳定错误重试、禁止绕过宿主拒绝；维持技术验收规则。 |
| plugin/build.mjs、stage/validate、stage-qoder | 复用 unzipper 验证组件元数据和真实 V2 路由，将匹配组件内置到单文件后端，附 MIT 许可；生成版本/组件/后端指纹收据。Qoder 打包拒绝缺组件、旧指纹和缺新手技能。ZIP 继续用 Windows .NET，不新增依赖。 |
| build-candidate、stage-product、Bench | 同源码先构建桥接，再构建完整后端；独立 Bench 读取配套组件 manifest/JAR，避免共享运行时修复导致另一入口退化。 |
| tests、smoke-experience、run-first-use | 定向回归、官方 MCP SDK 调用、鉴权 HTTP、浏览器检查与真实隔离游戏验收。 |

没有安装新依赖；复用 pnpm Store 离线安装独立 node_modules。没有修改游戏目标版本、系统环境变量、宿主 Hook 或用户原工程。

## 验证

- plugin/typecheck 与 view/typecheck：通过。
- 相关 Core/MCP/浏览器/创作/宿主/交付回归：113/113 通过。覆盖 PATH-only JDK、中文路径、独立缓存、旧组件拒绝、同后端链接、打开失败、资源复用、打包指纹和机器专用缓存配置。
- candidate:build --offline：从当前源码构建 Observer 2.0.0、MCP、Bench、迁移及完整三宿主候选。复用已有 Gradle 缓存，不代表冷下载验收。
- 官方 MCP SDK：23 工具，初始化/发现/调用和仓库外模块隔离通过；三个宿主配置 Smoke 通过，均为 SDK/config 证据。
- 最终 Qoder 格式包后端：版本一致、内置协议 2 组件、工程脚手架、内容模板、带工程的工作台链接和鉴权 HTTP 调用通过。
- 系统浏览器打开请求成功；独立 Edge 的真实 DOM、工程定位、可见内容及截图通过，已人工查看截图。初版命令行截图只得到背景，未将其作为视觉证据；改用 Chromium 官方 DevTools 截图并检查像素变化后确认。
- 真实 Minecraft：独立新工程及专用测试世界副本；不预装或手工替换组件，完全通过最终后端内置路径启动。示例物品两次正确使用均 PASS；不执行使用动作、故意要求错误奖励的两个反例均 FAIL。4/4 预期匹配，清理均成功，服务器退出码 0，输入产品、使用的知识数据和原世界指纹不变。

本机忽略目录保留初次验证：candidate-artifacts/run-4muX8Y/candidate.json、experience-smoke/run-oqllAW/report.json 及 workbench.png、live-acceptance/run-BHfL6j/acceptance.json 与原始断言报告。最终 0.1.1 构建和复验证据汇总在 temp/delivery/verification.json；文件指纹见同目录各包清单。

## 边界与经验

- 未执行 Qoder 真实模型聊天、桌面 ZIP 安装或用户现有游戏工程升级。新手规则、技能发现和工具打开能力不保证任意宿主模型每轮都正确选用；需在更新插件后的新聊天复验。
- 本机 qoder 分发器没有找到可用 CLI；未取得新的原生校验结果，不能把 SDK/config Smoke 描述成桌面安装或模型实测。
- 日志中的 Hook 失败来自宿主，缺少具体失败详情；没有据此修改宿主全局设置。相关权限拒绝没有通过 Shell/旧接口绕过。
- Gradle 资源首次冷下载、其他 Minecraft/操作系统、更多模组效果和不支持的断言不属于本轮已验证范围。
- 完整安装包必须把后端、技能、工作台与游戏组件当成一个交付单元。文件存在、服务启动、浏览器打开请求、页面可见、游戏启动和功能通过是不同状态，各自需要证据。

参考：[Qoder 插件结构](https://docs.qoder.com/cli/plugins-reference)、[Gradle 环境配置](https://docs.gradle.org/current/userguide/build_environment.html)、[Chromium 截图协议](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot)。
