# pnpm Worktree 迁移与基线隔离

**归档日期**：2026-10-13<br>
**触发方式**：构建流程修改自动归档<br>
**问题类型**：依赖配置、构建脚本与验证

## 背景与边界

按 P0 → P0.5 → P1 顺序执行，原 main、未跟踪文件与凭证不动。新工作区从已核实的远端主线创建，只建本地备份分支，不提交或推送。

## 关键决策

- 固定 pnpm 10.34.7，采用 Electron 官方推荐的 hoisted 布局。Store 复用普通包文件，Worktree 各自保留 node_modules，关闭原生 side-effects 缓存。
- esbuild 改为公开直接依赖，不依赖 electron-vite 私有目录。
- NSIS 模板修改必须先写新文件再替换目录项，避免改写 Store 硬链接；实测补丁后链接数为 1。
- setup:worktree 检查所有直接依赖与已安装锁；冻结锁和 manifest 校验避免每次会话全量重装。
- Windows 进程中两版 sharp/libvips 会冲突，冒烟测试必须分别在独立进程执行。

## 首轮验证与状态

Node 24.19.0、22.23.3 下的插件旧自测、Electron Renderer、esbuild、sharp 与 node-pty 均通过；两次初始化跳过安装。普通 React 文件经 fsutil 确认与 Store 硬链接；Electron 和生成的 ConPTY DLL 为独立单链接文件。

隔离源码快照与原 npm 锁的对照复现完全相同的 23 条类型错误和 21 个 Harness 失败。基线失败须如实记录，不能为使新流程通过而削弱测试。

Windows 目录打包成功，开发版和显式加载 ASAR 的 renderer/IPC 烟测成功；品牌化 EXE 自身启动超时，尚未定位。P0.5 保持 PARTIAL，保留 npm 锁作回退对照，P1 未开始。完整命令、文件清单、磁盘统计口径与证据入口见 [P0.5 报告](https://github.com/newstarbar/ModCrafting/blob/main/docs/phase-00-pnpm-report.md)。

## 经验

安装、编译、ASAR 内容检查和真正 EXE 启动是不同验证层级。只有前面几层通过时，不能宣布 Windows 打包兼容。恢复工作应从此启动阻塞继续，先取得可复现根因，避免重复安装或随机改写业务代码。

## 同日更新：打包启动超时修复

触发：复杂打包兼容性问题修复与构建验证改动。P1 仍未开始。

同一份 Electron 42.4.1、相同 ASAR 主进程入口下，npm 目录包 1.8 秒启动，pnpm 原目录包超时。根因为 Setup/Portable 配置排除了根目录 readable-stream，npm 的嵌套副本幸存，pnpm 包则缺失 unzipper 所需依赖。移除两条排除规则后启动通过。

依赖范围审查进一步发现旧打包器把 duplexer2 的 v2 依赖错收集为 v3。固定 electron-builder 26.17.0，复用上游 #10230 修复后，正确嵌套 v2.3.8 恢复，未自写收集器或修改依赖源文件。

关键改动：`package.json`、`pnpm-lock.yaml`、`electron-builder.portable.json`、`scripts/packaging/verify-windows-artifacts.mjs`、新增 `scripts/packaging/smoke-windows-app.mjs`。检查器现在同时拒绝缺失依赖与不满足声明范围的版本；实际 EXE 烟测使用专用 profile、就绪标记、退出码和 15 秒硬超时。

最终 Node 24 下的 Setup 配置目录包和 Node 22 下的 Portable 配置目录包均约 1.8 秒启动；包内 ZIP 中央目录读取、文件解压与流式解压通过，解析禁止回退到源码 node_modules。冻结锁与原生复测通过；重新执行基础测试后，23 条类型错误和 21 个 Harness 失败与原 npm 基线逐条一致。

实际安装器安装/升级/卸载与 MC 功能仍未验证。P0.5 保持 PARTIAL，仅剩既存 CI 失败及未验证边界；原 main、用户未跟踪文件和原 npm 回退锁保持不变，没有提交或推送。详细证据与命令见 [P0.5 报告](https://github.com/newstarbar/ModCrafting/blob/main/docs/phase-00-pnpm-report.md)。
