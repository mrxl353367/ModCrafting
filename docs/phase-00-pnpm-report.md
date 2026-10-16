# P0.5 pnpm 迁移验证报告

日期：2026-10-13。状态：**依赖迁移及启动兼容性完成，既存失败已隔离记录；用户授权开始 P1**。

依赖迁移、开发启动及打包 EXE 启动已验证；后续排查修复了 EXE 超时和依赖版本收集错误。完整 CI 的 23 条类型错误、21 个 Harness 失败与隔离 npm 基线完全相同。Setup/Portable 的实际安装流程仍未验证。最新用户指令为开始 P1，按阶段文档保留既存失败，不扩大修复范围。

## 安全范围

- 所有修改位于新 `ModCrafting-mcp-p1` Worktree 的 `feat/mcp-foundation-p1` 分支，起点为 `6e6851293c65133b9bf44bdc5d1295a5e7ca7360`。
- 原 main 为 `b40e1fa522cf87280b72ace2480417e051b908fa`，原未跟踪文件列表与 SHA-256 均保持不变。
- 本地备份分支已建立；远端备份待授权。没有提交、push、tag 或发布。
- 已仅从新 Worktree 移除跟踪的 `package-lock.json`，正式锁为 `pnpm-lock.yaml`。原 main、Git 历史和隔离 npm 对照目录仍保留原锁；没有删除用户未跟踪文件。
- 对照测试只在本次新建的 `temp/pnpm-verification/baseline-source/` 中执行；没有在原 main 上安装依赖或运行会写入文件的测试，没有删除用户未跟踪文件。

## 实现与复用

| 位置 | 修改 |
|---|---|
| `package.json`、`.npmrc`、`pnpm-lock.yaml` | 固定 pnpm 10.34.7；采用 hoisted 布局与默认 auto 导入；关闭原生 side-effects 缓存；最小脚本许可为 electron/esbuild/node-pty/sharp；明确禁止不必要的 protobufjs/electron-winstaller 安装脚本 |
| `scripts/plugin/build.mjs` | 使用 esbuild 公开入口，显式直接依赖为原锁已存在的 0.28.2，满足 Vite peer 约束 |
| `scripts/setup-worktree.mjs` | Windows pnpm shim 启动；检查全部直接依赖、正式/已安装锁、manifest/config；缺失时冻结锁安装；保留 Electron 缓存恢复与 items.ts 复制/生成 |
| `scripts/lib/ensure-native-deps.mjs` | 验证 Electron 可执行与 esbuild 真实转换；只在不可用时修复；修复失败返回非零 |
| `scripts/prebuild-win.mjs`、`.github/workflows/release.yml` | 脚本入口改为 pnpm；CI 固定相同 pnpm、使用 pnpm cache 与 frozen lock；发布步骤未执行 |
| `scripts/packaging/patch-nsis-install-ui.mjs` | 以工作区内临时文件替换模板目录项，避免原地写穿 pnpm Store 的硬链接；已验证改写后链接数为 1 |
| `package.json`、`electron-builder.portable.json` | 移除错误的 readable-stream 排除规则；固定 electron-builder 26.17.0，复用上游 pnpm 嵌套依赖版本修复 |
| `scripts/packaging/verify-windows-artifacts.mjs`、`smoke-windows-app.mjs` | ASAR 检查 unzipper 的实际 readable-stream 解析位置和版本范围；实际 EXE 烟测使用隔离 profile、15 秒硬超时及本次子进程树清理 |
| `scripts/test/verify-native-deps.mjs` | 可重复的 esbuild、两版 sharp、Electron Renderer 与 node-pty 冒烟；隔离 profile 与硬超时 |
| `README.md`、`AGENTS.md`、`docs/commands.md`、相关命令文档断言 | 明确当前分支 pnpm 用法、旧 npm 工作区兼容与独立 node_modules 原则 |

没有建立多包 workspace，没有改 MCP 工具、Core 游戏测试逻辑或旧 Harness 业务代码。

参考 [Electron 官方包管理说明](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app)、[pnpm Store/安装配置](https://pnpm.io/10.x/settings)。10.11.0 仅用于初始锁文件导入；正式候选固定 10.34.7，以覆盖已公布的 [hoisted 路径穿越修复](https://github.com/pnpm/pnpm/security/advisories/GHSA-fr4h-3cph-29xv) 和 [tarball 路径穿越修复](https://github.com/pnpm/pnpm/security/advisories/GHSA-vq4v-j7r6-jq4m)。

初次迁移的锁文件对比：原 npm 锁包含 733 个唯一包名/版本组合，pnpm 锁为 732；未新增包版本，仅去掉冗余 `fs-extra@11.3.5`。根 esbuild 复用原锁的 0.28.2，electron-vite 仍保有其 0.25.12。后续启动修复明确将打包器由 26.15.3 固定到 26.17.0，其锁差异仅涉及六个打包工具组件版本替换及新增 `@noble/hashes@1.8.0`；生产依赖版本未升级。差异证据为 `temp/packaging-startup-repair-20261013/builder-lock-diff.json`。

## 实测结果

本机 Node 24.19.0；另在本次专用临时目录下载官方 Node 22.23.3 Windows x64 ZIP，并以同目录官方 SHA-256 清单校验。后者仅通过进程 PATH 使用，没有修改本机 Node 安装或原 main。

| 验证 | 实际结果 |
|---|---|
| `pnpm import` | 完成，网络出现 ECONNRESET 后重试成功 |
| `pnpm install --frozen-lockfile` | 首次完成约 2 分 15 秒，613 个安装包；复用 91、下载 511；安装脚本成功 |
| 冻结锁重复安装 | 完成约 4.4 秒；没有再次下载 Electron；先前未审批的 protobufjs 提示已明确设为 ignored，`pnpm ignored-builds` 确认没有自动忽略待审脚本 |
| `pnpm run setup:worktree` 连续两次 | 均通过，均跳过安装；第一次只从主 checkout 读取复制生成 items.ts，第二次全部就绪；补充检查全部直接依赖后复测亦通过 |
| `plugin:build` / `plugin:validate` / `plugin:test` | Node 24 与 Node 22 均通过；旧 plugin:test 仍是注册自测，不代表真实 MCP 协议验收 |
| `pnpm run verify:native` | Node 24 与 Node 22 均通过：esbuild 转换、sharp 0.35.2、传递 sharp 0.32.6、Electron 42.4.1 渲染窗口、node-pty 启动与输出 |
| `pnpm run typecheck` | 失败，23 条错误；隔离 npm 原锁基线同为 23 条，错误逐条完全相同 |
| `pnpm test` | 763 条，742 通过、21 失败；隔离 npm 原锁基线同为 742/21，失败用例集合完全相同；迁移新增失败为 0 |
| `pnpm run build` | 通过；保留现有动态/静态 import 重叠与 chunk 提示 |
| Windows x64 `--dir --publish never` | 初次 26.15.3 仅目录打包通过；后续 26.17.0 的 Setup 配置（Node 24）和 Portable 配置（Node 22）均通过目录打包、ASAR 依赖范围检查与实际 EXE 启动 |
| 开发版实际应用 `--smoke-test` | 通过：renderer、preload IPC 与资源加载；使用专用 automation profile；退出时有既有 automation:emit 未注册提示 |
| 打包 EXE `--smoke-test` | **已修复并通过**：最终 Setup 配置目录包约 1.8 秒、Portable 配置目录包约 1.75 秒收到 renderer/preload IPC 就绪标记，退出码均为 0；不是只加载 ASAR 的替代测试 |
| ASAR 内代码隔离诊断 | 用本机 Electron 与专用 profile 显式加载 ASAR 的 main，renderer/IPC 冒烟通过；仅说明归档内代码可加载，不能代替品牌化 EXE 启动 |
| Release workflow | YAML 解析、固定 pnpm 版本、pnpm cache/install、参数转发干运行通过；没有执行远端 Actions 或任何发布步骤；其 typecheck/test 门禁仍会受既存失败阻断 |
| 真正 Setup/Portable 安装器 | 未执行，不能由 `build` 或目录打包推断兼容 |

原生冒烟首次把两版 sharp 放入同一 Windows 进程导致 libvips 冲突。测试改为各自独立进程后通过，没有更换生产依赖或将失败隐藏为跳过。

原 main 没有可用的 TypeScript 安装，因此不在该工作区补装。真实 npm 对照使用 `git archive origin/main` 的隔离源码与原 `package-lock.json`，执行 `npm ci --ignore-scripts --no-audit --no-fund` 后运行类型与 Harness 验证；该对照不用于声称 npm 原生生命周期通过。错误主要涉及 fast-compile、mixin-precheck、SettingsCenter、routing-classifier、workflow-engine 和 model-routing，均未在此次迁移中修改。

## Store 与磁盘证据

- Store：`D:\.pnpm-store\v10`，与新 Worktree 同卷；各 Worktree 保持独立 node_modules，无共享 junction、虚拟 Store 或原生目录。
- `fsutil hardlink list node_modules/react/index.js` 同时列出当前 Worktree 文件与 Store 对应文件，实际链接数为 2。
- Electron EXE 与 node-pty 生成的 conpty DLL 链接数为 1，原生安装产物独立。
- node_modules 逻辑大小约 953.4 MiB（999,708,293 字节）。按 Windows FileStandardInfo AllocationSize 与唯一文件 ID 统计，引用的唯一分配约 944.0 MiB（989,818,632 字节），其中多硬链接文件引用约 431.4 MiB（452,391,160 字节），单链接文件约 512.5 MiB（537,427,472 字节）。
- 这不是对整个磁盘的精确新增占用或节省比例：共享分配还由 Store 引用，统计不含文件系统元数据，也不含 Node 22、npm 对照、Windows 打包和测试 profile 的临时占用。普通目录属性的逻辑大小不能当作重复物理占用。

## 阻塞与后续顺序

1. 打包 EXE 启动超时已修复，npm/pnpm 对照、最终两种目录包的启动和 ZIP 解压验证通过。真实 Setup/Portable 安装、升级、卸载流程仍未执行。
2. 当前 CI 基线确实为红：23 条类型错误和 21 个既存 Harness 用例失败。不要顺便大规模修复或削弱测试。未取得相应范围授权时保留原有失败记录。
3. 唯一正式锁已切换为 pnpm；按最新授权开始 P1-01 → P1-06。当前改动没有提交；原 main 与原 npm 锁始终可用。
4. 原未跟踪日志、阶段文档和缓存均保留。本次生成的对照与日志也保留在专用 temp 目录，没有自动删除。

本次证据位于 `temp/pnpm-verification/`：`baseline-comparison.json`、`disk-usage.json`、`typecheck.log`、`harness.log`、`baseline-typecheck.log`、`baseline-harness.log`、`build.log`、`windows-package.log`、`dev-smoke.log`、`packaged-smoke*.log` 与诊断日志。此目录不入库。

## 2026-10-13：打包 EXE 启动修复

**对照条件**：隔离 npm 基线使用原锁安装的独立 node_modules，与 pnpm 工作区使用同一份 Electron 42.4.1 分发文件进行目录打包；不直接共享 node_modules。npm 与 pnpm 的 ASAR 主进程入口 SHA-256 完全相同。

**根因**：两种打包配置都写了 `!node_modules/readable-stream/**`。主进程静态导入的 `unzipper → duplexer2` 实际需要 readable-stream。npm 包保留了嵌套 `duplexer2/node_modules/readable-stream@2.3.8`，pnpm 原包则完全没有此依赖，启动未进入 renderer smoke 就绪阶段，表现为超时。先只移除两条排除规则后，pnpm EXE 在约 1.7 秒内启动，确定了因果关系。

**进一步正确性检查**：旧 electron-builder 26.15.3 将此依赖错收集为根目录 v3.6.2，超出了 duplexer2 的 `^2.0.2` 声明。采用 [上游 v26 修复](https://github.com/electron-userland/electron-builder/pull/10230)，固定到 [26.17.0](https://github.com/electron-userland/electron-builder/releases/tag/electron-builder@26.17.0)，最终包恢复了正确的嵌套 v2.3.8。许可证沿用已有 MIT；没有自制依赖收集器、修改 node_modules 源码或添加业务依赖。

**回归防线**：原有 Windows 产物检查器增加 `--dir <win-unpacked目录>` 支持，并用已有 ASAR/semver 能力检查缺失依赖和错误版本。原缺失依赖包及“只移除排除规则、但仍误收集 v3”的中间包均能稳定被拒绝，npm 原包和最终包通过。`pnpm run smoke:win <EXE路径>` 同时要求就绪标记、退出码 0、未超时，保留 stdout/stderr；超时只结束本次启动的子进程树，不删除文件。

**最终验证**：

- Node 24.19.0 + Setup 配置目录包：打包、依赖检查、实际 EXE 启动通过（1,799 ms）。
- Node 22.23.3 + Portable 配置目录包：打包、依赖检查、实际 EXE 启动通过（1,747 ms）。
- 最终 ASAR 解开到测试专有目录后，限制 Node 解析不得回退到源码依赖；确认 duplexer2 在包内解析 v2.3.8，ZIP 中央目录读取和两种解压路径通过，中文文本与二进制内容一致。
- 冻结锁安装通过（约 2.4 秒）；两版 Node 的原生依赖复测通过。
- 因本轮更新打包工具，重新运行 typecheck/Harness：仍为完全相同的 23 条类型错误与 21 个失败用例，新增失败 0；没有修改旧 Harness 业务代码。
- 本轮没有启动 MC、安装正式 Setup/Portable、执行发布、提交或推送，没有修改原 main 或删除用户未跟踪文件。

修复证据在 `temp/packaging-startup-repair-20261013/`：`npm-before-result.json`、`pnpm-before-result.json`、`asar-diff.json`、`builder-lock-diff.json`、`final-setup-package.log`、`final-portable-package.log`、`final-zip-probe.log`、`final-baseline-comparison.json`。最终 EXE 分别位于该目录的 `final-setup-package/win-unpacked/ModCrafting.exe` 与 `final-portable-package/win-unpacked/ModCrafting.exe`。完整启动证据另存于 `temp/packaged-smoke/run-y53ef3/` 和 `run-vc3wc6/`，临时证据均保留且不入库。
