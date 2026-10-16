# 可移植 Fabric-Bench

P2-03 入口直接调用 FabricRuntime 和 executeGameTest，复用 MCP 的作业、桥接与报告。fixture 和 live 分开执行；不调用模型、不需要 Codex 私有验收驱动或 Electron。

## 离线与交付包

```powershell
pnpm run bench:fabric --mode fixture
pnpm run bench:fabric path/to/fixture-suite.json --run-root path/to/results
pnpm run bench:build
```

最后一条在新建的 `temp/bench-artifacts/fabric-bench-*` 目录输出两个自包含 `.mjs`、两套案例、说明、GPL-3.0/MIT 许可证和 manifest 指纹。复制完整交付目录到仓库外；无需复制源码、node_modules 或 pnpm Store。

```powershell
node ./run-fabric-bench.mjs --mode fixture --run-root ./results
node ./run-fabric-bench-live.mjs --help
```

Node 22.15+ 或 24；fixture 不要求 Java、游戏或网络。CI 只执行构建、协议和夹具，不执行 live 命令。manifest 保存构建输入和文件 SHA-256；每次报告另存实际执行入口（源码或 bundle）及案例 SHA-256。

## 实机环境与命令

Windows x64、可用的图形会话、JDK 21、Fabric 1.21.4 工程（含 gradlew.bat、Wrapper JAR/配置）、Observer V2 的真实 base-mods JAR 是必要输入。工程 Wrapper 与 Fabric 依赖由提供者准备；Core 不自动安装 JDK/Gradle。首次 Gradle 运行可能下载依赖，缓存完备时才使用 `--offline`。

准备 Core 数据根，Observer 放在 `<data-root>/assets/base-mods/`。可通过 MCP 的 `modcrafting_prepare_assets` 显式下载；live CLI 将 Observer 复制到本轮独立数据根，不下载/覆盖来源，也不在来源创建报告/知识目录。知识资源不是这十个原版实机断言的前置条件，来源与运行根的诊断会如实列出缺失项。

P2-04 确认公开 base-mods.zip 的 V1 Observer 不支持当前 V2。使用完整本地产品中的 `observer/modcrafting-observer.jar`（2.0.0）覆盖自己的数据根缓存后，再运行 live；再次准备资源后需重新覆盖。原始下载 ZIP 保留，兼容 JAR 来源与指纹另记。完整交付与步骤见仓库的 docs/product-handoff.md；只取得原 9 文件 MCP Stage 不包含这个兼容资源。

```powershell
pnpm run bench:fabric:live --project "path/to/fabric-project" --data-root "path/to/core-data" --run-root "path/to/results" --java-home "path/to/jdk-21" --gradle-user-home "path/to/gradle-cache"
# 仓库外交付包：相同参数
node ./run-fabric-bench-live.mjs --project "path/to/fabric-project" --data-root "path/to/core-data" --run-root "path/to/results" --java-home "path/to/jdk-21" --gradle-user-home "path/to/gradle-cache"
```

`--java-home` 仅为本轮进程设置 JAVA_HOME/PATH；不提供时使用已有环境。`--gradle-user-home` 仅为本轮设置 Gradle 缓存目录。Wrapper 必须可移植（例如官方 HTTPS distributionUrl），不能依赖另一台机器的 file: 绝对路径。

可选 `--suite live-suite.json`、`--offline`、`--timeout-ms 300000`（每个构建/启动/世界等待阶段）、`--case-timeout-ms 30000`。自定义案例仍由 Core V2 Schema 校验；重复 case/scenario ID 或 fixture 套件在启动前拒绝。案例中 prepare 和命令是受信任的开发脚本，应限于专用世界/预留区域。

## 隔离、世界与清理

每轮在 run-root 中新建 `run-*`，复制工程时排除 .git、.gradle、build、run、node_modules 和 .env 文件，不读取它们的正文；拒绝符号链接/junction，输出不能在输入工程或世界内。构建写入本轮工程副本；源工程不变。Gradle 会按显式缓存目录写入依赖，复制工程不等于完全离线或无缓存写入。

默认在全新的 gameDirectory 自动创建 `ModCrafting Test World`，仅此副本写入中文界面设置并启用命令。可使用 `--world ".../ModCrafting Test World"` 复制一个已退出游戏的专用测试世界（需 level.dat）；不会在原世界中启动。CLI 依赖 Observer 的界面控件与当前 1.21.4 中文界面，不支持任意菜单/其他 MC 版本。

进入世界后必须观察到精确世界名，每次 prepare/bootstrap 命令重查世界。内置用例仅使用 Core 预留区域 x/z [-16,16]、y [96,112]；场地初始化范围更小。源世界和普通存档不参与自动清理。自定义 suite 由执行者负责命令范围，世界门控不是通用 Minecraft 命令沙箱。

Core 每个场景在 finally 执行 cleanup；故意清理失败的用例仍为 INCONCLUSIVE/CLEANUP_FAILED，不用额外清理伪造 PASS。运行结束、超时或 Ctrl+C 均停止本轮持有的作业，并等待工作线程/子进程收敛，保留停止证据。强制关闭终端或操作系统杀死整个 CLI 不能保证 finally；没有确认收敛时报告 STOP_UNCONFIRMED。运行副本和报告全部保留，不自动删除或覆盖旧运行。

## 结果与限制

run-* 包含 suite.json、options.json、环境/构建诊断、逐例 test-*.json、Core 原始报告、项目/Observer/构建 JAR 指纹、截图响应、最终 report.json/report.md 和 shutdown 作业信息。缺失前置条件会退出 1 并保存诊断；非法输入可能在创建运行目录前拒绝。

匹配 verdict/code 与实际三态计数分开。内置 live 预期 10/10 匹配，实际 5 PASS / 3 FAIL / 2 INCONCLUSIVE；预期失败属于基准匹配，绝不变成游戏 PASS。任一预期不匹配、未执行案例或未确认停止退出 1；协作取消退出 130。截图仅是辅助证据。

实体标签断言、HUD、command_result 和 trace 源仍受 Core 能力限制。默认十例验证原版游戏/Observer 与报告管线，不等于验证任意用户模组功能。远端 CI、首次真实资源下载以及 P2-04 的完整独立产品交接需分别验收。

实现复用了 Node 官方 [parseArgs](https://nodejs.org/docs/latest-v22.x/api/util.html#utilparseargsconfig) 和 [fs.promises.cp](https://nodejs.org/docs/latest-v22.x/api/fs.html#fspromisescpsrc-dest-options)，构建沿用项目已安装的 esbuild；没有新增依赖。
