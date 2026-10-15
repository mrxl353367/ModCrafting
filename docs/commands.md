# 常用命令

以下内容以当前 `package.json` 为准。Windows 本地开发使用 PowerShell；`test:app:*` 会启动真实 Electron 进程。

本分支使用 pnpm 10.34.7，安装命令为 `pnpm install --frozen-lockfile`；P0.5 验收前保留 npm 锁作回退对照，验收后仅保留正式 `pnpm-lock.yaml`，不提交双锁。当前状态见 [迁移报告](./phase-00-pnpm-report.md)。旧 npm 主工作区无需迁移。Store 可跨 Worktree 复用，各工作区的 `node_modules` 和原生构建输出必须独立；不要复制或共享 `node_modules`。`.npmrc` 采用 Electron 兼容的 hoisted 布局，Store 路径由本机 pnpm 配置决定，不将个人路径写入仓库。

## 本地候选与真实模组验收

`pnpm run candidate:build` 使用系统 JAVA_HOME 的 JDK21，从源码构建 Observer 和完整跨宿主包；--offline 要求预热 Gradle 缓存。`pnpm run acceptance:first-use -- --help` 显示专用世界实机验收参数，显式运行 MC，不进无游戏 CI。见 [候选指南](./candidate-validation.md)。

## 开发与基础验证

P3 可选浏览器：`pnpm run plugin:build` 后 `pnpm run view:start`，打开 stderr 的完整链接；前端类型检查为 `pnpm run view:typecheck`。仓库外包使用 `node ./plugin/dist/mcp-server.js --web-only`，或由 MCP 客户端加 `--web` 共用状态。环境与 V2 资源要求见 [浏览器指南](./browser-view.md)。

P4 本地分发：`pnpm run host:stage --product-dir "已验证产品目录"` 新建三宿主包；`pnpm run host:config -- --host claude --plugin-dir "绝对插件目录" --data-root "独立绝对数据目录" --output "新绝对JSON文件" --web` 仅生成配置。`pnpm run host:smoke -- "分发目录"` 为 SDK/config 验证，原生宿主证据单列。说明见 [跨 Agent 分发](./host-distribution.md)。

```bash
pnpm run dev              # 重建独立 MCP 后启动浏览器；改源码后重启
pnpm run build            # 构建独立 MCP、Bench 和迁移 CLI，不运行 Java/游戏
pnpm run start            # 启动已构建的可选浏览器工作台
pnpm run test             # 独立 Core/MCP、浏览器、分发、迁移回归
pnpm run test:harness     # 旧全仓 Harness 基线（自动收集 harness-*.test.ts）
pnpm run test:ui          # UI 组件 snapshot 测试（Vitest + Testing Library）
pnpm run test:ui:update   # 更新 UI snapshot 基线
pnpm run setup:worktree   # 新 git worktree 环境自举（可重复执行）
pnpm run verify:native    # esbuild、两版 sharp、Electron Renderer 与 node-pty 冒烟
```

P5 数据迁移：`pnpm run desktop:migrate -- --user-data "绝对配置目录"` 默认只读；显式 --apply --data-root 导入到新目录。`pnpm run migration:build` 构建独立命令；详细功能替代、保留/回退和旧发布退出见 [Desktop 退役指南](./desktop-retirement.md)。

旧 Electron 命令为 `pnpm run desktop:setup`、`pnpm run desktop:dev`、`pnpm run desktop:build`、`pnpm run desktop:start`、`pnpm run desktop:preview`、`pnpm run desktop:typecheck`。默认 `pnpm run typecheck` 仅检查新 Core/MCP 与浏览器。`build:win*` 仍是旧 EXE 兼容命令，不能作为新产品分发。旧远端写入脚本为 desktop:release:publish，须单独授权；tag 不再自动发布。

### 新 worktree 环境自举

`pnpm run setup:worktree`（`scripts/setup-worktree.mjs`）默认只安装独立依赖（--ignore-scripts）并恢复 esbuild。只有 `--desktop`（或 desktop:setup）才执行下列 Electron/Renderer 兼容步骤：

| 步骤 | 处理 |
|---|---|
| 依赖 | `node_modules` 缺少关键依赖、已安装锁文件与正式锁不一致或 manifest/config 不匹配时执行 `pnpm install --frozen-lockfile` |
| Electron 二进制 | 缺失时执行安装脚本，优先复用本机 Electron 下载缓存；缓存缺失时可能联网，不能保证离线恢复 |
| `src/renderer/src/data/items.ts` | 生成物且已 gitignore；优先从 `git worktree list` 的主 checkout 复制，否则回退 `pnpm run assets:items` |

非 ModCrafting 目录会直接退出 0。加 `--force` 可强制重装并重做全部步骤。工具链数据目录（JDK/Gradle/Fabric）不在其列：dev 与安装版都读「设置 → 修改数据目录」写入的 `runtimePath`，见 [toolchain.md](./toolchain.md)。

## 旧 Desktop Harness Test Lab（兼容验证）

```bash
pnpm run test:mcp         # Test Lab MCP 构造、Schema 与工具发现烟测
pnpm run test:mcp:serve   # 通过 stdio 启动开发专用 MCP Server
pnpm run test:app         # 前台 Electron + 本地回放 Provider 的确定性应用回归
pnpm run test:app:hidden  # 隐藏 Electron 的无人值守/CI 兼容回归
pnpm run test:app:live    # 前台真实 Provider 低频烟测
pnpm run test:app:game    # 前台真实 Provider + Minecraft/Observer 烟测
pnpm run bridge:build     # 构建 Observer V2 并复制到 resources/_base_mods/
```

`test:app` 与 `test:app:hidden` 是旧 Desktop 的兼容门禁；独立新产品默认使用 pnpm test。`test:app:live` 和 `test:app:game` 依赖本机 Provider、网络、Minecraft 和 Observer，允许生成 `INCONCLUSIVE` 报告；不得把它转换为自动修复信号。

Standalone runner 的产物位于系统临时目录 `modcrafting-app-test/<runId>/artifacts/`；MCP 启动的运行位于 `%LOCALAPPDATA%/ModCrafting Test Lab/runs/<runId>/artifacts/`。详见 [Test Lab MCP](./test-lab-mcp.md)。

## Fabric-Bench MVP（P2）

```bash
pnpm run bench:fabric --mode fixture    # 离线运行内置 21 个案例
pnpm run bench:fabric path/to/suite.json # 指定 fixture Schema 的案例集
pnpm run bench:build                    # 输出自包含 fixture/live 命令与案例包
pnpm run bench:fabric:live --help        # 查看独立实机命令参数
pnpm run product:stage --help           # 组装 MCP + Bench + 显式 Observer V2 的完整本地产品
```

直接复用 Core 执行器，execution=fixture，不启动游戏或调用模型。预期 verdict/code 匹配数与 PASS/FAIL/INCONCLUSIVE 数量分别报告，模拟通过不能算真实游戏验收。每次生成独立 temp/fabric-bench/run-*，包含输入案例、JSON/Markdown 报告、Node/平台及案例/源码 SHA-256；不覆盖旧证据、不删除缓存。匹配失败退出码为 1；格式非法在执行前拒绝。统一摘要规则和边界见 [P2 范围](./phase-02-acceptance-bench.md)。

实机案例包 `scripts/bench/fabric-bench-live-mvp.json` 为另一种验收输入，不能交给离线 CLI。P2-03 新增独立 live CLI，可指定工程、Core 资源根、输出根、JDK/Gradle 缓存、案例集及专用世界副本。工程/世界/Observer 均复制到本轮目录，通过 Core runtime 构建、启动、结构化测试和停止，不依赖 P1 工程或 Codex 私有驱动。完整参数与仓库外执行方式见 [Bench 使用说明](./fabric-bench.md)，实际证据见 [当前 P2 报告](./phase-02-core-report.md)。

P2-04 新增 `product:stage --bench-dir <Bench 构建目录> --observer-jar <已构建 V2 JAR> [--observer-sources <源码 JAR>]`，校验并复制到新的 temp/product-artifacts/modcrafting-*，包含 manifest 指纹、许可与完整使用顺序；不自动启动 Java/游戏、不发布。公开资源包仍含 V1，准备后要使用产品附带的 V2 覆盖自己缓存，步骤见 [产品交接](./product-handoff.md)。

## Windows 构建

```bash
pnpm run build:win           # Setup + Portable，并验证两个产物
pnpm run build:win:setup     # 仅 NSIS Setup
pnpm run build:win:portable  # 仅 Portable
pnpm run smoke:win           # 隔离 profile，启动 release/win-unpacked/ModCrafting.exe；15 秒硬超时
```

目录打包验证可执行 `node scripts/packaging/verify-windows-artifacts.mjs --dir <win-unpacked目录>`，再执行 `pnpm run smoke:win <win-unpacked目录>/ModCrafting.exe`。烟测只验证真实 EXE 的 renderer/preload IPC 启动，退出码和就绪标记须同时通过；证据保存在本次专用 `temp/packaged-smoke/run-*/`，不读取保存的 Provider 配置、不验证真实 Minecraft。

`prebuild:win*` 由打包流程调用，用于准备对应 edition 的资源；一般不需要单独执行。

## 工具链

```bash
pnpm run toolchain:setup           # 准备 JDK 21 与 Gradle 9.5
pnpm run toolchain:verify          # 检查 JDK、Gradle、Wrapper
pnpm run toolchain:prefetch        # 预取 Fabric/Minecraft 离线依赖
pnpm run toolchain:verify-offline  # 真实验证离线构建
pnpm run toolchain:symbol-index    # 生成 Fabric 符号索引
pnpm run toolchain:export-zip      # 导出运行时压缩包
```

旧别名如 `setup:toolchain`、`prefetch:deps`、`verify:toolchain` 仍存在；新文档和脚本应使用 `toolchain:*`。

## 资源与知识库

```bash
pnpm run assets:prepare       # 准备 Minecraft Renderer 资源
pnpm run assets:mc            # 下载/解压 Minecraft 客户端资源
pnpm run assets:items         # 生成物品预览和索引
pnpm run assets:icon          # 生成 Windows ICO
pnpm run knowledge:download   # 下载全部预构建离线知识库
pnpm run docs:sync-fabric     # 同步 Fabric 官方文档知识源
```

Minecraft 版本升级后必须重新运行 `pnpm run knowledge:download`。知识库构建本身位于独立的 ModCrafting-knowledge-base 仓库。

## 发布

新产品目前只支持本地 product:stage / host:stage，无默认远端发布入口。旧 Desktop 仅保留以下显式兼容脚本，须开发者确认版本和远端写入授权：

```bash
pnpm run desktop:release:publish
```

该历史命令仍会写入 GitHub/Gitee，但标签推送不再自动运行旧 EXE 发布 CI；旧工作流改为对已有 v* tag 显式确认后手动派发。未获授权不得执行，迁移阶段不使用这些命令。见 [退役指南](./desktop-retirement.md)，根 RELEASE.md 保留历史流程。

维护用子命令：

```bash
pnpm run release:manifest
pnpm run release:notes
pnpm run release:push-gitee
pnpm run release:sync-gitee
pnpm run release:gitee-only
pnpm run release:cleanup-github
```

## 清理

```bash
pnpm run clean:local --all
```

清理属于破坏性操作；执行前确认目标仅为仓库生成物，不得手动递归删除工作区或 `runtime/`。

## 测试文件约定

`scripts/test/run-harness.mjs` 自动收集 `scripts/test/harness-*.test.ts`。主要测试层级：

| 层级 | 入口 | 典型覆盖 |
|---|---|---|
| Harness 单元/回归 | `pnpm test` | 计划、工具门控、分类、证据、修复范围、游戏协议 |
| UI 组件 snapshot | `pnpm run test:ui` | React 组件 DOM 结构快照与视觉回归检测 |
| MCP 协议烟测 | `pnpm run test:mcp` | stdio Server 构造、Schema 和工具发现 |
| 应用级回放 | `pnpm run test:app` | 真实 Electron/React/Controller/IPC 与活跃状态 |
| Observer | `pnpm run bridge:build` | Java/Mixin 编译及基础模组 JAR |
| 真实外部烟测 | `test:app:live` / `test:app:game` | Provider、Minecraft、Observer 和完整报告 |

多模型路由改动的推荐验证顺序为：`pnpm test`、`pnpm run test:mcp`、`pnpm run test:app`；涉及 GUI/游戏视觉审查时再运行 `pnpm run test:app:game`，发布构建前运行 `pnpm run build:win`。

## Codex 插件

```bash
pnpm run plugin:build       # 打包独立的 stdio MCP，并复制品牌图标
pnpm run plugin:test        # 独立 Core / 游戏验收回归，守卫阻止加载 Desktop/Electron
pnpm run plugin:validate    # 校验插件清单、技能和 MCP 配置
pnpm run plugin:stage       # 白名单交付到 temp/plugin-artifacts/modcrafting-fabric
pnpm run plugin:smoke       # 仓库外隔离目录中的真实 MCP 初始化/发现/调用
pnpm run plugin:typecheck   # 只检查插件及 Core 类型
```

本仓库的本地 marketplace 位于 `.agents/plugins/marketplace.json`，保留原安装格式；正式测试/交付优先使用 Stage，而不是复制整个源码目录。安装和最短连接步骤见 [插件 README](../plugins/modcrafting-fabric/README.md)。初始化不下载资源；用户显式调用资源准备后才写入独立持久数据根，优先 MODCRAFTING_DATA，并兼容 PLUGIN_DATA/CODEX_PLUGIN_DATA。协议与夹具通过不能代表真实游戏验收通过。

旧 Desktop 的兼容安全回归单独运行 `node --experimental-strip-types --test scripts/test/harness-desktop-game-test-compat.test.ts`，仍由全仓 Harness 自动收集，不进入 plugin:test。独立副本与旧失败基线的实际验证见 [当前 P2 报告](./phase-02-core-report.md)。

## 脚本目录

```text
scripts/
├── assets/       # Minecraft 渲染资源和图标
├── knowledge/    # 下载预构建知识库
├── lib/          # 共享 Node 脚本能力
├── mcp/          # 开发专用 Test Lab MCP
├── packaging/    # electron-builder / NSIS
├── release/      # 发布说明、tag 与 Gitee 同步
├── test/         # Harness、应用自动化、回放 Provider 和黑盒夹具
├── toolchain/    # JDK、Gradle、Fabric 离线依赖
└── prebuild-win.mjs
```
