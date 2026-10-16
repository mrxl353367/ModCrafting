# Qoder 国际版原生插件接入

**归档日期**：2026-10-16（Asia/Shanghai）
**触发方式**：修改插件分发流程自动归档
**涉及文件数**：12
**问题类型**：插件适配、分发与文档

## 背景

此前 Qoder 国际版仅配置独立 MCP。用户要求补齐原生插件，将工作流组件统一交付和管理。原开发目录停留在早期 19 工具基线；本次复用已安装的 R4 候选，不回退或重建 Core。上传分支基于包含 22 工具实现的最新远端 main，保留已合并的 Core/MCP 与 README 改动。

## 实现与复用

- `scripts/plugin/stage-qoder.mjs`：从明确指定的已构建候选复制 bundle、两份 Skill、资源与许可证，生成 `.qoder-plugin/plugin.json`、`.mcp.json`、三命令及 ZIP。复用 Windows .NET ZIP，无新增 npm 依赖。
- `plugins/modcrafting-qoder/commands/{inspect,build,test}.md`：工程检查/工作台、构建、结构化游戏验收入口，无自动 Hook。
- `package.json`：新增 `plugin:qoder`；`scripts/plugin/test.mjs` 将新增测试纳入默认回归；`scripts/test/harness-qoder-plugin.test.ts`：打包、用户状态排除、路径与 junction 防护测试。
- `docs/qoder-user-guide.md`、根 README、文档导航及本归档与索引：补齐插件安装、使用与回退说明。

参考 Qoder 国际版插件官方文档及本机官方 `qoder-create-plugin` 的 manifest、组件和离线校验规范。组件目录不包含其他宿主的有效清单；默认使用 QODER_PLUGIN_ROOT/QODER_PLUGIN_DATA，机器专用包支持显式 Node 和数据目录。

Core bundle SHA-256 保持 `050a6049e80ed369460e799bfa6a4d53ebc8240c237d00dcf85f08ad3e35da6b`。插件清单适配版本为 `0.1.0+qoder.20261016.r4.7d3b2432`；服务器保留原 desktop 候选版本，未修改 bundle。

## 验证

- 三项定向测试通过，Node 语法检查与 git diff --check 通过。基于最新远端 main 整合后，新增测试已纳入默认 plugin:test，完整插件回归 106/106 通过；新工作区依赖通过共享 pnpm Store 离线安装，下载数为 0。
- Qoder 自带 Python 离线 ZIP 校验器：通过，无问题。CLI 1.1.71 validate：2 Skills / 3 commands / 1 MCP；旧 CLI 忽略 descriptionZh/logo 的提示保留，真实桌面可显示中文描述。
- 包内后端 SDK：发现 22 工具，环境检查、鉴权浏览器 state 和 GUI 模板调用通过。测试仅使用专用临时工程，无模型调用、资源下载或游戏启动。
- 本机真实用户配置下，通过官方 CLI `plugins install --scope user` 完成安装。Qoder 国际版桌面 0.4.8 原生「已安装」页面显示 ModCrafting Fabric，设置启用；指令、技能页识别新增组件；连接器显示「由 ModCrafting Fabric 提供」「可用」，展开工具数为 22。
- ZIP 已生成并离线校验；本轮没有通过文件选择窗口完成 ZIP 安装。当前安装证据来自官方 CLI 安装及随后真实桌面检查，不混用两种证据。

本机忽略目录 `temp/qoder-plugin-validation/` 保留 install-result.json、native-components.json、native-tools.json、smoke.json、桌面截图与 host-backup。SDK 最初的 GUI 调用因测试工程缺少 projectPath/Wrapper/版本属性失败；按实际工程检查契约补齐 fixture 后通过，未修改产品逻辑。

## 配置与回退

原配置及安装索引已备份到本机验证目录。原独立 `mcpServers.modcrafting-fabric` 仅新增 `disabled=true`，其启动参数和数据目录保留；其他设置逐项比较保持一致。插件复用旧 D 盘数据根，宿主插件缓存由 Qoder 官方安装机制管理。TEMP/TMP 对 CLI 安装与 SDK 测试使用本项目 D 盘临时目录。

回退时在 Qoder 禁用 ModCrafting Fabric 插件，重新启用旧独立连接器，再新建聊天。不要删除工程、缓存或用户存档，不要覆盖整个 settings.json 回退无关设置。

## 边界

本轮未执行 Qoder 模型聊天工具调用、游戏验证、远端发布或提交。桌面工具可用证明连接，SDK 成功证明包内后端可调用；均不替代当前模型聊天或具体模组的游戏验收。主工作区既有未跟踪文件与独立 MCP 开发 worktree 保留。
