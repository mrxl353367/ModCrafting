# 真实 Codex App / Qoder 桌面接入

ModCrafting 通过宿主 Agent 的 22 个 MCP 工具和两份 Skill 使用。可视化是本机浏览器工作台，当前没有聊天内嵌 MCP Apps。安装成功、工具连接、真实对话调用和页面展示需要分别确认。

2026-10-15 本机结果：Qoder 桌面 0.4.7 已在真实登录对话中完成三项只读 MCP 调用，并在 Chrome 打开同一后端的工作台。Codex 真实配置下 App Server 已加载新版两份 Skill、19 工具并成功调用环境检查；App 当前旧会话尚需重启后新建会话。证据边界与回退见[接入记录](./archive/2026-10-15-real-desktop-host-integration.md)。

配方补充交付：当前本地候选已包含 fabric_recipe_workspace，共 20 工具。Codex 真实配置的原生 App Server 已实际调用新版配方读回；Qoder settings.json 和两份 Skill 已备份更新，**新版真实聊天调用尚未复验**。上述 19 工具结果属于此前版本。两端当前旧会话不自动换连接，重新加载/新建后获取 browserUrl。配方与限制见[配方归档](./archive/2026-10-15-recipe-creator-workbench.md)。

R3 补充交付（2026-10-16）：本地候选 `0.1.0+desktop.20261016.r3.e73b8302` 新增 fabric_content_workspace，共 21 工具。真实 Codex App Server 发现两份 Skill，并实际读回支持编辑的护甲参数与纹理，模型调用为 0；不能等同当前聊天已重连。Qoder settings.json/两份 Skill 已备份更新，R3 新版真实聊天待复验，CLI 登录验收保留。独立内容工作台、实机报告与边界见[内容归档](./archive/2026-10-16-content-parameter-workbench.md)。历史 19/20 工具结果保留。

贴图修复候选（2026-10-16）：`0.1.0+desktop.20261016.textures.e4c36b5b`，仍为 21 个工具。既有两份启动器已指向新版页面；无需覆盖工程或清除浏览器数据。首次按客户端版本准备本地纹理/模型，缺客户端给出可重试诊断。旧会话继续使用旧进程时，请重新运行启动器或在新宿主会话取得 browserUrl。Codex 原生配置复验通过；不将此结果解释成 Qoder 新版聊天已验收。

## 配置入口

R4 补充交付（2026-10-16）：本地候选 `0.1.0+desktop.20261016.r4.7d3b2432` 新增 fabric_gui_workspace，共 22 工具。真实 Codex App Server 0.163.0-alpha.10.2 加载两份 Skill，并实际读回可编辑布局、标题和滑块默认值，另读取 HUD 模板，模型调用为 0。独立“MC 界面工坊”入口、三布局样例及游戏证据已交付。Qoder 配置/两份 Skill 更新，R4 新版真实聊天调用及 CLI 登录项继续保留；当前聊天不自动重连。见[界面归档](./archive/2026-10-16-mc-gui-workbench.md)。

- Codex App：使用 App 当前 `CODEX_HOME`，通过本地 marketplace 安装 `product/plugin`。只启用一个 ModCrafting 版本，保留旧插件用于回退。安装后重启 App 并新建会话，已有会话可能仍持有旧连接。
- 新 Qoder 桌面：在“扩展 → 连接器”添加自定义 MCP；配置位于 `~/.qoder/settings.json` 的 `mcpServers`。在“已安装”中确认 `modcrafting-fabric` 可用并检查工具列表；R4 新版应为 22 个工具。两份 Skill 可从交付包 `plugin/skills/` 导入“扩展 → 技能”。
- 旧 Qoder IDE 与 Qoder CN：属于不同产品或配置，需单独核对。不要用旧 IDE 的 `~/.qoder/mcp.json` 或隔离 CLI 的安装结果代替新桌面验收。

先把完整候选包复制到稳定目录，备份真实宿主配置，再合并对应服务器条目，保留其他连接器和设置。每个宿主使用独立、位于安装目录外的 `MODCRAFTING_DATA`；Node 和 MCP 脚本使用绝对路径，系统准备 JDK 21。不要直接覆盖正在运行的插件缓存，也不要让同一版本号对应不同 bundle。

复用交付包 `distribution/host-config.mjs` 生成配置，增加 `--web`，使浏览器和 Agent 使用同一后端。例如从候选包根目录运行：

```powershell
node ./distribution/host-config.mjs --host codex --plugin-dir "D:/ModCrafting/plugin" --data-root "D:/ModCraftingData/codex" --node "C:/Program Files/nodejs/node.exe" --web --output "D:/ModCrafting/codex-config.toml"
node ./distribution/host-config.mjs --host qoder --plugin-dir "D:/ModCrafting/plugin" --data-root "D:/ModCraftingData/qoder" --node "C:/Program Files/nodejs/node.exe" --web --output "D:/ModCrafting/qoder-config.json"
```

生成器只创建新文件，不安装或覆盖真实配置。Codex 原生插件的 `.mcp.json` 需使用同样的绝对路径和 `--web`；独立 TOML MCP 方式本身不安装 Skill，避免与插件 MCP 重复启用。需要显式指定 JDK 或既有 Gradle 缓存时，在服务器 `env` 中传入 `JAVA_HOME` / `GRADLE_USER_HOME`。

## 第一次使用

在新会话中发送以下只读请求，并附上自己的 Fabric 1.21.4 工程绝对路径：

> 使用 ModCrafting，依次调用 modcrafting_environment_status 和 fabric_project_inspect 检查此工程，再用 minecraft_data_lookup 查询 iron_ingot。报告 JDK、Wrapper、模组 ID 和标准物品 ID，并给出 environment 返回的完整 browserUrl。只读检查，不改文件、不构建、不启动游戏、不执行 Git 操作。

点击完整 `browserUrl`，在页面输入同一个工程路径并点击“打开工程”。该后端的构建、游戏和测试任务才会出现在工作台；单独启动 `--web-only` 不会显示另一个 MCP 进程的任务。

链接含本机会话令牌，不写入公开文档。页面关闭不终止任务；宿主关闭、后端重启或新会话启动另一个后端后，应重新调用环境工具获取对应链接。只读验收后，再明确要求构建或游戏测试；游戏测试需独立目录和专用测试世界。

官方依据：[OpenAI 插件与新会话](https://learn.chatgpt.com/docs/plugins)、[OpenAI MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Qoder 桌面连接器](https://docs.qoder.com/zh/qoder/connectors)、[Qoder 桌面技能](https://docs.qoder.com/zh/qoder/skills)。
