# ModCrafting：Qoder 国际版插件使用手册

适用环境：Windows x64、Qoder 国际版桌面端、Fabric 1.21.4。更新日期：2026-10-16。

## 1. 当前接入方式

**原生插件将两份 Skill、三个工作流命令和 MCP 后端统一打包**，从「扩展 → 插件 → 添加插件 → 上传 Plugin」导入 ZIP。原先单独配置的 MCP 连接器保留为兼容入口，安装插件后只启用其中一种后端来源。

| 部分 | 用途 |
| --- | --- |
| Qoder | 处理对话、规划、文件编辑和模型调用 |
| ModCrafting 插件 | 统一提供开发与游戏验证 Skill、inspect/build/test 命令及 MCP 后端 |
| 插件内 MCP 连接器 | 提供 Minecraft 数据查询、Fabric 工程、构建、游戏控制及测试工具 |
| 浏览器工作台 | 查看同一后端的任务、日志和报告，编辑配方、内容参数和 MC 界面 |
| Minecraft 客户端及 Observer V2 | 在实际游戏中观察和验证效果 |

插件安装时一起发现 Skill、命令和 MCP；仅配置独立 MCP 不会自动安装这些组件。浏览器工作台通过本机链接打开，当前没有 Qoder 聊天内嵌工作台。

### 插件安装与使用

1. 准备通过 `plugin:qoder` 生成的 `modcrafting-fabric-qoder.zip`，在 Qoder 国际版「扩展 → 插件 → 添加插件 → 上传 Plugin」导入。
2. 在插件「已安装」列表检查 ModCrafting Fabric、版本、启用状态及组件。两份 Skill 为 `fabric-mod-development` 和 `fabric-game-validation`；三个命令为 `inspect`、`build`、`test`。实际 `/` 菜单名称以 Qoder 展示的插件命名空间为准。
3. 原先已有独立 `modcrafting-fabric` 连接器时，备份配置，再禁用旧条目；保留其数据目录。机器专用 ZIP 可直接复用旧数据目录，不必重复下载资源。
4. 新建聊天，输入 `/` 选择插件提供的技能或命令。先使用 inspect 或第 3 节的只读请求，再执行构建和游戏测试。

插件由 Qoder 的插件页面统一启用、禁用和卸载。卸载与删除工程、资源缓存、报告及存档分开处理；回退时禁用插件并重新启用原独立连接器。

### 开发者生成插件 ZIP

复用已构建、含浏览器工作台的候选目录；输入版本应与需要交付的 Core/MCP 版本一致：

```powershell
pnpm run plugin:qoder -- --source "D:/ModCrafting/plugin"
```

生成结果位于 `temp/qoder-artifacts/modcrafting-*/`，包含原生插件目录、ZIP 和 SHA-256 清单。ZIP 根目录直接包含 `.qoder-plugin/plugin.json`，不夹带其他宿主清单、node_modules 或用户设置；Core bundle、两份 Skill、资源及许可证复用输入候选。

默认使用 `node` 与宿主展开的 `${QODER_PLUGIN_ROOT}` / `${QODER_PLUGIN_DATA}`。为本机生成配置包、复用 D 盘数据目录时：

```powershell
pnpm run plugin:qoder -- --source "D:/ModCrafting/plugin" --data-root "D:/ModCraftingData/qoder" --node "C:/Program Files/nodejs/node.exe"
```

带 `--data-root` 或 `--node` 的包为机器专用配置，不作为可移植包分享。生成器只创建新产物，不修改真实 Qoder 配置。桌面 ZIP 导入与 CLI 插件安装分别验证，依据 [Qoder 国际版插件文档](https://docs.qoder.com/zh/qoder/plugins)。

### 本次核对范围

原有本机用户级 `settings.json` 已配置独立 `modcrafting-fabric`，启动参数包含 `--web`，指向候选 `0.1.0+desktop.20261016.r4.7d3b2432`。原生插件复用该候选的 **22 个工具**，包含配方、内容参数和 MC 界面工具；适配版本为 `0.1.0+qoder.20261016.r4.7d3b2432`。

本次通过 Qoder 官方 CLI 1.1.71 的用户级安装命令完成本机安装，随后在真实国际版桌面 **Qoder 0.4.8** 中检查：插件已安装启用，三个命令标明「由 ModCrafting Fabric 提供」，两份 Skill 已发现，插件提供的连接器显示「可用」并展开 **22 个工具**。旧独立 MCP 条目已禁用，D 盘数据目录保留并由插件复用。ZIP 通过 Qoder 自带离线校验器；本轮未通过 ZIP 文件选择窗口完成安装，ZIP 导入与 CLI 安装的证据分别记录。

包内后端另经 SDK 实际调用环境检查、浏览器 API 和 GUI 模板，未下载资源或启动游戏。本轮未在 Qoder 模型聊天中重新调用工具；旧聊天也不会因此自动切换。请新建聊天按第 3 节开始。后端 bundle 保持原候选字节不变，因此其服务器版本仍是原 desktop 候选标识，插件清单版本使用 qoder 标识。

本手册的本机验收针对上述 R4 候选。仓库源码、打包输入和宿主实际运行版本需分别核对，不应使用旧 bundle 覆盖当前连接器包。

## 2. 使用前准备

- Qoder 已登录，所选模型可正常完成对话。
- 系统具备 Node.js 22.15+ 或 24，以及 JDK 21。`JAVA_HOME` 与当前 `PATH` 中的 Java 保持一致。
- 准备 Fabric 1.21.4 工程绝对路径。已有工程应自带 Gradle Wrapper；新建工程可交给脚手架工具。
- 安装目录、可写数据目录、模组工程目录分别存放。不同宿主同时运行时使用独立的数据目录和游戏目录。

模型由 Qoder 管理，无需为此连接器另填 ModCrafting 模型 API Key。资源准备会下载知识及基础模组，但不会安装 JDK；首次构建仍可能下载 Gradle 和工程依赖。

### 仅使用独立连接器的兼容方式

打开「扩展 → 连接器」，查看 `modcrafting-fabric` 的状态和工具列表。更新配置后重新加载连接器，并新建聊天；若仍保留旧连接，重启 Qoder 后再检查。

### 需要在另一台机器配置时

进入「扩展 → 连接器 → 添加连接器 → 添加自定义 MCP」，选择 stdio，或粘贴以下 JSON。路径为示例，必须替换为该机器上的实际绝对路径。

```json
{
  "mcpServers": {
    "modcrafting-fabric": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": [
        "D:/ModCrafting/plugin/dist/mcp-server.js",
        "--web"
      ],
      "env": {
        "MODCRAFTING_DATA": "D:/ModCraftingData/qoder"
      }
    }
  }
}
```

完整候选包应位于稳定目录，不能只复制一个 JS 文件。JDK 未被 Qoder 继承时，可在该连接器的 `env` 中补充真实 `JAVA_HOME`，并确保 Java 可从进程 `PATH` 找到。已有 Gradle 缓存可通过 `GRADLE_USER_HOME` 指定。

桌面连接器配置保存于 `~/.qoder/settings.json` 的 `mcpServers`。已有配置只合并这一项，保留其他连接器和设置。此处不使用 CLI 的 `.qoder-plugin` 安装流程。入口与配置格式依据 [Qoder 国际版连接器官方文档](https://docs.qoder.com/zh/qoder/connectors)。

## 3. 第一次使用：检查工程并打开工作台

在 Qoder 新聊天中，将路径替换后发送：

```text
使用 ModCrafting MCP 连接器检查 D:/MinecraftMods/my-mod。
依次调用 modcrafting_environment_status、fabric_project_inspect 和 fabric_validate，
再调用 minecraft_data_lookup，kind 为 item，query 为 iron_ingot。
报告 Java 版本、Gradle Wrapper、Minecraft 版本、模组 ID、标准物品 ID，
并给出 modcrafting_environment_status 返回的完整 browserUrl。
只检查，不改工程文件、不下载资源、不构建、不启动游戏。
如果任何工具失败，请报告实际错误，不要推测成功。
```

检查 Qoder 是否实际展示工具调用及返回结果。R4 应能发现 22 个工具；只显示 19/20/21 个时先核对连接器版本和会话。工具可见之后，还需确认上述调用实际成功。

点击返回的完整 `browserUrl`，在工作台输入相同的工程绝对路径并打开工程。后续可在 Qoder 发出任务，在浏览器查看同一后端的状态。

本机链接含会话令牌，不要公开分享。服务重启、连接器重连或链接失效时，重新调用环境工具获取链接。另行启动 `--web-only` 会创建独立后端，无法显示 Qoder 连接器进程拥有的任务，即使二者打开相同工程。

## 4. 常用开发流程

### 打开已有工程

先检查环境和工程，再描述要修改的功能、期望效果及验收方法。编写物品、方块、实体或附魔注册代码前，必须调用 `minecraft_data_lookup` 查询标准 ID 和原版属性；Fabric API 用法按需调用 `fabric_docs_search`。

```text
工程是 D:/MinecraftMods/my-mod。先用 ModCrafting 检查工程和相关原版数据，
为这个模组新增一个简单食物物品，ID 为 demo_food。
先列出需要确认的食物参数和验收方法，再执行已明确的修改。
沿用工程现有结构，只修改本需求相关文件。
完成后调用 fabric_validate，执行 build 并轮询到最终结果。
本次不启动游戏。
```

### 新建工程

```text
使用 ModCrafting 的 fabric_project_scaffold，
在 D:/MinecraftMods/hello-mod 新建 Fabric 1.21.4 工程。
modId 为 hello_mod，modName 为 Hello Mod。
目标目录应不存在或为空；若已有文件请停止并报告。
创建后检查工程并执行 fabric_validate，暂不构建和启动游戏。
```

### 准备资源

在需要知识资源或游戏测试资产时明确要求调用 `modcrafting_prepare_assets`，检查每项结果及落盘位置。查询无结果时，先确认资源是否已准备。

当前交付文档记录：公开 v1.0.1 基础资源包仍含旧 Observer V1。准备后检查本地实际版本；若仍是 V1，使用完整候选产品包中的 `observer/modcrafting-observer.jar` 替换自己数据目录下 `assets/base-mods/modcrafting-observer.jar`，不要同时保留两个相同模组 ID 的 JAR。再次下载基础资源后需重新检查。最终以游戏运行时返回的 `protocolVersion=2` 和 `bridgeReady=true` 为准。

### 构建与查看日志

```text
使用 ModCrafting 对 D:/MinecraftMods/my-mod 执行 build。
调用 fabric_build_start 后保留 jobId，持续调用 fabric_job_status，
直到任务结束。失败时给出关键错误、相关文件和最小修复建议。
不要把取得 jobId 当成构建成功。
```

构建失败时先定位日志中的首个有效错误。Java、依赖下载或网络问题应先修复环境，不据此改写模组功能。需要中止时请求 `fabric_job_stop`，再检查任务是否真正退出。

## 5. 浏览器中的三类创作工具

先打开工程，再使用对应编辑器。页面保存工程文件后，涉及 Java 的变更需要重新构建并重启游戏验证。

| 工具 | 用法与当前范围 |
| --- | --- |
| 配方工坊 | 选择或新建配方，搜索原版/工程物品，拖入材料与产物槽，调整数量，检查待写入 JSON 后保存。支持有序、无序、熔炉、高炉和切石机配方；不支持的形式只读。对应 `fabric_recipe_workspace`。 |
| 内容参数 | 创建或读取物品、食物、方块、实体、工具、护甲声明，编辑参数和纹理引用，预览生成文件后应用。对应 `fabric_content_workspace`。 |
| MC 界面创作 | 新建自定义 Screen、配置界面或 HUD；添加组件，拖动、调尺寸、设置锚点及样式，进行窗口/GUI 缩放预览和交互模拟，再预览并应用生成文件。对应 `fabric_gui_workspace`。 |

内容参数编辑器只处理受支持的声明；手写或被外部修改的生成 Java 会保持只读，由 Qoder 阅读后合并。自定义纹理需引用工程中实际存在的 PNG。当前实体外观和 AI 复用猪/僵尸等既定类型。

界面组件支持文字、面板、按钮、开关、整数滑块和展示槽位。按钮操作限关闭、恢复默认或递增指定滑块；HUD 使用非交互组件；展示槽位只展示物品，不提供容器交换或服务端同步。浏览器交互是模拟，实际快捷键、控件响应和配置持久化需到游戏验证。

Qoder 与浏览器可以编辑同一工程，但应避免同时保存同一文件。配方保存使用最近读取的 revision；内容和界面操作使用 read → preview → save，携带 `expectedRevision` 和 `previewRevision`。遇到冲突先保留草稿、重新读取并比较，不强行覆盖。

可在 Qoder 中这样请求：

```text
使用 fabric_gui_workspace，为 D:/MinecraftMods/my-mod 创建一个配置界面。
包含标题、开关、范围 0 到 10 且默认 4 的整数滑块、恢复默认按钮。
先读取当前工程与布局，再预览生成文件，报告快捷键和文件变更。
确认没有冲突后保存；完成后构建，游戏验证另行执行。
```

## 6. 启动游戏并验证

1. 完成构建，确认资源与 Observer V2 已准备。
2. 使用 `minecraft_run_client`，指定独立 `gameDirectory`，例如 `D:/MinecraftRuns/my-mod-test`。
3. 轮询 `minecraft_runtime_status`，确认桥接就绪且 `protocolVersion=2`。
4. 在游戏内进入专用世界 **ModCrafting Test World**。自动场景只在此世界运行；预留测试区域为 x/z `[-16,16]`、y `[96,112]`。
5. 用 `minecraft_snapshot` 确认实际状态。按功能编写包含 `setup/actions/assertions/cleanup` 的 V2 场景，再调用 `minecraft_test_start`。
6. 通过 `minecraft_test_status` 等待结束，读取 verdict、acceptance、code、cleanup 和 reportPath。保留 JSON 报告。
7. 完成后调用 `minecraft_stop_client`，并确认任务退出。

```text
使用 ModCrafting 验证 D:/MinecraftMods/my-mod 的已完成改动。
使用独立游戏目录 D:/MinecraftRuns/my-mod-test。
先检查构建、资源和 Observer V2，再启动客户端并等桥接就绪。
提示我进入 ModCrafting Test World；确认世界后再执行自动测试。
根据实际功能设计动作后的结构化断言，执行清理并提供原始报告路径。
证据不足时报告 INCONCLUSIVE，不用截图或命令发送成功代替功能通过。
```

| 结果 | 含义 |
| --- | --- |
| PASS | 对应断言有有效证据且满足验收要求，还应检查清理结果 |
| FAIL | 获得有效证据，但实际行为不符合预期 |
| INCONCLUSIVE | 环境未就绪、证据缺失或断言能力不支持，无法裁决 |

当前 HUD 自动断言仍有能力限制，可能返回 `CAPABILITY_UNAVAILABLE`。原生绘制观察和截图可辅助检查，不能据此改报自动测试 PASS。构建通过、游戏启动和功能通过分别报告。

## 7. 工具速查（R4：22 个）

| 用途 | 工具名 |
| --- | --- |
| 环境与资源 | `modcrafting_environment_status`、`modcrafting_prepare_assets` |
| 数据与文档 | `minecraft_data_lookup`、`fabric_docs_search`、`mc_wiki_search` |
| 工程 | `fabric_project_inspect`、`fabric_project_scaffold`、`fabric_validate` |
| 构建与任务 | `fabric_build_start`、`fabric_job_status`、`fabric_job_stop` |
| 游戏生命周期 | `minecraft_run_client`、`minecraft_runtime_status`、`minecraft_stop_client` |
| 游戏观察与控制 | `minecraft_snapshot`、`minecraft_command`、`minecraft_input` |
| 游戏测试 | `minecraft_test_start`、`minecraft_test_status` |
| 可视化创作 | `fabric_recipe_workspace`、`fabric_content_workspace`、`fabric_gui_workspace` |

## 8. 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 插件列表里没有 ModCrafting | 确认已经通过插件页面上传 ZIP；只配置独立 MCP 不会安装插件。检查导入错误和插件「已安装」列表。 |
| 有连接器但没有新版工具 | 核对脚本绝对路径与候选版本，重新加载连接器并新建聊天；必要时重启 Qoder。 |
| 有工具列表但对话调用失败 | 检查 Qoder 登录、模型权限及工具实际错误；工具发现成功不等于调用成功。 |
| 没有 browserUrl | 检查启动参数是否包含 `--web`，重连后再次调用环境工具。 |
| 链接失效或页面鉴权失败 | 从当前连接器重新获取完整 browserUrl，不复用另一个后端的地址。 |
| 页面看不到 Qoder 创建的任务 | 使用该聊天的环境工具返回的链接；独立启动器可能连接另一个后端。 |
| 数据查询无结果 | 检查知识资源准备结果；当前 Wiki/Fabric 文档搜索是关键词检索。 |
| Java 或 Wrapper 报错 | 检查系统 JDK 21、JAVA_HOME/PATH 和工程 Wrapper；连接器不安装系统工具链。 |
| 游戏已打开但 bridgeReady 为 false | 检查运行日志、独立游戏目录及 Observer 版本；资源文件存在不代表桥接已就绪。 |
| 保存时发生冲突或文件只读 | 保留草稿，重新读取并比较；让 Qoder 合并受保护的手写/外改文件。 |
| 工具调用超时 | 先查任务和文件实际状态，再决定重试；超时不代表操作已取消或回滚。 |
| 关闭页面后游戏仍运行 | 页面关闭不会停止任务；使用停止工具并确认退出。 |

升级连接器前先停止它拥有的任务，保留数据目录与原配置，替换为完整的新版本包后重连。关闭 Qoder 或后端退出会停止其拥有的任务；任务清单不跨后端重启恢复，已落盘报告和游戏数据保留。禁用连接器与删除工程、报告或存档分别处理。

## 9. 依据与验证边界

- Qoder 桌面入口及配置格式：[国际版连接器官方文档](https://docs.qoder.com/zh/qoder/connectors)，本次已在线核对。
- 工具名称及数量：本机配置所指 R4 候选 bundle 的工具注册清单，本次已核对。
- 创作流程及游戏能力范围：同项目 `ModCrafting-mcp-p1` 工作区的 MCP 实现、浏览器实现及 R4 交付记录。
- 本轮已完成原生插件安装、桌面组件/22 工具连接检查及独立 SDK 调用；没有重新执行 Qoder 模型聊天、构建或游戏验收。历史实机记录不替代当前工程验收。
- 安装方式、验证证据和回退记录见仓库文档 `docs/archive/2026-10-16-qoder-native-plugin.md`；该验收记录不作为插件运行依赖。
