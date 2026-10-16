# P3 可选浏览器工作台

2026-10-16 范围说明：已新增首轮配方工坊与 R3 六类内容参数，R4 基础 Screen/配置页面/HUD 创作也已补齐，不能视为完整替代。继续按[创作工作台需求](../specs/creator-workbench/requirements.md)补齐；本文保留已有功能和验收边界。

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

1. 输入已有 Fabric 1.21.4 工程绝对路径，打开工程并读取环境。现有 MCP 脚手架带固定版本的 Windows Wrapper；既有工程需自行提供 Wrapper，工作台不自动安装 JDK/Gradle。
2. 按需下载知识/基础模组。公开资源包仍为 Observer V1：按照完整产品包 README，用 observer/modcrafting-observer.jar 覆盖自己的 assets/base-mods/modcrafting-observer.jar；再次下载资源需重做。资源 present 与运行时 V2 bridgeReady 分别展示。
3. 执行 build 或合法的 Gradle 任务，查看最近 300 行日志、失败原因或停止状态。
4. 指定独立游戏目录启动 MC，在游戏内打开唯一专用世界 ModCrafting Test World。工作台不自动选择用户普通存档。选定实例后刷新结构化快照、辅助截图。
5. 编辑 V2 场景 JSON，确认专用世界后运行。现有 Core 再次验证世界/场景并执行 finally 清理；测试区域为 x/z −16～16、y 96～112。
6. 读取原始 PASS / FAIL / INCONCLUSIVE、cleanup 与 acceptance，查看报告并下载 JSON。示例是只读健康检查，不代表某个模组功能验收；截图不作为 PASS 证据。

关闭页面不会停止构建/游戏/测试；重新打开能看到同一 Core 的任务，也能通过 22 个 MCP 工具继续。关闭 MCP 会话或退出 `--web-only` 服务会调用 Core.close，停止其拥有的任务；此生命周期与关闭标签页不同。任务清单仅存在于运行进程中，服务重启不恢复任务；已写入数据根的报告和游戏数据保留。

## 配方工坊

打开工程后选择或新建配方，搜索原版/工程物品并拖入槽位，调整材料和产物数量，预览原文件与待写入 JSON 后确认保存。支持有序、无序、熔炉、高炉、切石机；其他类型或不支持的材料形式只读。Agent 使用 `fabric_recipe_workspace` 的 catalog/list/read/save 操作访问同一文件；更新时必须提供 read 返回的 revision，外部修改后拒绝覆盖并保留草稿。

材料库、材料槽及产物槽显示原版/工程静态贴图；工程物品目录来自 items/models/item 资源，不证明物品已注册，标签成员和配方匹配仍需游戏确认。保存不会自动改变运行中的游戏，需重新构建/启动或显式重新加载后验证。与原版输入相同的配方可能匹配原版产物，应在游戏检查实际产物。

## 宿主调查与首发选择

2026-10-14 核对 [OpenAI 插件架构](https://developers.openai.com/plugins/concepts/plugins)、[可选 MCP UI](https://developers.openai.com/plugins/build/chatgpt-ui) 和 [MCP Apps 概览](https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html)：标准扩展使用 UI resource、宿主能力协商和 sandbox iframe；不支持 UI 时工具仍应独立可用。OpenAI 文档明确 ChatGPT 支持该标准，这些资料不能证明本机 Codex 当前会渲染此插件 UI。

本次选择浏览器：复用已安装 React 19 / ReactDOM / esbuild，以及旧 Renderer 的纯 SVG、错误恢复边界和配色/字体；复制必要展示片段到独立 view 包，运行时/构建均不导入 Desktop。前端通过固定薄 HTTP 操作适配连接 MCP 已有 runtime，增加只读 state 契约，不新增执行器；首轮配方复用同一 Core，并新增 fabric_recipe_workspace 工具。React 的 MIT 许可合并入 THIRD_PARTY_NOTICES。

MCP Apps 还需要扩展 SDK、UI 资源元数据、宿主桥与实际嵌入验收；当前没有实现，也没有改真实账户配置。Codex / Claude / Qoder 的 UI 兼容性留到 P4 逐个平台实测。R4 已新增用户模组的原生 HUD 生成与游戏验证；它不等于工作台本身的游戏内操作面板，Observer 旧辅助显示也不属于本工作台。

本地结果与证据见 [P3 实施报告](./phase-03-visualization-report.md)。


## 内容创作 R3

打开工程后在“内容创作”选择或新建物品/食物/方块/生物/工具/护甲。每类显示适用字段及单位范围；耐久物品仅单件堆叠，剑隐藏挖掘速度，护甲按单部位编辑。名称与纹理关联一起保存。已有工程 PNG 可预览；原版纹理首次从本机 Gradle Loom 或原版启动器的 1.21.4 客户端 JAR 自动准备到私有 assets/minecraft-textures/1.21.4 缓存；版本检查后只读取 PNG/模型 JSON，不主动下载，不依赖旧 Desktop public 目录。缺客户端时显示诊断与重试，仍可编辑工程。实体显示纹理展开图，并非 3D；目前复用猪/僵尸原版外观与 AI。

先“预览参数变更”检查文件，再“确认应用到工程”。Core 与 fabric_content_workspace 共用 list/read/preview/save；expectedRevision 绑定对象及共享入口/语言/构建文件，previewRevision 绑定待应用内容。冲突保留草稿；未知或外部修改的 Java 只读并交给 Agent，不用默认参数反写。保存前备份、文件碰撞拒绝、异常仅回滚本次仍匹配的写入。重新构建/启动后验证实际属性，保存成功不代表运行中的游戏已更新。

六类九个样例完成真实浏览器修改和 Agent 读回；真实游戏 9 PASS、3 个预期 FAIL，另补验 speed 效果及服务端工具/护甲属性。Observer capabilityRevision 5 为新增观察字段的前提，旧远端 JAR 不具备。完整边界见[归档](./archive/2026-10-16-content-parameter-workbench.md)。

## MC 界面创作 R4

打开工程后选择“MC 界面创作”，读取或新建 Screen、配置页面、HUD。六类组件为文字、面板、按钮、开关、整数滑块和展示槽位；HUD 只开放文字、面板和展示槽位。画布支持拖动、右下角调整尺寸、8px 网格/4px 对齐、样式与绑定属性。交互/窗口预览可以试用控件，并选择窗口比例与 GUI 缩放；玩家属性为示例值，网页模拟不写游戏配置。

标签绑定本布局开关/滑块或玩家生命/饥饿。按钮行为限关闭、恢复本布局默认值、递增指定滑块。展示槽位使用真实物品贴图，但不交换物品或同步服务端容器。标签/面板可调颜色、透明度和阴影，交互控件沿用原生皮肤；暂不支持文本输入、循环选项、任意 HTML/脚本/命令。

先预览文件，再确认应用；fabric_gui_workspace 的 template/list/read/preview/save 与 Web 共用 Core。声明保存在工程 .modcrafting/gui，生成独立客户端入口和布局资源，保留其他入口/语言项；版本冲突保留草稿，外改 Java 只读。重新构建并重启游戏后按配置快捷键打开 Screen，以 Esc/关闭按钮返回；HUD 快捷键控制显隐。运行状态写入该游戏目录 config 下按布局隔离的 JSON，与工程默认值分开。

真实浏览器完成拖动/缩放、预览/保存、Agent 同值读回、刷新和冲突保护。游戏完成原生控件、两种窗口/GUI 比例及配置重启保留；HUD 用新鲜原生绘制与显隐记录另验，现有自动 HUD 断言仍为 INCONCLUSIVE。最终原生截图、候选及完整证据见[界面归档](./archive/2026-10-16-mc-gui-workbench.md)。


## 贴图读取修复（2026-10-16）

浏览器的内容预览和配方图块共用认证后的 visuals 操作，按当前可见物品批量读取。通过 1.21.4 items 定义、模型父级与纹理变量解析，优先工程资源，再读取原版缓存；新建内容和修改纹理无需先保存即可显示。PNG 解码失败保留明确文字标识，不显示破图；查询失败可重新读取，不替换配方草稿。原版指南针/时钟选择代表帧，方块显示纹理面，不承诺完整 3D 或游戏中的动态效果。

本次实际工程目录 1392 项有 1370 项可解析静态图；6 类头颅和 16 色旗帜需要特殊渲染，当前仍保留文字。标签材料不是具体物品，不伪造代表图。首屏 60/60 图像解码、拖放后的材料/产物、数量角标、工程自定义 PNG 和窄屏已验证。安装候选与证据见[贴图归档](./archive/2026-10-16-browser-minecraft-textures.md)。
