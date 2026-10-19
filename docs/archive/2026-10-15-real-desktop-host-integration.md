# 2026-10-15 真实桌面宿主接入

问题：先前 P4/P5 验收基于隔离配置和 CLI/SDK，真实 Codex App 仍启用旧 P1 插件；新 Qoder 桌面没有 ModCrafting 连接器，用户看不到使用效果。

## 最小修复

- 复用候选源码 `39c3b51` 所交付的 Core/MCP，不改业务 bundle。SHA256：`a8a60093f26bc3b2cab3fb0adfb8280e5fde78bf626cda95c23c1b09e75668db`。
- 复制到稳定仓库外目录，试用副本的 Codex manifest 使用唯一版本 `0.1.0+desktop.20261015.39c3b51`，不改正式发布版本，不覆盖旧缓存。
- 先备份真实配置，再用 App 随附 CLI 注册本地 marketplace 并安装。启用新候选，禁用并保留旧 P1，其他配置保持。
- 根据新 Qoder 桌面官方连接器文档，在用户 `settings.json.mcpServers` 合并 stdio 配置，保留 GitHub 和其他设置；添加两份 Skill。旧 IDE `mcp.json` 与 Qoder CN 配置未修改。
- 两边分别使用独立数据根、绝对 Node/MCP 路径和 `--web`，显式复用系统 JDK 21 与已有 Gradle 缓存。示例源码与 Wrapper、minecraft-data、Observer V2 和 Mod Menu 从已验收输入复制，不复制 node_modules、不构建、不启动游戏。

## 验收边界

| 入口 | 结果 |
|---|---|
| 两边配置的 SDK 定向检查 | 各 19 工具；JDK、Wrapper、工程与物品查询成功；浏览器状态 HTTP 200 / contractVersion 1 |
| Codex 真实 CODEX_HOME、App Server 0.162.0-alpha.17.2 | 两份新版 Skill、19 工具、实际环境检查成功，模型调用 0 |
| Codex 当前桌面对话 | 仍持有旧连接；需用户重启 App 后开新会话，未标为新版桌面对话验收通过 |
| Qoder 桌面 0.4.7 扩展管理 | 自定义连接器可用、无需认证，展开 19 工具 |
| Qoder 真实登录对话“ModCrafting桌面验收” | 一次真实模型请求；3 次 mcp_get 获取定义，3 次 mcp_call 实际调用环境、工程、物品工具；原始结果均 ok=true |
| 只读返回 | Java 21.0.3、Wrapper 存在、iron_ticket / Fabric 1.21.4 工程 valid、minecraft:iron_ingot / stackSize 64 |
| Qoder 同一后端浏览器 | 从该对话原始工具返回读取 browserUrl，认证状态接口 200；Chrome 已打开页面。页面工程输入仍需手动选择，不宣称自动打开成功 |

Qoder 真实任务 ID：`2a24d364-cce7-4312-aa1f-e4a7c0c2a5c6`。本地记录为 `temp/desktop-17clqtsd/`，包括配置检查、Codex App Server 检查、Qoder 调用摘要、界面截图与最终安全核对。真实配置备份与本机使用入口另存仓库外；私有浏览器令牌和账号配置不入库。

原 main HEAD、9 份用户未跟踪文件内容指纹与状态均未改变。未删除文件、提交、推送或发布。仅本工作区增加接入文档。Qoder CLI 隔离登录验收仍属不同入口，不能用桌面成功替代；MCP Apps、游戏内新 UI、未下载的百科/Fabric 文档和本轮构建/游戏验收均未扩大宣称。

回退优先在宿主禁用新候选/连接器，保留数据；Codex 可重新启用旧 P1。完整配置备份只在确认没有后续用户改动时用于恢复，不能覆盖新增的其他设置。

复用与官方依据见[真实桌面接入指南](https://github.com/newstarbar/ModCrafting/blob/main/docs/desktop-host-quickstart.md)。
