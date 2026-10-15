# P1 实施与验收报告

初始日期：2026-10-13；补充：2026-10-14。状态：**P1-01 → P1-06 的底座交付已本地完成；真实宿主/构建/库存三态验收、持久安装、重启后的界面启用观察及首次桌面安装按钮路径通过；远端 Actions 未执行**。

最新补充结果见 [真实验收报告](./phase-01-live-acceptance-report.md)：实际 Codex 后端发现两个 Skill、19 个工具并调用；真实 JDK/Gradle 构建和 Minecraft 库存 PASS / FAIL / CLEANUP_FAILED 通过，同时修复了宿主不展开 PLUGIN_ROOT 的入口问题。后续通过官方 CLI 持久安装/启用，两个独立后端重新启动均加载成功，当前桌面聊天直接调用环境诊断成功。下表为最初底座验收快照，补充实机证据以新报告为准；后端重新启动不等于完整桌面应用重启。

2026-10-14 的补验另已观察到完整桌面重新启动：新进程中 P1 来源插件与两个技能开关开启，旧 main 来源插件仍关闭，当前聊天的实际 MCP 调用成功。无需卸载或重装；首次界面按钮安装仍标为未验证。

当日继续补验后，独立验收来源从未安装状态经真实“安装插件”按钮完成安装，缓存的 9 个文件与安装时 Stage 一致；随后仅禁用验收副本，原 P1 插件与旧 main 来源配置不变。首次按钮路径现已通过；上述“未验证”是该补验之前的历史状态。

## 前置与安全

用户最新指令为“开始P1任务”，取代此前暂不开始 P1 的限制。按 P0 → P0.5 → P1 推进：Git 隔离、pnpm 迁移、npm/pnpm 对照及打包 EXE 启动修复已完成验证，既存红色基线按任务书保留。仅移除新 Worktree 中跟踪的 package-lock.json，正式锁为 pnpm-lock.yaml；原 main 和 npm 对照仍保留原锁。

所有项目修改位于 ModCrafting-mcp-p1 / feat/mcp-foundation-p1。原 main HEAD b40e1fa522cf87280b72ace2480417e051b908fa 不变，9 个原未跟踪文件的列表与 SHA-256 均不变。没有提交、推送、发布或手工读取账户/凭据配置。初始 Codex 安装试验使用测试专有配置目录，补充验收按最新授权启动了隔离 MC；之后用户确认继续桌面安装验收，官方 CLI 在实际 CODEX_HOME 中新增并启用了 modcrafting-fabric@modcrafting-p1，保留旧 main 来源插件的禁用状态。私有验收日志保留，不入库。

## D1–D8

| 交付 | 结果与证据 |
|---|---|
| D1 独立 Stage | temp/plugin-artifacts/modcrafting-fabric；按文件白名单复制，排除源码、node_modules、缓存、配置及日志；拒绝链接/未知残留，保留 GPL 原文和实际 bundle 依赖许可 |
| D2 真实 MCP Smoke | 官方 SDK Client 的 initialize、初始化通知、tools/list、tools/call；仓库外临时目录、模块 resolve hook 禁止 Stage 外文件；Node 22/24 均通过 |
| D3 自测替换 | 不再硬编码工具数量；self-test 明确 registrationOnly，plugin:smoke 负责协议，plugin:test 负责定向 Core 回归 |
| D4 游戏证据防线 | 严格规格校验；快照标识/时序、缺字段保护、HUD/命令结果能力限制、finally 清理、取消和 CLEANUP_FAILED；39 项定向测试通过，均为 Fixture/Fake Bridge |
| D5 Codex README | 系统要求、Stage、实际 CLI 本地安装、备用 MCP、演示、按需资源、诊断、安全和能力边界；CLI 安装后的缓存入口也通过协议 Smoke；桌面 UI/真实工程仍标为未验证 |
| D6 独立 CI | plugin.yml：Windows / Node 22 / pnpm 10.34.7，路径过滤、contents:read、冻结锁、跳过 Desktop 生命周期脚本；本地空依赖目录复现完整序列通过；未运行远端 Actions |
| D7 架构边界 | Core/MCP 优先、Desktop 与旧 Harness 维护模式；明确 Test Lab 不等于用户插件，未来入口只记录方向 |
| D8 报告与归档 | 本文件与 docs/archive/2026-10-13-mcp-foundation-p1.md |

Stage 保留原 .codex-plugin/plugin.json 与 .mcp.json，未引入新根清单，版本仍为 0.1.0+codex.20260812155641；Server 版本由构建读取该清单注入。当前 tools/list 实测为 19 个，计数来自真实发现而非常量。

## 关键改动与复用

| 文件/范围 | 目的 |
|---|---|
| docs/agent-integration-boundaries.md、architecture.md、harness.md、AGENTS.md | 冻结扩张方向；AGENTS 为 128 行 |
| scripts/plugin/build.mjs、stage.mjs、validate.mjs | 复用 esbuild 自包含构建，检验非内置 external、统一版本、提取依赖许可；白名单交付与安全校验 |
| plugins/modcrafting-fabric/src/mcp-server.ts | 持久数据目录与旧变量兼容、可写探针、stdin EOF 生命周期、现有工具绑定 Core 验收；按断言请求真实方块坐标，防止 input args 覆盖 action |
| packages/modcrafting-core/src/domain.ts、game-test.ts、index.ts | 复用已安装 Zod 做字段校验；抽取小型无 Electron 的断言/执行逻辑，不搬运完整 Desktop 引擎 |
| packages/modcrafting-core/src/node.ts | Java 诊断 3 秒超时；校验 mod ID；Windows Wrapper 经 cmd 启动；资源读取路径兼容；任务状态移除 ChildProcess 对象，取消不被晚到结果改为 completed，停止只作用于本任务 PID 树 |
| scripts/plugin/smoke.mjs、test.mjs、相关两份 harness 测试 | 真实 SDK 协议、Schema、有效/无效元数据、无知识库、非法/不可写数据根、意外退出、stdout 与 EOF；动作/清理/取消和 Wrapper/进程树夹具 |
| plugins/modcrafting-fabric/README.md、LICENSE、THIRD_PARTY_NOTICES.txt、游戏 Skill | 可执行用法、合法许可原文与真实能力限制 |
| package.json、pnpm-lock.yaml、plugin.yml | 仅新增与现有 Server 同版的 @modelcontextprotocol/client@2.0.0 开发依赖和插件命令/CI；没有新增业务框架或工具 |

参考 [MCP 官方 SDK Client](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect)、[Ajv 2020-12 支持](https://ajv.js.org/json-schema.html)、[Node Windows 批处理进程文档](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows)。Codex 安装核对使用 OpenAI Docs 技能及 [官方插件打包说明](https://developers.openai.com/plugins/build/plugins)、[官方 MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。GPL 原文从 GNU 官方站点取得，依赖许可取自实际构建输入对应包，保留其原文。

## 必要验证

| 命令/试验 | 结果 |
|---|---|
| plugin:build / validate / stage | 通过，最终 Stage 含清单、入口、两 Skill、图标、README、GPL 及第三方许可 |
| plugin:typecheck | 通过，Node 22 的独立 CI 复现也通过 |
| plugin:smoke | Node 22.23.3 / 24.19.0 均通过；没有 Java/知识包时给出真实缺失诊断；没有资源初始化下载 |
| plugin:test | 39/39 通过，无跳过；包括真实 Windows 批处理夹具与本次自建 Node 进程树停止，不是实际 Gradle/MC |
| 新空依赖目录模拟 CI | pnpm install --frozen-lockfile --ignore-scripts，复用 608、下载 0，约 9.8 秒；没有 electron/dist/electron.exe；六步插件序列通过 |
| Codex 本地安装 | CLI 0.162.0-alpha.17.2 的 marketplace add、plugin add、mcp add 在测试配置根中通过；当前 Stage 缓存入口协议 Smoke 通过；0.150.1 仅验证 help |
| pnpm run build | 完整 Electron-vite 构建通过，保留原有动态/静态 import 提示 |
| pnpm run typecheck | 23 条既存错误，逐条与此前 npm/pnpm 基线相同 |
| pnpm test | 800 条、779 通过、21 失败；较原 763 条新增 37 项全部通过，失败用例集合完全相同，新增失败 0 |
| plugin.yml | YAML 解析、只读权限及无发布/上传步骤检查通过；远端未运行 |
| Git/原文件 | diff --check 通过；原 main、9 个未跟踪文件 Hash 不变；无提交/推送 |

证据：temp/p1-verification/{typecheck.log,harness.log,baseline-comparison.json,installed-plugin-smoke.log}；temp/p1-ci-fixture-84dd05081dd94e73b81d1fc1776c2bea/ 含空依赖安装与最终 CI 序列日志。Codex 安装证据在 temp/p1-codex-final-*/install.json 等测试专用文件；MCP Smoke 的独立系统临时目录有 summary.json，其路径记录在各 Smoke 日志。没有上传这些文件。

## 验收限制与下一阶段条件

- 补充验收已有真实 Minecraft/Observer、Gradle 编译、Skill 自动发现、三态库存验收与桌面首次按钮安装证据；正式资源首次下载和远端 CI 仍未执行。其余断言与更多游戏情境没有实机通过证据。
- HUD、command_result、trace 来源通用断言明确 CAPABILITY_UNAVAILABLE。实体不存在仅涉及半径 32、最多 64 个实体的查询范围。快照查询缺失或截断不会 PASS；尚未实现 Desktop 的全部断言、独立进程复测与完整验收契约。
- 规格现在拒绝空 actions、未知字段及不完整参数，旧调用方应提供明确动作。清理前未建立测试世界时不执行命令，报告明确 skipped；已建立后异常进入 finally，清理失败撤销 PASS。
- Core 项目检查验证元数据、目标版本及 Wrapper 文件入口，不等于真实编译/Wrapper 完整性验收。资源准备返回逐项结果和汇总成功状态，外部 Release 的存在与资源完整性仍需实测。
- 原全仓 CI 仍会被 23/21 既存失败阻断；独立插件 CI 只验证本阶段范围，不能据此宣称整个仓库绿灯。
- 本地 Stage 未正式发行；对外分发前须提供匹配源码与许可，并完成真实安装/游戏验证。本阶段不提交、不推送、不发布，不开始 P2。

## 交付复核

2026-10-13 复核 pnpm/Windows 打包改动、Core 与 MCP 注册、独立构建/白名单 Stage、CI 以及已有验收证据。本次静态审查未发现该范围内新增的阻断问题，未修改生产代码，也未重复运行代码未变化的全仓或插件测试。两个 node_modules 均为各自工作区中的普通目录，Store 为 D:\.pnpm-store\v10；插件 CI 的权限为 contents:read，验证序列没有发布步骤。全仓 23 条类型错误和 21 个旧失败仍按原基线保留。

当前项目变更的文件名、SHA-256、增删状态与阶段分类记录于 temp/p1-delivery-review/source-inventory.json，供后续精确审阅；这不是已提交或已暂存的清单。对应阶段文档与日志没有被删除，临时产物、插件安装配置和验收截图不在源码交付文件列表中。原 main 与 9 个未跟踪文件的最终复核结果同存于该目录。桌面仍锁屏，界面观察与完整应用重启验收继续标为 PARTIAL；提交、推送和进入 P2 均需另行明确授权。

2026-10-14 补充：上段记录的是锁屏当天的状态；现已完成重启后界面启用观察与实际调用，解除该项阻塞。仍保留首次界面按钮安装、远端 CI、正式安装器生命周期、首次资源在线下载等未验证边界。变更清单按当前文档重新生成；没有新增生产代码或重新执行未变化的构建/游戏回归。

当日最终补充：首次界面按钮安装也已通过。仅新增并禁用了独立验收来源，保留现有 P1 插件；更新插件 README 后执行 Stage/白名单校验，没有重复构建或游戏回归。远端 CI、正式安装器生命周期和首次资源在线下载仍未验证，阶段边界仍为 P1。
