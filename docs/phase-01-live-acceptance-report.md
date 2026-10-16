# P1 真实宿主、构建与游戏验收

初始日期：2026-10-13；桌面重启后界面补验：2026-10-14。用户已确认继续执行 Codex 加载、隔离 Fabric 构建和专用测试世界验收。未开始 P2，未提交、推送或发布。

## 结果

| 路径 | 实际证据 |
|---|---|
| Codex 加载 | 桌面端随附 Codex 0.162.0-alpha.17.2 的真实 App Server；plugin/list 确认安装/启用，skills/list 发现两个带插件命名空间的 Skill，MCP 连接后发现 19 个真实工具 |
| 工具调用 | 通过 App Server 的 mcpServer/tool/call 实际调用环境检查、scaffold、inspect、validate、Minecraft 数据查询、构建、轮询和游戏控制；没有发起模型 turn 或使用模型 API |
| 真实构建 | 系统 Oracle JDK 21.0.3 + Gradle Wrapper 9.5.0；编译 Java ModInitializer，processResources 展开版本，生成 p1_acceptance-0.1.0.jar，构建任务 completed / exitCode=0 |
| 真实运行 | Fabric 1.21.4、Loader 0.16.10、Fabric API 0.116.0+1.21.4、Observer V2；游戏日志确认 p1_acceptance 0.1.0 及 P1_ACCEPTANCE_MOD_LOADED，桥实际就绪 |
| PASS | 清空已有石头 → 给予 1 个石头 → inventory_contains(countAtLeast=1)；实际库存匹配、前后请求标识不同，清理 completed=1 |
| FAIL | 相同真实动作，要求 countAtLeast=2；实际仅 1 个，返回 FAIL / ASSERTION_FAILED，清理成功 |
| 清理失败 | 支持型库存断言实际匹配，cleanup 使用明确无效命令；返回 INCONCLUSIVE / CLEANUP_FAILED，随后以独立受控命令清除测试石头 |
| 退出 | minecraft_stop_client 返回成功；结束本次宿主后，限定本次 scope 的 java/node 进程检查无残留 |

场景都在新建的 **ModCrafting Test World**，隔离 gameDir 仅含本次创建/复制的测试存档。坐标操作限制在预留区域：石头平台 y=99，清理空间 y=100–112，玩家位于 (0,101,0)。没有打开或修改日常存档。截图仅作运行观察，PASS 依据仍为 Observer 的结构化库存与快照。

## 定位与最小修复

真实 Codex 加载发现，旧 .mcp.json 的 `${PLUGIN_ROOT}/dist/mcp-server.js` 不能在该宿主展开，导致 MCP initialize 连接关闭。SDK Smoke 原先自行替换占位符，因此没有发现宿主层问题。参考 [Codex 上游 #35762](https://github.com/openai/codex/issues/35762) 及其相对 cwd 行为，将配置改为：

```json
{ "command": "node", "args": ["./dist/mcp-server.js"], "cwd": ".", "env": {} }
```

修改仅涉及插件 .mcp.json、对应 validator 和 Smoke 的入口解析；工具名、清单格式、安装版本与 Core/Observer 业务代码保持原样。真实宿主从 failed 变为 connected，调用成功。没有修改 Codex 二进制或重写协议库。

构建首次使用预备 Temurin JDK 21.0.11 时，Java File.mkdirs / Files.createDirectories 在隔离目录返回 AccessDeniedException；同路径的系统 Oracle JDK 21.0.3 可以创建目录。改用已安装系统 JDK 后真实构建成功；未修改系统安全策略。该现象不应误报为插件或 pnpm 错误。

实机测试首次将 clear 用于空库存，Minecraft 返回命令失败，原实现保守地拒绝 PASS。修正夹具初始库存，确保 clear 前已有匹配物品后通过；没有削弱断言、吞掉清理错误或改 Observer。世界选择使用实际观察到的按钮文字及列表几何位置，没有把固定中文文案假设当成界面事实。

## 资产与隔离

- 使用预备的 Gradle 9.5 分发 ZIP、Minecraft/Fabric 依赖和知识索引；从原工作区资源只读导入测试缓存，没有共享或修改原 node_modules。
- Gradle 缓存复制到新工作区 temp/p1-live-acceptance/assets/gradle-home，跳过锁文件；Wrapper 指向已有 ZIP，任务采用 offline。原 Gradle 缓存与资源目录未写入。
- 测试部署仅在专有插件副本中声明系统 JAVA_HOME、测试 GRADLE_USER_HOME / MODCRAFTING_DATA / TEMP；正式 Stage 清单仍不包含本机路径或私有环境覆盖。
- Codex 使用专用 CODEX_HOME，真实宿主 thread 为 ephemeral；未操作正在使用的桌面聊天或账户配置。Observer 认证仅在本次客户端内部使用，不进入验收摘要、公开日志或模型调用参数。

## 复核与可交付证据

修复后 plugin:validate、plugin:smoke（Node 22.23.3 / 24.19.0）、plugin:test（39/39）和 diff --check 均通过。配置/脚本范围变化未触及 Core、Renderer、原生依赖；未无故重复全仓测试。此前全仓 23 条类型错误、21 个旧 Harness 失败仍按既存问题记录。

汇总：`temp/p1-live-acceptance/acceptance-summary.json`。构建证据：`run-oBj8Xi/build-result.json` 与其 `project/build/libs/p1_acceptance-0.1.0.jar`。JAR SHA-256 为 `84e5fd55568b89913878632028151c00f2c6fcf48de7db13a4ecd80be5634682`。

最终实机证据：`temp/p1-live-acceptance/run-Dya6VI/` 的 skills.json、servers.json、summary.json、world-observation.json、test-pass.json、test-fail.json、test-cleanup_failed.json，以及 plugin-data/reports 中的原报告。截图位于该目录的 `game/modcrafting-shots/shot-20261013-091825-952.png`，已人工查看，确认为测试区域内真实游戏画面。此前失败与修正后的试验目录全部保留，不入库、不上传。

原 main HEAD 仍为 b40e1fa522cf87280b72ace2480417e051b908fa，9 个原未跟踪文件列表及 SHA-256 保持不变。

## 仍未验证

- 远端 GitHub Actions、Setup/Portable 安装流程、知识/基础模组首次在线下载；本次使用已准备的资源。
- 任意工程离线构建、全部断言/18 类完整验收、跨 Agent 适配。测试工程明确自行提供了 Wrapper、资源版本展开、一个最小初始化类与缓存；游戏断言仅验证 Vanilla 石头库存链路，不是自定义方块/物品功能验收。

P2 如需开始，应另行明确范围；本轮不自动进入。

## 补充：持久安装与当前桌面聊天调用

2026-10-13，用户在“补齐桌面安装和持久启用验收”的建议后确认继续。复用 [OpenAI Docs 本地 marketplace / CLI 安装说明](https://developers.openai.com/plugins/build/plugins)，通过桌面随附的 Codex 0.162.0-alpha.17.2 官方 CLI 安装，没有手工读取或编辑账户、凭据或完整 config.toml。

- 原 `modcrafting-fabric@modcrafting-local` 指向原 main，已安装但禁用；保持其安装、启用和来源元数据不变。
- 将已经验证的独立 Stage 复制到 `$CODEX_HOME/plugins/local-marketplaces/modcrafting-p1/plugins/modcrafting-fabric`，创建仅含本插件的新 marketplace。正式包仍使用相对入口、空 env，无个人路径；副本验证白名单通过。
- 执行 `codex plugin marketplace add <新 marketplace 根目录> --json`，然后 `codex plugin add modcrafting-fabric@modcrafting-p1 --json`。官方列表确认新插件 installed=true / enabled=true；没有替换旧 marketplace 或直接引用原 main。
- 使用实际 CODEX_HOME 连续启动两个独立 App Server，分别检查技能和 MCP 清单，并调用 `modcrafting_environment_status`。每次均发现两个启用的 Skill、19 个工具并返回有效诊断；验证后这两个验收后端均正常退出。第二次独立启动证明配置能够持久加载。
- 当前正在进行的桌面聊天随后实际发现 `mcp__modcrafting_fabric` 工具集，通过宿主提供的 MCP 工具直接调用环境诊断成功：Windows、Node 24.19.0、Java 21.0.3、Minecraft 1.21.4。没有提供工程路径，返回 gradleWrapper=false 不代表任何具体工程验证失败；这条调用仅证明当前聊天中的插件连接。

2026-10-13 的桌面读屏最初全黑；改用 Windows 原生 PrintWindow 后能够获取应用窗口图像，但前台进程实际为 LockApp（Windows 默认锁屏界面），不能将 Codex 切换到前台，点击没有改变页面。确认后停止界面操作，不尝试解锁或绕过锁屏。因此**该次未完成界面按钮安装、界面持久启用观察或完整桌面应用重启**；次日观察结果见下节。实际账户的插件安装配置由官方 CLI 写入，是获授权的安装动作；此前隔离实机验收没有操作实际账户配置的记录仍成立。

证据位于 `temp/p1-desktop-acceptance/`：installed.json、plugin-list-after.json、old-plugin-before.json、plugin-host-1.json / plugin-host-2.json、persistent-1.json / persistent-2.json、desktop-tool-call.json 和 verification-summary.json。窗口截图仅留在该私有临时目录，不发布、不作为安装成功证明。没有发起模型 turn、下载知识/游戏资源、再次启动游戏、提交、推送或进入 P2；当前聊天持有的正常插件服务保留运行。

## 补充：2026-10-14 完整桌面重启后的界面观察

用户确认继续后，桌面已解锁。原桌面进程不再运行，新 ChatGPT/Codex 桌面进程于当天启动；保存实际进程启动时间与 PID，证明本次观察来自安装之后重新启动的桌面应用，而非仅重启测试 App Server。本次没有再次结束正在使用的桌面进程。

复用 Windows 原生 PrintWindow 读屏、按实际界面导航和滚动，仅查看插件相关页面：

- 设置的市场页显示 **ModCrafting P1 Local** 及新 marketplace 路径，原 **ModCrafting Local** 来源同时保留。
- 插件设置页明确显示带 `modcrafting-p1` 标签的 ModCrafting Fabric 开关为蓝色开启；带 `modcrafting-local` 标签的旧插件为灰色关闭。官方 CLI 的对应来源列表再次确认 installed/enabled 状态，旧插件配置与此前记录一致。
- 新插件详情页显示一个 `Modcrafting-fabric` MCP 服务，以及 Fabric Game Validation / Fabric Mod Development 两个技能；两个技能开关均开启。
- 当前桌面聊天实际提供 19 个 `mcp__modcrafting_fabric` 工具；直接调用 `modcrafting_environment_status({})` 成功，返回 Windows、Node 24.19.0、Java 21.0.3 和目标 MC 1.21.4。

上述是**CLI 安装后的界面确认与完整桌面重启后持久性验收通过**；首次界面安装按钮未执行，不能声称该路径通过。没有点击卸载、升级、插件/技能开关、清除数据或试用发送按钮，没有发送新的模型请求，也没有重新运行游戏或未变化的回归测试。

证据位于 `temp/p1-desktop-acceptance-20261014/`：desktop-process.json、plugin-p1.json、plugin-old.json、desktop-tool-call.json、verification-summary.json；marketplaces.png、plugin-menu.png、mcp-settings.png 与 p1-toggle-after-restart.png 为实际窗口截图。截图保留在私有临时目录，不入库、不上传。

## 补充：2026-10-14 首次界面安装路径

用户再次确认继续后，按 [OpenAI Docs 本地 marketplace / 桌面目录安装说明](https://developers.openai.com/plugins/build/plugins) 准备独立 `modcrafting-p1-ui-acceptance` 来源，显示名为 **ModCrafting P1 UI Acceptance**。复制的是已有白名单 Stage，没有修改包清单、版本、MCP 配置或源码；官方 CLI 仅登记 marketplace，没有调用 plugin add。安装前该来源的 installed 列表为空，现有 P1 来源启用、旧 main 来源禁用。

真实桌面个人插件目录显示新来源下的待安装插件；打开详情后出现 **安装插件** 按钮，实际点击后经历“正在安装”，完成时出现“插件已安装”提示并变为“立即试用”。两个 Skill 开关开启，详情显示一个 MCP 服务；官方 CLI 列表确认该新来源 installed=true / enabled=true。新生成的安装缓存通过白名单校验，9 个文件与**点击安装时的 Stage** 逐字节一致。

随后只通过设置界面的对应来源开关禁用验收副本，最终 installed=true / enabled=false，副本、缓存、目录和截图均保留。`modcrafting-p1` 与 `modcrafting-local` 的安装、启用和来源元数据均与操作前相同；现有 P1 插件继续启用并实际调用环境诊断成功。没有卸载原插件、删除用户文件、点击“立即试用”发送模型请求、再次启动游戏、提交或推送。首次 UI 安装验收已补齐，不用已安装观察或 CLI 安装替代该记录。

证据位于 `temp/p1-ui-install-acceptance-20261014/`：ui-before.json、before-install.png、install-click.png、installed-ui.png、ui-after-install.json、cache-hashes.json、acceptance-enabled.png、ui-after-disable.json、final-plugin-states.png、verification-summary.json；p1-before/after.json 与 old-before/after.json 记录原配置未变。Stage README 随验收结果更新后重新生成交付目录；安装时的缓存与哈希证据保持原样。
