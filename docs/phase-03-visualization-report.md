# P3 可选可视化实施报告

日期：2026-10-14；隔离工作区 ModCrafting-mcp-p1 / feat/mcp-foundation-p1。浏览器首发 MVP 已本地验收，尚未提交/发布；阶段状态以 [转型路线](./transformation-roadmap.md) 为准。

## 实现范围

首发浏览器工作台覆盖打开已有工程、系统环境/资源诊断、按需资源准备、构建/日志/停止、隔离 MC 启停与实例选择、V2 快照/辅助截图、场景 JSON、三态结果和原始报告下载。MCP Apps 与游戏内新 HUD 未实现，未扩展旧 Desktop，也没有模型接入或 Agent Loop。

复用 FabricRuntime、现有工具链/资源准备/Observer/执行器/报告，以及 React 19.2.7、ReactDOM、esbuild。纯 SVG、页面错误恢复边界、字体/配色迁到独立 view 包；不导入旧 Renderer。浏览器与 MCP 在同进程使用相同 runtime，Core 仅增加 state() / CoreRuntimeState 和 JobManager.list()。

薄 loopback 适配位于 plugins/modcrafting-fabric/src/browser-server.ts，前端位于 packages/modcrafting-view/src。原 MCP 工具名/描述/inputSchema 仍为 19 个；只有显式 --web 的环境结果附加 browserUrl。--web-only 可独立使用；默认不开 HTTP。前端 JS/CSS/HTML 随已有自包含 server bundle 内嵌，Stage 仍为九文件，React MIT 合并入许可清单，无新增依赖或锁变更。

宿主选择核对了官方 MCP Apps / OpenAI 文档，仅明确 ChatGPT 的标准支持，未据此宣称当前 Codex 的嵌入 UI 已验证。首发不引入额外扩展 SDK/宿主适配；后续 P4 逐平台验证。调查依据与完整用法见 [浏览器指南](./browser-view.md)。

## 定向验证

| 检查 | 本地结果 |
|---|---|
| view:typecheck / plugin:typecheck | 通过 |
| Node 22.23.3 / 24.19.0 Core 回归 | 各 68/68，增加三条浏览器安全/状态/报告回归 |
| 仓库外、无 Desktop/Electron、仅 Zod 的副本 | Node 22/24 各 68/68；Store reused 1、downloaded 0，独立 node_modules |
| Stage 与官方 SDK 协议 Smoke | Node 22/24 各 19 工具；仓库外隔离解析、缺 Java 诊断、EOF 均通过 |
| 当前自包含 Bench 包 / Node 22 fixture | 21/21 匹配，实际 5 PASS / 5 FAIL / 11 INCONCLUSIVE，未冒充 live |
| 全仓旧基线 | 832 / 811 / 21；21 个失败名称与 P2-04 相同，23 条 TS 错误逐项相同 |

新回归检查无令牌 401、跨站/Host 重绑定 403、CSP、JSON/请求大小/操作白名单、非法项目/任务、共同任务状态和视图关闭后构建完成。受控 Observer 夹具复用 Core 验证真实三态语义、报告所属目录、图片数据和非法场景；夹具不宣称真实游戏 PASS。HTTP 服务关闭幂等，页面生命周期不调用 runtime.close。

CI 只增加 view/test 路径与前端类型检查；继续禁用 Desktop 安装脚本，不启动真实 MC，不上传或发布。远端 Actions 未运行。

## 真实浏览器与游戏

验收使用仓库外 MCP Stage、Chrome/CDP，以及 P2-04 工程/已准备资源和专用世界的副本；系统 Oracle JDK 21.0.3 / 预热 Gradle 9.5 缓存，Observer 2.0.0 的 SHA-256 为 53197e8385c5a15beeeb79029a15164c845c3332689093579cc0c7227624132d。本轮不重复首次远端下载，也不使用原 Desktop 缓存冒充冷准备。

已从页面打开工程/诊断，发起真实构建后关闭页面，由同一 MCP 会话观察构建 completed / exitCode 0；重新打开页面读取同一任务。页面发起游戏、得到 V2 就绪、进入专用世界、读取快照并展示真实截图；页面提交只读健康匹配、不匹配和不支持 HUD 的场景，实际结果为 PASS / FAIL / INCONCLUSIVE，MCP 读取同一 job/result。

最终验证目录为 D:/Temp/modcrafting-p3-1ucO27/evidence/：报告 JSON 下载与所选任务一致；1320px 桌面和 390px 窄屏截图已查看，页面及任务区无横向溢出、无浏览器运行异常。关闭全部页面后同一 MCP/Core 实例执行有效只读场景仍为 PASS，重新打开页面停止游戏。六个任务均有终态结果，Minecraft 停止为 CANCELLED，服务退出 0；工程/资源/专用世界来源 SHA 清单不变。三次实机运行的 12 个相关 PID 最终剩余 0。

截图成功传递并展示；该次辅助截图捕获的是加载地形画面，没有当作 PASS 证据，也不宣称已验证容器/HUD 等未支持能力。当前运行包仍为 22 文件，浏览器内嵌于九文件 MCP Stage，包含 Observer V2 与八文件 Bench；产物与被测 MCP bundle 一致，manifest 指纹见 verification.json 的 delivery。

验证脚本的中间失败保留：首次错误等待折叠场景字段，随后首次可见报告按钮属于较早完成的 FAIL。对照实际 DOM/报告和 React 状态更新语义，改为等待指定 jobId 的报告按钮与报告内容；未因此修改 Core 判定或页面结果。截图使用即时滚动，避免平滑滚动尚未结束时捕获旧位置。两个失败运行的三态与来源保留记录仍可追溯。

## 证据、安全与限制

工程证据：temp/p3-verification/run-f7mpzmw0/，含 before.json、源码备份、Node/类型/全仓日志、baseline-comparison.json、仓库外副本记录和实际 UI 验收驱动。失败实机证据保留在 D:/Temp/modcrafting-p3-xwrxyr/ 与 D:/Temp/modcrafting-p3-S0NYzb/。最终运行目录与交付指纹在 verification.json 登记。

仍有明确边界：公开资源 Observer V1 需显式应用随包 V2；浏览器有帮助步骤及资源/实际桥状态区分，不会自动升级远端。Core 的五类断言及 HUD/tag/trace 等限制继续展示。工作台未迁移旧 Desktop 全部功能，不满足 P5 退役门槛；任务不跨服务重启恢复。MCP Apps、跨 Agent 账户安装、跨机器、其他浏览器/系统、冷 JDK/Gradle 以及远端 CI 未验证。

仅隔离 Worktree 开发，不提交/推送/发布/升级账户，不删除用户文件；原 main 与九个未跟踪文件按 P0 基线再次核对，正式 lock/.npmrc 与旧 Desktop 源码保持。本阶段不启动 P4/P5。
