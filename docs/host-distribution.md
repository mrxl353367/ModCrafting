# ModCrafting 跨 Agent 本地分发

真实 Codex App / 新 Qoder 桌面应用的配置入口、首次只读对话和浏览器打开方式见[桌面接入指南](./desktop-host-quickstart.md)。本页的 Qoder CLI 验收与旧 IDE 包装边界仍单独保留，不代表新桌面的实际状态。

当前目标为 Windows x64 / Node 22.15+ 或 24 / Fabric 1.21.4。同一 Core/MCP bundle、两份 Skills、GPL-3.0 与第三方许可分别打包为 Codex、Claude Code、Qoder CLI 的本地插件。外部 Agent 管理模型和代码编辑；ModCrafting 不实现另一套 Agent Loop。具体宿主验证结果以 P4 报告为准，不将清单校验/SDK Smoke 解释为宿主实测。

本地结果：Codex App 随附 CLI/App Server 0.162.0-alpha.17.2 与 Claude Code 2.1.206 已验证安装、19 工具连接和实际调用（Claude 使用本地回放，不消耗真实模型）；Qoder CLI 1.1.71 已验证安装、两份 Skill 与原生 19 工具连接，实际调用因独立配置未登录而待验收。用户选择先保留该项；P4 尚未全部验收。普通 MCP 成功不证明 MCP Apps 可用。全局 Codex CLI 0.150.1 仅核对版本/help，不扩大宣称。

## 构建与目录

开发者依次运行 plugin:build、plugin:stage、bench:build、migration:build、product:stage，然后：

```powershell
pnpm run host:stage --product-dir "path/to/verified-product"
```

命令新建 temp/host-artifacts/modcrafting-*，验证输入全部 SHA 和文件清单，不覆盖已有包，不安装或升级账户插件。复制到最终位置后再安装；manifest.json 登记三个插件目录和相同 bundle SHA，product/ 保留 Bench、Observer V2 与 P5 独立迁移命令/指南。迁移后的独立数据根可直接用于 --data-root，旧数据保留规则见产品内 MIGRATION.md。

| 宿主 | 交付入口 | 安装机制依据 |
|---|---|---|
| Codex | product/plugin | .codex-plugin/plugin.json、现有本地 marketplace |
| Claude Code | claude/modcrafting-fabric | .claude-plugin/plugin.json、Skills/.mcp.json 自动发现 |
| Qoder CLI | qoder/modcrafting-fabric | .qoder-plugin/plugin.json、Skills/.mcp.json 自动发现 |

各宿主清单分开生成，核心实现不分叉；插件根路径变量只用于相应宿主。实际验证版本、路径展开与数据目录结果登记在 P4 报告。CLI 原生包装格式不能证明 Claude Desktop / Qoder IDE 的插件安装兼容。

## 仅 MCP 的备用入口

随包 host-config.mjs 使用 Node 内置能力，为一个明确指定的宿主生成新配置文件：

```powershell
node ./host-config.mjs --host claude --plugin-dir "D:/ModCrafting/claude/modcrafting-fabric" --data-root "D:/ModCraftingData/claude" --output "D:/ModCraftingConfig/claude-mcp.json" --web
# host 可为 codex / claude / qoder；Codex 输出 TOML，另外两个输出 JSON
```

必须使用绝对目录；可用 --node 指定 Node 可执行文件。命令只创建新文件，拒绝覆盖与链接输出；不合并或写入真实用户设置。安装目录与数据根分开，移动安装包后重新生成路径；使用 JSON 的宿主可通过 --mcp-config 加载，Codex 将生成片段合并到用户自己选定的配置中。MCP 备用入口不安装 Skills。

开发者可运行 `pnpm run host:smoke -- 分发目录` 做仓库外 SDK/config 检查；结果明确不是原生宿主验收。Codex TOML 和 Claude JSON 的原生读取/调用/浏览器 API 另有本地证据，Qoder 原生调用仍需已登录环境。

## 安装、升级与禁用

Codex 延用本地 marketplace：将 product/plugin 复制到 marketplace 根的 plugins/modcrafting-fabric，在 .agents/plugins/marketplace.json 声明本地 source.path；使用 codex plugin marketplace add 指向根目录，受支持版本使用 codex plugin add。不要直接覆盖已有清单或依赖 MCP 参数中的通用 PLUGIN_ROOT 展开。

Claude Code 可用 `claude --plugin-dir "最终插件目录"` 做会话加载；持久安装采用官方本地 marketplace 与 `claude plugin install plugin@marketplace`。Qoder CLI 使用 `qoder plugins install "最终插件目录"`，然后重启/重新加载。具体作用域与启用状态先用对应 help/list 核对。

升级前停止该插件拥有的任务，保持原 dataRoot，再更换整个安装包并验证连接。不同宿主/同时运行的后端使用各自数据根和游戏目录；同一数据根不代表跨进程共享任务，浏览器只连接当前后端所有者。

禁用优先使用宿主插件 disable 或 MCP disabled/enabled 设置，保留数据。卸载与删除数据分开处理；本分发命令不执行卸载/删除。Qoder 的 --keep-data 等选项以安装版本 help 为准；不要清理用户普通世界。

## 浏览器与能力

原 19 个 MCP 工具保持。可显式在 MCP 启动参数添加 --web，通过 modcrafting_environment_status.browserUrl 打开本机工作台；与该 MCP 进程共用 runtime。默认不开 HTTP，关闭页面不停止任务，宿主断开/服务退出会停止拥有的任务。

未实现 MCP Apps 嵌入或新的游戏 HUD，不依据普通 MCP 连接成功宣称宿主 UI 可用。独立浏览器备用命令为 `node ./product/plugin/dist/mcp-server.js --web-only`；这会建立独立所有者，其任务不会出现在另一个 MCP 进程中。

资源下载不安装 JDK/Gradle。公开资源 Observer 仍为 V1，准备后需将 product/observer/modcrafting-observer.jar 覆盖到自己数据根 assets/base-mods/modcrafting-observer.jar，再启动游戏；再次准备后需重做。present 不等于 V2 就绪，截图不等于 PASS。只在专用测试世界运行场景。

官方依据：[OpenAI 插件打包](https://developers.openai.com/plugins/build/plugins)、[Claude 插件清单](https://code.claude.com/docs/en/plugins-reference)、[Claude MCP](https://code.claude.com/docs/en/mcp)、[Qoder 插件](https://docs.qoder.com/cli/plugins)、[Qoder MCP](https://docs.qoder.com/cli/mcp-reference)。发布到 GitHub/npm 或升级真实账户仍需用户授权；当前包是本地未发布产物。
