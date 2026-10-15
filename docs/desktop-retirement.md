# Desktop 退役与保留数据

实现复用现有 Desktop 路径格式与 Core 工程检查；独占创建、拒绝链接等文件操作采用 [Node 22 官方 fs API](https://nodejs.org/download/release/latest-jod/docs/api/fs.html)，配置位置遵循 [Electron app.getPath](https://www.electronjs.org/docs/latest/api/app#appgetpathname)。没有新增运行依赖。

P5 将新用户默认入口切换为 Core/MCP + 可选浏览器。旧 Electron 源码和开发依赖保留作兼容参考，不进入独立产品；不会卸载旧应用、清理数据、升级账户插件或自动发布。Qoder 实际调用依此前决定保留待验收，用户于 2026-10-15 明确授权开始 P5。

## 功能替代与边界

| 旧 Desktop 功能 | 当前去向与验证方式 |
|---|---|
| 对话、计划、模型/密钥、代码编辑、终端 | 外部 Agent / IDE；不导入模型配置和密钥，不启动旧 Harness |
| 工程打开、最近路径 | Core inspect / validate；迁移 CLI 导入路径清单，环境工具和浏览器可读，打开时重检；工程内容不复制 |
| 新建 Fabric 工程 | MCP scaffold 附带固定 Wrapper，已有工程自带 Wrapper；旧七种模板表单不逐个复刻，宿主编辑源码 |
| 工具链、运行目录 | 显式 MODCRAFTING_DATA；系统 JDK 21 + 工程 Wrapper；旧 JDK/Gradle/缓存原地保留，可自行配置 PATH / JAVA_HOME / GRADLE_USER_HOME，不自动导入或修改旧 runtime |
| 知识与基础模组 | Core prepare / lookup / search、浏览器资源诊断；显式下载，Wiki 当前关键词搜索；旧向量模型和自定义知识/Skill 原地保留，由宿主按需读取 |
| 构建、日志、游戏启停 | 同一 FabricRuntime 的异步 Job / 实例及浏览器操作；P2/P3 已实机验收；会话退出会结束所拥有的任务，不恢复旧任务 |
| 游戏观察、动作、截图、断言、清理 | Core + Observer V2；P2/P3 有 PASS / FAIL / INCONCLUSIVE 实机证据；HUD/tag/trace 等能力不足保持 INCONCLUSIVE，截图不作 PASS |
| 报告、存档、聊天、checkpoint | 原路径保留，旧 Desktop 兼容入口可回看；新 UI 只显示当前 Core 任务报告，不将旧报告伪装为新验收，不导入旧聊天/checkpoint 继续执行 |
| 安装、更新、分发 | P4 三宿主本地包 + 浏览器回退；Qoder 调用待登录环境；无自动账户升级、新增云服务或远端发布 |

这是用户明确选择的职责替代，不宣称旧 Desktop 的所有表单、18 类断言或自动下载工具链已逐项复刻。MCP Apps 与新游戏 HUD 非首批退出门槛；旧源文件的物理删除及开发依赖剥离未执行。

## 数据位置与迁移

Desktop 配置是 Electron userData 下的 settings.json（lastProjectPath / recentProjects）和 config.json（runtimePath）。常见 Windows 配置在 `%APPDATA%/modcrafting`，以实际应用目录为准，CLI **不猜测/扫描个人配置**。Setup 未覆盖时 runtime 在 exe 旁；开发版默认仓库 runtime；Portable 的 exe 旁 runtime 优先，需显式 `--runtime-root`，不会根据旧 config 误判便携路径。

先退出旧 Desktop。以下 USER-DATA、NEW-CORE-DATA 等均替换为自己的绝对路径：

```powershell
# 产品根，Node 22.15+ / 24，无需源码和 node_modules；默认仅盘点
node ./migrate-desktop.mjs --user-data "ABSOLUTE-USER-DATA" --runtime-root "ABSOLUTE-OLD-RUNTIME"
# 显式导入；目标必须不存在，不允许嵌套/包含旧配置、runtime 或工程
node ./migrate-desktop.mjs --user-data "ABSOLUTE-USER-DATA" --runtime-root "ABSOLUTE-OLD-RUNTIME" --apply --data-root "ABSOLUTE-NEW-CORE-DATA"
```

源码等价命令：`pnpm run desktop:migrate -- --user-data "ABSOLUTE-USER-DATA"`，需要导入时添加相同的 `--apply --data-root`。`pnpm run migration:build` 生成独立命令；完整产品内附 migrate-desktop.mjs 与本指南。

只读取两份路径配置和工程元数据，不解析密钥/聊天内容；导入去重后的绝对路径，缺失工程保留并标为需检查，相对路径跳过并报告。原配置、工程及其 node_modules、全部存档、密钥、聊天、旧报告、缓存均不移动、删除、复制或链接。旧 runtime 只是盘点记录，不会自动供新 Core 使用；不会触发下载、Java、Gradle、游戏或网络调用。

新数据根内仅创建 projects.json 和 desktop-migration.json。后者最后写入，含路径清单摘要、保留位置和清单 SHA-256；不完整/清单被改动时拒绝读取，原目录和失败目标保留供检查。重复导入和已有空目录也拒绝覆盖，需选另一个新目标。

导入同时拒绝配置、runtime、工程或目标路径经过 junction/symlink 的情况，避免路径别名掩盖嵌套关系；只读盘点仍可列出原工程路径。需要调整为明确的物理目录后再导入。

把宿主 MODCRAFTING_DATA / 配置生成器 data-root 指向新目录，重启连接。`modcrafting_environment_status` 的 projectCatalog 和认证浏览器 `/api/projects` 读取同一清单并重检工程；浏览器选择“从 Desktop 保留的工程”后点击打开，核对原路径与 mod ID。然后按产品交接准备独立资源、应用 V2、检查 JDK/Wrapper。路径可用不代表资源、构建或游戏已通过。

## 回退与旧入口

回退仅需关闭新 Core、恢复原启动方式；原 Desktop 数据和工程始终在原位。回看旧聊天或旧报告时使用 `pnpm run desktop:setup`、`pnpm run desktop:build`、`pnpm run desktop:start`（或旧已安装应用）。新 Core 和旧 Desktop 不应同时在同一个工程运行构建/游戏。迁移记录是机器本地数据，不应入库或公开分发。

默认 `build/dev/start/typecheck/test` 均走独立产品。旧构建别名 desktop:build/dev/start/preview/typecheck 与 build:win* 保留；全仓旧 Harness 基线使用 `pnpm run test:harness`。默认 postinstall 只恢复 esbuild，默认 setup:worktree 以 --ignore-scripts 安装并不生成旧 Renderer 数据；--desktop 才恢复旧 Electron/Renderer。依赖仍在根 manifest，普通 install 的依赖生命周期仍可能下载 Electron，推荐新路线安装命令含 --ignore-scripts。

旧 release.yml 已移除 tag 自动触发，只允许显式确认、对已有 v* tag 手动派发。旧 desktop:release:publish 仍是有远端写入的历史脚本，标签推送后不再触发旧发布工作流，需单独人工派发；未授权时不可执行。新产品只有本地 stage，没有自动发布命令。旧发布文档视为历史参考，不能按其步骤默认发布 EXE。
