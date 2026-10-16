# P5 Desktop 退役实施报告

日期：2026-10-15；隔离工作区 ModCrafting-mcp-p1 / feat/mcp-foundation-p1。

**功能替代、工程路径迁移、默认入口切换及旧自动发布退出已完成本地实施与验证。** 旧 Electron 源码、开发依赖和用户数据保留为兼容参考；未执行物理清理、个人配置迁移、账户插件升级或远端发布。Qoder 实际工具调用仍依用户决定保留待登录环境；本轮开始 P5 来自用户新的明确授权。

## 实现与复用

- 复用 Desktop settings.json / config.json 路径格式、Core inspectFabricProject 和已有浏览器认证通道。新增迁移 CLI，默认只读盘点；显式 --apply 才向**不存在的独立数据根**写入工程路径清单与迁移记录，不复制工程、node_modules、聊天、密钥、存档或大缓存。
- 路径去重、缺失工程提示、相对路径跳过；输入、工程、runtime、目标及其父目录的 junction/symlink 不允许用于导入。目标不得包含或嵌套旧数据/工程。独占创建、不覆盖，迁移记录最后写入并校验清单 SHA；失败目标保留，不自动清理/重试覆盖。
- Core 读回时重新检查路径；MCP 环境结果新增 projectCatalog，工具数量/名称/输入仍为 19；认证浏览器 /api/projects 读取同一清单，新增工程选择，不新增导入或任意文件读取 HTTP 操作。
- 根 build 构建独立 MCP、Bench 和迁移 CLI；dev/start/preview 走可选浏览器，test/typecheck 走独立产品。旧命令使用 desktop:*，旧 build:win* 兼容保留，test:harness 记录旧全仓基线。
- 默认安装后只检查 esbuild；setup:worktree 默认 --ignore-scripts 安装并只恢复 esbuild，--desktop 才准备旧 Electron/Renderer。正式依赖和 pnpm 锁、.npmrc 不变，无新增运行依赖，Store 仍 D:\.pnpm-store\v10，每个 Worktree 的 node_modules 独立。
- release.yml 移除 tag push 自动触发，只允许显式确认、对已有 v* tag 的手动派发。旧本地远端写入脚本改名 desktop:release:publish，未执行。新产品仍仅本地 Stage。
- 原 README 原文保留到 docs/legacy-desktop.md；更新入口、覆盖清单、迁移/回退、契约、命令及路线。迁移 CLI/指南进入完整产品，插件内部仍为九文件白名单。

核心位置：packages/modcrafting-core/src/desktop-migration.ts；scripts/plugin/migrate-desktop.ts、build-migration.mjs、stage-product.mjs；浏览器 App.tsx / browser-server.ts；package.json、setup-worktree.mjs、ensure-native-deps.mjs；两份工作流。完整替代和保留规则见 [退役指南](./desktop-retirement.md)。

## 验证结果

| 验证 | 结果与范围 |
|---|---|
| 独立回归 | Node 22.23.3 与 24.19.0 均 80/80；新增迁移 7 项包含损坏、路径失效、覆盖、嵌套、链接、未完成/篡改记录和认证浏览器读回。末次链接边界补强后 Node 24 全 80 项、Node 22 迁移 7 项复验通过 |
| 类型与构建 | 默认 build / typecheck 通过，迁移 CLI 包含在类型检查；独立 CLI 无非 Node 内置运行模块，构建不调用 Java/游戏 |
| MCP 与三宿主配置 | Node 22/24 独立 SDK 协议通过；三宿主各 19 工具、独立模块和浏览器回退通过。这是 SDK/config 验证，不代替 Qoder 原生调用或重做真实账户升级 |
| 仓库外迁移 | 独立交付 CLI 在 Node 22/24 完成只读盘点、显式导入、重复导入拒绝。最后交付的 CLI 再验普通导入及 runtime 别名拒绝；源配置、runtime、来源工程指纹保持 |
| 浏览器与 Agent | 同一新数据根，Agent 环境工具返回原路径，浏览器选择并打开工程，mod ID p1_acceptance；缺失路径保留为需检查。1320×960 / 390×844 截图检查，无横向溢出或浏览器异常 |
| 真实构建 | 浏览器从迁移清单打开隔离 Fabric 工程并发起 build，关闭页面后 MCP 读到 completed / exitCode=0。系统 Oracle JDK 21.0.3、工程 Wrapper/Gradle 9.5、既有预热缓存及 --offline；不宣称冷下载验证。游戏逻辑未改，本轮未启动 MC |
| 默认启动与自举 | pnpm start 实际启动 Node --web-only，认证状态/工程接口可用；无 Electron 启动。setup:worktree 安装跳过、esbuild 检查通过，不恢复旧 Renderer |
| CI 本地检查 | 使用已安装 js-yaml 解析工作流；无旧 tag 自动触发、手动确认默认 false、限制 v* tag、新增迁移构建/测试路径。远端 Actions 未执行 |
| 旧基线 | 全仓 844 / 823 通过 / 21 失败，失败名称与 P4 相同；旧 Desktop 23 条类型错误逐行相同。README 改为新产品后，旧工具目录断言改为检查保留的 legacy-desktop.md，未降低工具数断言 |
| Git / 文件 / 进程 | 原 main HEAD、原 9 项未跟踪文件及 SHA 不变；P5 无删除/暂存/提交/推送。正式锁/.npmrc 不变；测试服务正常退出、测试浏览器/默认启动树结束，无本轮作用域 Node/Java/Chrome 遗留 |

## 交付与证据

最终本地三宿主包：`D:\Temp\modcrafting-p5-delivery-9lo8u23n\distribution`，**45 文件**，包含 product/ 的 24 文件、Claude/Qoder 两份九文件适配及配置工具/指南/总 manifest。全部文件清单和 SHA 已核验。

MCP bundle SHA-256：`db18e7d67536bfd66606861136aafd48a885005b0608d501ab1888fc35e80558`。最后交付与 SDK/浏览器/真实构建使用的 bundle 完全相同；末次变化仅迁移 CLI、迁移指南与对应 manifest，CLI 已单独复验。

- P5 基线与最终校验：`temp/run-td9mol99/`；before.json 为本阶段开始时 692 文件指纹，不覆盖 P4 证据。
- 独立迁移、浏览器截图、真实构建报告：`D:\Temp\modcrafting-p5-vVxgpP\acceptance.json`、environment.json、build.json、migration-desktop.png、migration-mobile.png。
- 最终 CLI 独立验证：`D:\Temp\modcrafting-p5-cli-final-hwsctnuv`；默认入口验证：`D:\Temp\modcrafting-p5-default-D5Rznv\acceptance.json`。
- SDK/config：Node 24 `modcrafting-host-smoke-SFVrnO`、Node 22 `modcrafting-host-smoke-aRbhcV`，位于系统 Temp。此后 MCP bundle 未变化，最终清单差异见 final-package-verification.json。

本轮迁移对象为隔离构造的 Desktop 配置和既有验收工程副本，**没有自动迁移用户个人配置**。执行个人迁移时需退出 Desktop、明确物理目录、新建数据根，再按指南读回；原目录始终保留。

## 保留边界

旧聊天、checkpoint、报告和游戏存档原地保留，不自动转换成新任务或新 PASS。旧 Electron 源码/开发依赖暂未物理剥离，源码安装推荐 --ignore-scripts；独立交付无需它们。系统工具链由用户管理，知识仍是关键词搜索，公开 base-mods 仍需显式应用产品 V2。MCP Apps、新游戏 UI、Qoder 登录后的调用、真实账户升级、远端 CI/发布与其他系统均未扩大宣称。
