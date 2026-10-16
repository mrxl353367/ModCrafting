# ModCrafting Core / MCP 本地产品交接

交付面向外部 Agent 的 Core/MCP 和 fixture/live Bench，P3 增加可选浏览器工作台。外部 Agent 负责模型、对话、规划和编辑；包不依赖 Electron 或模型配置，Observer 原有辅助显示仍保留。Windows x64 / Node 22.15+ 或 24 / Fabric 1.21.4 为当前边界。

P5 默认开发/构建/测试入口已切换独立产品，工程路径迁移与旧数据原地保留见 [Desktop 退役指南](./desktop-retirement.md)（交付包内为 MIGRATION.md）。旧 Electron 自动 tag 发布已停用，源码兼容入口保留。

P4 在验证产品上生成跨宿主分发包：`pnpm run host:stage --product-dir "已生成的产品目录"`，保留本产品并提供 Claude Code/Qoder CLI 清单及 host-config.mjs；用法见 [跨 Agent 分发](./host-distribution.md)。Codex/Claude 实际调用已本地验证，Qoder 当前只验证安装/Skill/19 工具连接，未登录的调用项保留，不宣称 P4 全部完成。

可视化启动：从产品根运行 `node ./plugin/dist/mcp-server.js --web-only`，打开 stderr 打印的完整 URL；已有 MCP 客户端启动参数加 `--web` 时，浏览器与 MCP 使用同一 runtime，modcrafting_environment_status 返回 browserUrl。默认不开 HTTP；`--web-port=端口` 可固定本机端口，关闭页面不停止任务。工程、环境、构建、隔离游戏、V2 场景和 JSON 报告共用 Core；真实账户配置不由交付脚本修改。MCP Apps/游戏内新 UI 尚未实现，不能用浏览器验证替代宿主验收。

完整源码候选包可直接使用 `pnpm run candidate:build`（需要系统 JAVA_HOME / JDK21，可加 --offline 使用既有依赖缓存），不再依赖历史临时 Observer JAR。真实小模组验收步骤见 [候选指南](./candidate-validation.md)。

## 产品目录与构建

`plugin/` 是保持原清单的 19 工具 MCP Stage；`bench/` 是两个独立命令与案例；`observer/` 包含由当前源码构建的 Observer V2、许可及可选 sources.jar。根 manifest.json 保存交付文件 SHA-256。P5 根目录另附 migrate-desktop.mjs 和 MIGRATION.md；默认只读盘点，显式导入工程路径，其他旧数据原地保留。运行包无需源码或 node_modules，构建工具使用本仓已有依赖。

```powershell
pnpm run plugin:build
pnpm run plugin:stage
pnpm run bench:build
pnpm run migration:build
# 使用 Bench 构建打印的目录和已成功构建的 Observer V2
pnpm run product:stage --bench-dir "path/to/built-bench" --observer-jar "path/to/modcrafting-observer-2.0.0.jar" --observer-sources "path/to/modcrafting-observer-2.0.0-sources.jar"
```

product:stage 新建 temp/product-artifacts/modcrafting-*，校验 Bench 指纹与 Observer 声明的协议/MC 版本，保持 MCP 内部白名单不变。声明检查不是实机 PASS，仍需运行时 protocolVersion=2 和结构化验收。命令不启动 Java/MC、不下载依赖、不发布或修改账户插件。

Observer 的构建源码为 bridge-mod，使用 JDK 21、Gradle 9.5 的 `build --no-daemon`；Gradle 缓存完备时加 `--offline`。本轮在仓库外的源码副本按现有 Gradle 启动方式构建；发布版旧 JAR 不能冒充当前源码构建。现有 bridge:build 仍使用旧 runtime/resources 工具链定位；显式系统工具链可按同等 Gradle 命令构建副本，无需改原 main。

## 首次使用顺序

将整个产品目录复制到仓库外。准备一个专用可写数据根，使用 MCP 连接 `plugin/dist/mcp-server.js`，设置 MODCRAFTING_DATA 为该绝对目录。Node 命令可用绝对路径；使用 plugin/.mcp.json 时，cwd 是 plugin/。

1. `modcrafting_environment_status(projectPath)`：检查系统 JDK 21 和工程 Wrapper，另读 assets/capabilities；ok 不等于游戏已就绪。JDK 的 bin 需在本轮 PATH，JAVA_HOME 与它一致。Core 不安装 JDK；执行 Wrapper 时可能下载固定 Gradle 分发和工程依赖。
2. `fabric_project_inspect`、`fabric_validate`：提供自己的 Fabric 1.21.4 工程及 Wrapper；MCP 新建工程包含固定 Gradle 9.5.0 Wrapper，已有工程需自带 Wrapper。源码修改前按需 `minecraft_data_lookup`，知识搜索目前是关键词。
3. `modcrafting_prepare_assets`：显式下载知识/基础模组，诊断每项成功及落盘路径。P2-04 实测五个 Release 包的大小和 SHA-256 匹配；这不意味着包中 Observer 的协议兼容。
4. **当前公开 v1.0.1 的 base-mods.zip 仍含 V1 Observer。资源准备完成后，游戏启动前，将本产品的 V2 覆盖到自己的插件资源缓存。** 不要将 V1 和 V2 两个同 ID 的 JAR 同时放入 mods。再次运行 prepare_assets 后需重新执行此兼容步骤；远端资源尚未更新。

```powershell
# 在产品根目录执行；目标必须是本次专用数据根
$dataRoot = 'path/to/your/core-data'
Copy-Item -LiteralPath './observer/modcrafting-observer.jar' -Destination (Join-Path $dataRoot 'assets/base-mods/modcrafting-observer.jar')
```

5. `fabric_build_start` → `fabric_job_status`：构建退出 0；首次依赖可能联网，不能把预热缓存验收称为冷 Gradle 下载。
6. `minecraft_run_client`：显式独立 gameDirectory，等待 runtime_status 的 bridgeReady 和 protocolVersion=2，再进入 **ModCrafting Test World**。普通存档不参加自动动作/清理。预留区域 x/z [-16,16]、y [96,112]。
7. `minecraft_test_start` → `minecraft_test_status`：使用 V2 spec 的 setup/actions/assertions/cleanup，读取 acceptance、code、cleanup 和 reportPath。有效证据、不同请求标识与完整清理才可 PASS。
8. `minecraft_stop_client` / `fabric_job_stop` 后轮询任务结果；停止请求被接受不等于子进程已退出，保留原报告与失败证据。

通过 MCP 的操作共享同一个 FabricRuntime 所有者。Bench CLI 是独立验证入口，自己启动作业，不会读取另一个进程的任务状态。

## Bench 与可选展示接口

```powershell
node ./bench/run-fabric-bench.mjs --mode fixture --run-root 'path/to/results'
node ./bench/run-fabric-bench-live.mjs --project 'path/to/fabric-project' --data-root $dataRoot --run-root 'path/to/results' --java-home 'path/to/jdk-21' --gradle-user-home 'path/to/gradle-cache'
```

live CLI 复制工程、Observer 和可选专用世界，每次新建运行根；保留来源和旧证据。完整参数在 bench/README.md。fixture 21 例的匹配不是游戏验收；live 十例预期为 5 PASS / 3 FAIL / 2 INCONCLUSIVE，匹配数与真实三态分别记录。

支持库存、方块、实体类型、快照值和变化。实体标签、HUD、command_result、trace 来源仍有能力限制；截图只作辅助证据。Wiki 关键词查询不等于向量语义检索。当前十例验证原版游戏/Observer/报告管线，不验证任意模组。

P3 可选 Agent/浏览器/游戏内入口读取 contractVersion=1 的环境/资源、项目、JobSnapshot、GameRuntimeStatus、日志、截图/报告与三态；必要操作复用同一 Core 所有者。浏览器需受控提供后端产物，不能直接使用本地文件路径。浏览器已实现并共享单进程 Core 状态；MCP Apps、新游戏界面和多进程状态共享尚未实现。P5 导入路径可从环境工具 projectCatalog 与浏览器工程选择读取，迁移步骤见同包 MIGRATION.md。

本地交付不是远端发布或跨机器验收。原有 21 个 Harness 失败和 23 条类型错误独立登记；远端 Actions、冷工具链下载、其他 OS/MC 版本及用户账户插件升级不属于本轮已验证能力。
