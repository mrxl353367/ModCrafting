# ModCrafting Fabric MCP

面向 Fabric 1.21.4 的独立 Node MCP 插件，提供 22 个工具、两份 Skill 和可选浏览器创作工作台。外部 Agent 负责对话、规划与代码编辑，Core 提供工程、知识、构建和游戏验收；运行无需 Electron，不包含 Agent Loop。旧 Desktop 保留兼容源码与原数据。

开发者在新工作区执行 `pnpm run plugin:build`、`pnpm run plugin:validate`、`pnpm run plugin:stage`。Stage 位于 `temp/plugin-artifacts/modcrafting-fabric/`，可整体复制；用户无需 pnpm 或仓库源码。

交付目录包含 `.codex-plugin/plugin.json`、`.mcp.json`、`dist/mcp-server.js`、`skills/`、`assets/modcrafting.png`、本文、`LICENSE` 与 `THIRD_PARTY_NOTICES.txt`。GPL-3.0 原文来自 https://www.gnu.org/licenses/gpl-3.0.txt；依赖许可由构建输入对应的包提取，已有法律注释保留在 bundle 尾部。源码及重建方式见 https://github.com/newstarbar/ModCrafting，未发布的本地 Stage 不应当作正式发行版；正式分发需同时提供与产物匹配的源码。

需要 Windows x64 和 Node 22.15+ 或 24。执行 Gradle/运行游戏需要 PATH 上的 JDK 21 与项目 Gradle Wrapper。初始化不下载资源。默认持久数据目录为 `%LOCALAPPDATA%\ModCrafting\fabric-plugin`；可设置绝对可写目录 `MODCRAFTING_DATA`，兼容旧 `PLUGIN_DATA` / `CODEX_PLUGIN_DATA`。缓存与安装目录分离。

配方工坊提供材料搜索、3×3 拖放换位、五种原版配方、产物数量、JSON 变更预览、保存与刷新读回。文件写入 `src/main/resources/data/<namespace>/recipe/`；Web 与 Agent 共用版本检查，外部修改后拒绝覆盖并保留草稿。更新前使用 read 返回的 revision，新建时 expectedRevision 为 null；旧版本备份在数据目录 recipe-backups。未知序列化器或不支持的材料形式保持只读。物品显示原版/工程静态贴图；工程目录来自 items/models/item 资源，不能代替注册验证，标签成员和配方匹配需在游戏确认。六类内容参数与基础 Screen/配置页面/HUD 已交付，详见下方 R3/R4；3D、建筑生成与整合包工作流待实现。

## 构建与连接检查

可选浏览器：`node ./dist/mcp-server.js --web-only` 启动独立服务；由 MCP 客户端添加 `--web` 时，页面与 22 个工具共用同一 Core，包括 fabric_recipe_workspace、fabric_content_workspace 和 fabric_gui_workspace。打开 stderr 的完整本机链接，或调用 modcrafting_environment_status 获取 browserUrl。可加 `--web-port=端口`，默认随机端口。默认 MCP 不开启 HTTP；关闭页面不停止任务，关闭服务/宿主连接则停止本进程任务。资源 present 不等于 V2 已就绪，准备资源后仍需按完整产品 README 应用 Observer V2。浏览器可生成并验证用户模组的原生 Screen/HUD；聊天内嵌 MCP Apps 与工作台本身的游戏内操作面板未实现。

开发者在隔离 Worktree 使用 pnpm 10.34.7，依次执行：

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run plugin:build
pnpm run plugin:validate
pnpm run plugin:stage
pnpm run plugin:smoke
pnpm run plugin:test
```

实测 Windows x64 的 Node 22.23.3 / 24.19.0。Smoke 使用官方 MCP Client，从仓库外目录执行 Stage，并禁止模块解析到 Stage 外；完成 initialize、初始化通知、tools/list 和 tools/call。工具数量以 tools/list 为准。`--self-test` 只检查注册，不能代替此验证。用户直接通过 `node <插件目录>/dist/mcp-server.js` 连接 stdio MCP；手动运行后等待输入是正常行为，不能用“没有打印信息”判断失败。

## Codex 安装

当前候选为 R4 / 22 工具；真实配置 App Server 已读回布局，两份 Skill 可用。新版当前聊天与 Qoder 创作调用需分别复验，见仓库 docs/desktop-host-quickstart.md。下方 P1/P2/P4 的 19 工具、客户端版本和账户状态均为历史验收记录，不代表新版工具清单或当前个人配置。

保留原 `.codex-plugin/plugin.json` / `.mcp.json` 格式。依据 [OpenAI 官方本地插件说明](https://developers.openai.com/plugins/build/plugins)，在选定的本地 marketplace 根目录创建 `.agents/plugins/marketplace.json`，并将整个 Stage 复制到该根目录的 `plugins/modcrafting-fabric/`。已有目录或清单应合并检查，不能覆盖个人配置。

```json
{
  "name": "modcrafting-local",
  "plugins": [{
    "name": "modcrafting-fabric",
    "source": { "source": "local", "path": "./plugins/modcrafting-fabric" },
    "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
    "category": "Developer Tools"
  }]
}
```

在该根目录执行：

```powershell
codex plugin marketplace add .
codex plugin add modcrafting-fabric@modcrafting-local
```

以上本地安装流程已在 Codex CLI **0.162.0-alpha.17.2**、测试专有配置目录实测。桌面端随附二进制的真实 App Server 已发现两个启用的 Skill、连接 19 个 MCP 工具，并实际调用环境/项目/知识/构建/游戏工具；0.150.1 仅核对了 help 语法。2026-10-14 补充验证了持久安装后的完整桌面重启加载，以及独立本地来源下首次点击“安装插件”的路径；安装缓存与安装时 Stage 一致，验收副本随后禁用，现有 P1 插件保持启用。不同客户端版本若没有上述命令，可按官方说明通过本地 marketplace 在插件界面安装。没有添加未经测试的新清单格式，也没有发布公共 marketplace。

MCP 使用 `cwd: "."` 与 `args: ["./dist/mcp-server.js"]`，由宿主将 cwd 定位到插件目录。不要依赖 `${PLUGIN_ROOT}` 在 MCP 参数中展开：[Codex 上游问题 #35762](https://github.com/openai/codex/issues/35762) 与本机真实宿主复现均表明该写法会导致初始化失败。协议 Smoke 与真实 Codex 加载验收是不同的验证层。

备用方式：仅添加 MCP 服务（不会自动安装两个 Skill）。复制插件到自己的持久目录，替换下例路径，再执行 [官方 MCP CLI 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)：

```powershell
codex mcp add modcrafting-fabric --env MODCRAFTING_DATA=D:/ModCraftingData -- node D:/ModCraftingPlugin/dist/mcp-server.js
```

该命令已使用测试配置目录和实际 Stage 路径验证。选择插件或单独 MCP 一种入口，避免重复注册。开始新聊天后确认有 `modcrafting_environment_status`、`fabric_project_inspect`、`fabric_validate`、`minecraft_test_start`、`minecraft_test_status`；先调用 `modcrafting_environment_status({})`。无 Java 也应返回 platform/node/java/target/remediation；诊断中的 `ok:false` 表示环境尚未齐备。

## 最短开发演示

打开已有 **Fabric 1.21.4** 工程，请 Codex 顺序调用：

1. `fabric_project_inspect({projectPath: "<工程绝对路径>"})`，再 `fabric_validate` 检查元数据和 Wrapper。
2. 需要知识资源时，显式调用 `modcrafting_prepare_assets({})`；逐项检查返回的 `assets[].ok/error`。初始化不会下载。环境诊断新增 contractVersion、assets 的 missing/present/invalid 和 Core capabilities；present 只表示本地布局存在，environment.ok 仍指工具链检查。资源通过 gh.xmly.dev 代理、失败回退 GitHub 直连；Release API 仍需网络。P2-04 已在冷数据根验证五个真实包的下载/解包、Release 大小与 SHA-256、标准数据和文档/Wiki 查询；资源准备不安装 JDK/Gradle。
3. 已准备资源后调用 `minecraft_data_lookup({kind:"item",query:"stone"})`；查询失败先准备或检查资源，禁止编造原版 ID/属性。`fabric_docs_search` 和 `mc_wiki_search` 当前为离线关键词查询，不能当作完整语义检索。
4. PATH 上有 JDK 21，工程含 `gradlew.bat` 及 Wrapper JAR/properties 后，调用 `fabric_build_start({projectPath:"<工程绝对路径>",task:"build"})`，用返回的 jobId 轮询 `fabric_job_status`。
5. `completed` 且构建结果 exitCode=0 仅证明任务成功；`failed` 查看错误/输出，`stopped` 表示已取消。补充验收已在系统 JDK 21.0.3 / Gradle 9.5 的隔离工程中编译 Java ModInitializer、生成模组 JAR，并在真实客户端观察到加载标记。测试工程自行提供 Wrapper、资源版本展开和预备缓存，不能据此承诺任意项目都能离线构建。

资源落在数据根目录的 `knowledge/`、`assets/`、`downloads/`；报告在 `reports/`。准备后的查询可以离线运行；准备与首次 Gradle 依赖解析可能联网，插件没有完整 Desktop 离线工具链。

**Observer 兼容步骤（2026-10-14）**：公开 v1.0.1 的 base-mods.zip 仍包含不支持 `/v2/capabilities` 的 V1。P2 本地完整交付包含独立的 `observer/modcrafting-observer.jar`（2.0.0 / 协议 2）。资源准备后、游戏启动前，复制它覆盖到自己的数据根 `assets/base-mods/modcrafting-observer.jar`；不要同时放入两个同 ID JAR。再次 prepare_assets 后需重做此步骤。MCP Stage 本身仍为原白名单，未自动内置/替换 JAR；完整产品通过仓库的 `pnpm run product:stage` 组装，步骤见 `docs/product-handoff.md`。远端资源未更新，不能将“资源 present”当作协议兼容。

## 游戏验收与限制

先取得用户对游戏启动/受控动作的授权；需 JDK 21、工程 Wrapper、准备好的 base mods 与 Observer V2、单人专用 **ModCrafting Test World**。仅在隔离 gameDir 和保留测试区域进行操作，不能自动清理日常存档。使用 `minecraft_run_client` 后轮询 `minecraft_runtime_status`，Observer 未就绪时不提交测试。

GameTestSpec version=2，必须有合法 subject、setup/actions/assertions/cleanup；actions 与 assertions 均不能空。ID 不允许目录穿越，动作仅 command/input/wait；wait 为 0–10000 ms。测试开始后使用 jobId 调用 `minecraft_test_status`。报告含版本、场景、快照请求标识、来源、断言证据与 cleanup 状态，不包含桥接认证 token。

| 结果 | 含义 |
|---|---|
| PASS / OK | 支持型断言具备不同请求标识的前后快照，实际观察匹配，动作及清理成功 |
| FAIL / ASSERTION_FAILED | 有效观察值明确不匹配 |
| INCONCLUSIVE | 环境/能力/证据不足、取消、视觉验收或清理失败，不能算通过 |
| INVALID_SPEC | 参数非法，启动前拒绝；不运行游戏动作 |

支持 `inventory_contains`、`block_equals`、`entity_exists`、`snapshot_value`、`snapshot_changed`。实体查询范围为 Observer 的半径 32、最多 64 个实体；不能证明整个世界的不存在。实机实体的 `tag` 过滤为 CAPABILITY_UNAVAILABLE：客户端快照不能验证服务端命令标签，按类型查询仍支持，清理命令可使用服务端标签定位自建实体。快照指针仅访问已观察字段。HUD、command_result 和 trace 来源的通用快照断言均保守返回 CAPABILITY_UNAVAILABLE；历史 HUD 不能算新证据。缺字段返回 EVIDENCE_MISSING；非测试世界/桥缺失返回 ENVIRONMENT_UNAVAILABLE；cleanup 失败返回 CLEANUP_FAILED，撤销 PASS。

此插件不等价于 Desktop 的完整验收引擎。基础回归采用 Fake Bridge/Fixture；P1 的库存三态实测保留。P2-04 在仓库外使用从源码重建的 Observer 2.0.0，在同一 MCP 会话完成冷资源准备、系统工具链构建和十例真实游戏验收，预期匹配 10/10（5 PASS、3 FAIL、2 INCONCLUSIVE）；覆盖五种支持断言的代表案例，没有证明任意模组、完整容器交互或旧 Desktop 的 18 类验收。实机细节见仓库的 `docs/phase-02-core-report.md`；上述 P2 验收当时未升级账户插件，当前候选与宿主边界见桌面接入指南。

## 排错与禁用

| 问题 | 处理 |
|---|---|
| Node 启动失败 | 检查客户端 PATH 或使用 Node 可执行文件绝对路径；确认整个 Stage 已复制 |
| INVALID_DATA_DIRECTORY | 数据变量必须为绝对可写目录；优先 MODCRAFTING_DATA，随后 PLUGIN_DATA、CODEX_PLUGIN_DATA |
| JDK / Wrapper 缺失 | 将 JDK 21 的 java 放入 PATH，检查项目 Wrapper；插件不会下载 JDK/Gradle |
| 知识包缺失或搜索为空 | 看 assets 每项错误及 assetReady；检查代理/直连、Release API 与对应缓存目录 |
| MCP 协议解析失败 | stdout 只能是 JSON-RPC，诊断写 stderr；不要在入口外加会打印日志的脚本 |
| Observer 未连接 | 检查准备的 Observer JAR、gameDir、游戏任务与桥就绪状态；不能用截图替代 |
| 测试清理失败 | 查看报告 cleanup；确认测试世界后人工处理，不要对普通存档自动重试清理 |

停止插件拥有的任务后，可在插件界面禁用；仅 MCP 入口可将对应 mcp_servers 配置的 enabled 设为 false。禁用与删除缓存是不同操作，禁用保留数据。若要移除数据，应先明确实际数据根目录与备份需求，仅清理自己确认的插件数据，不能跟随 junction/symlink 批量删除目录。

P4 提供 Codex、Claude Code 和 Qoder CLI 的不同清单，Core bundle 与 Skills 共用。Codex CLI 原生安装/19 工具及实际工具调用已验证；Claude Code 原生安装/19 工具及本地 Provider 回放驱动的真实工具调用已验证，没有使用付费模型。Qoder CLI 已验证安装、两份 Skills 与 19 工具连接，当前隔离配置未登录，实际工具调用保留为待验收；不能把插件 validate 或连接成功记成该项完成。MCP Apps、Claude Desktop/Qoder IDE 原生插件安装和其他宿主未验收。

完整跨宿主包与备用配置通过 host:stage / host:config 生成，默认不修改账户；host:smoke 仅验证配置和 SDK，不是宿主验收。详细命令见分发包根 README 和仓库 docs/host-distribution.md、docs/phase-04-distribution-report.md。以上为 P4 历史分发验收，后续本地候选更新与桌面接入结果见 docs/desktop-host-quickstart.md。TRAE、WorkBuddy、DSH 未适配。


## R3 内容参数工作台（2026-10-16）

R3 新增 `fabric_content_workspace`，当时共 21 个工具，当前 R4 为 22 个。`--web` 的浏览器支持物品、食物、方块、生物、工具、护甲：类型专用字段、单位/范围、资源关联、变更预览、保存、刷新与 Agent 读回。请求按 list/read → preview(expectedRevision) → save(expectedRevision, previewRevision)；新 ID 的 expectedRevision 为 null。外部修改生成物或未知 Java 只读；冲突保留草稿，不能强制覆盖。每次保存备份并保护已有入口/语言文件，Java 改动需构建和游戏重启。

实体限猪/僵尸原版外观与 AI 基型；资源预览为已有 PNG 或可选私有原版纹理缓存，缺缓存显示类型示意，不是 3D。工具与护甲使用原生 1.21.4 组件；剑沿用原版挖掘规则。食物效果为表单所列固定 30 秒 I 级效果。Observer capabilityRevision 5 补充实际食物/方块/实体及服务端装备属性，旧远端 Observer 不具备这些字段。真实游戏验收覆盖六类内容，9 PASS 与 3 个预期 FAIL，另补验具体食物效果；各次清理完整。配置/安装、原生 App Server 调用与桌面聊天调用是不同证据，实际候选和宿主边界见 docs/desktop-host-quickstart.md。


## R4 MC 界面创作（2026-10-16）

新增 fabric_gui_workspace，共 22 个 MCP 工具。template 获取布局/组件默认值（不写文件），list/read 读取工程，preview(expectedRevision) 检查生成文件，再 save(expectedRevision, previewRevision) 应用。浏览器提供原生 Screen/配置页面/HUD 的结构化画布、六类组件、属性/绑定、拖动/尺寸调整、8px 吸附/对齐及窗口/GUI 缩放模拟；不接收或执行 AI HTML/脚本。

生成独立客户端入口、布局资源、快捷键和原生控件；开关/滑块状态写入游戏 config 的独立 JSON，按钮仅关闭/恢复默认/递增滑块。HUD 支持文字/面板/展示槽位；展示槽位不实现容器交易/服务端同步。手写或外部修改的 Java 保持只读，保存前预览并备份；布局应用后需重建/重启。复杂任意事件、自由 HTML、文本输入/循环控件不在首轮支持范围。

真实游戏验证控件、坐标和重启持久化；HUD 的绘制/显示隐藏以新鲜原生记录与截图单列，现有引擎 hud_text 仍返回 INCONCLUSIVE。原生 App Server、桌面聊天与 Qoder 登录验收继续分别记账。详情见 docs/archive/2026-10-16-mc-gui-workbench.md。
