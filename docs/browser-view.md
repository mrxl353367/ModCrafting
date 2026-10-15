# P3 可选浏览器工作台

首发入口为本机浏览器。外部 Agent 继续负责对话、规划和代码编辑；工作台只展示并操作同一个 FabricRuntime，不依赖 Electron、window.api、旧 Harness 或模型 API。

## 启动

开发工作区先 `pnpm run plugin:build`，再 `pnpm run view:start`。设置绝对可写的 MODCRAFTING_DATA，以及系统 JDK 21 的 JAVA_HOME / PATH；有离线缓存时明确设置 GRADLE_USER_HOME。

仓库外交付包无需安装依赖：

```powershell
$env:MODCRAFTING_DATA = "D:/ModCraftingData"
# 独立浏览器服务：从产品目录运行
node ./plugin/dist/mcp-server.js --web-only
# MCP 与浏览器共用状态：由 MCP 客户端启动此命令
node ./plugin/dist/mcp-server.js --web
```

打开 stderr 打印的完整本机 URL。`--web` 模式的 modcrafting_environment_status 同时返回 browserUrl；MCP stdout 仍只发送协议消息。默认使用随机端口，可加 `--web-port=固定端口`。默认 MCP 连接不启动 HTTP 服务，不修改打包清单或个人插件配置。

链接 fragment 中的随机令牌进入当前标签页 sessionStorage 后，从地址栏移除；刷新仍可使用，重新打开新标签页需完整链接。不要把该会话链接公开。服务只监听 127.0.0.1，校验 Host/Origin、Bearer 和 Fetch Metadata，不开放 CORS。静态资源白名单、CSP、报告所属任务与目录检查限制展示范围；不提供任意路径下载或任意命令接口。

## 最小流程

1. 输入已有 Fabric 1.21.4 工程绝对路径，打开工程并读取环境。脚手架没有 Wrapper，工作台不自动安装 JDK/Gradle。
2. 按需下载知识/基础模组。公开资源包仍为 Observer V1：按照完整产品包 README，用 observer/modcrafting-observer.jar 覆盖自己的 assets/base-mods/modcrafting-observer.jar；再次下载资源需重做。资源 present 与运行时 V2 bridgeReady 分别展示。
3. 执行 build 或合法的 Gradle 任务，查看最近 300 行日志、失败原因或停止状态。
4. 指定独立游戏目录启动 MC，在游戏内打开唯一专用世界 ModCrafting Test World。工作台不自动选择用户普通存档。选定实例后刷新结构化快照、辅助截图。
5. 编辑 V2 场景 JSON，确认专用世界后运行。现有 Core 再次验证世界/场景并执行 finally 清理；测试区域为 x/z −16～16、y 96～112。
6. 读取原始 PASS / FAIL / INCONCLUSIVE、cleanup 与 acceptance，查看报告并下载 JSON。示例是只读健康检查，不代表某个模组功能验收；截图不作为 PASS 证据。

关闭页面不会停止构建/游戏/测试；重新打开能看到同一 Core 的任务，也能通过原 19 个 MCP 工具继续。关闭 MCP 会话或退出 `--web-only` 服务会调用 Core.close，停止其拥有的任务；此生命周期与关闭标签页不同。任务清单仅存在于运行进程中，服务重启不恢复任务；已写入数据根的报告和游戏数据保留。

## 宿主调查与首发选择

2026-10-14 核对 [OpenAI 插件架构](https://developers.openai.com/plugins/concepts/plugins)、[可选 MCP UI](https://developers.openai.com/plugins/build/chatgpt-ui) 和 [MCP Apps 概览](https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html)：标准扩展使用 UI resource、宿主能力协商和 sandbox iframe；不支持 UI 时工具仍应独立可用。OpenAI 文档明确 ChatGPT 支持该标准，这些资料不能证明本机 Codex 当前会渲染此插件 UI。

本次选择浏览器：复用已安装 React 19 / ReactDOM / esbuild，以及旧 Renderer 的纯 SVG、错误恢复边界和配色/字体；复制必要展示片段到独立 view 包，运行时/构建均不导入 Desktop。前端通过固定薄 HTTP 操作适配连接 MCP 已有 runtime，增加只读 state 契约，不新增执行器或 MCP 工具。React 的 MIT 许可合并入 THIRD_PARTY_NOTICES。

MCP Apps 还需要扩展 SDK、UI 资源元数据、宿主桥与实际嵌入验收；当前没有实现，也没有改真实账户配置。Codex / Claude / Qoder 的 UI 兼容性留到 P4 逐个平台实测。游戏内 HUD 也尚未新增；Observer 旧辅助显示不属于本工作台。首发不同时建设三套界面。

本地结果与证据见 [P3 实施报告](./phase-03-visualization-report.md)。
