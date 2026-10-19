# 命令清单

所有命令均从仓库根目录运行。Node.js 需为 22.15 或更新版本，包管理器使用 pnpm 10.34.7。

## 开发与定向验证

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run dev
pnpm start
pnpm run typecheck
pnpm test
pnpm run plugin:validate
pnpm run plugin:smoke
pnpm run bench:fabric
```

- `build` 构建自包含 MCP 插件及 Fabric-Bench CLI，不构建桌面应用。
- `dev` 重新构建插件后启动本地浏览器工作台。
- `start` 使用 `MODCRAFTING_DATA` 启动工作台后端。
- `test` 运行 Core、浏览器、游戏协议、分发和 Qoder 打包回归。
- `plugin:smoke` 在隔离目录验证 stdio MCP 初始化、Schema 和工具调用。
- `bench:fabric` 默认运行不启动 Minecraft 的离线案例。

## 插件与候选包

```powershell
pnpm run plugin:build
pnpm run plugin:stage
pnpm run plugin:qoder -- --source 'ABSOLUTE_CANDIDATE_PLUGIN_DIR'
pnpm run candidate:build
pnpm run acceptance:first-use
```

- `plugin:stage` 按白名单生成 Codex Plugin 目录。
- `plugin:qoder` 从候选插件目录生成 Qoder ZIP；输出在 `temp/qoder-artifacts/`。
- `candidate:build` 需要系统 JDK 21 和 `JAVA_HOME`，会构建 Observer V2 并生成完整本地候选包。
- `acceptance:first-use` 验证产品入口下的新 session 首次准备流程；它不代替 Qoder 真实聊天验证。

## 游戏与知识

```powershell
pnpm run bench:fabric:live -- --help
pnpm run product:stage -- --help
pnpm run host:stage -- --help
pnpm run host:config -- --help
pnpm run host:smoke
pnpm run docs:sync-fabric
pnpm run release:package -- --help
```

真实游戏验证需要 JDK 21、工程 Gradle Wrapper、Observer V2 和专用测试实例。工具连接成功、游戏启动成功和玩法断言通过是不同结果；只在日志中记录实际完成的阶段。`docs:sync-fabric` 更新仓库内 Fabric 文档快照，不会启动 Minecraft。

## 交付边界

本地 Stage 与 Qoder ZIP 只生成文件，不安装或修改宿主配置。`release:package` 从完整候选目录生成版本化 ZIP 和校验和，但不会推送、打标签或发布。将 `vMAJOR.MINOR.PATCH` tag 推送到 GitHub 后，Actions 会验证 tag 与 `package.json` 版本及 `release` 分支归属，通过构建与打包后创建 GitHub Release；详见 [Release 规则](../RELEASE.md)。
