> 后续授权更新（2026-10-15）：用户已明确要求开始 P5，故下文“不进入 P5”为 P4 当时的历史状态；Qoder 调用仍保留待验收。当前进度见 [统一路线](./transformation-roadmap.md)。

# P4 跨 Agent 分发实施报告

日期：2026-10-14；隔离工作区 ModCrafting-mcp-p1 / feat/mcp-foundation-p1。

**分发开发与可执行的本地验证已完成；P4 全部退出条件尚未满足。** Codex、Claude Code 已验证安装、加载、连接和工具调用；Qoder CLI 安装/Skill/19 工具连接通过，但隔离配置未登录，实际工具调用待验收。用户明确选择“没有已登录环境，先完成其余开发并保留这项验收”。不进入 P5，不将 Qoder 调用项改称通过。

## 实现与复用

复用 P3 的自包含 MCP/浏览器 bundle、两个 Skills、Bench、Observer V2 与现有白名单/指纹校验。Core、19 个工具契约、浏览器执行器、Desktop 和正式依赖锁均未改动。唯一共享 Skill 用词从 Codex 的文件工具改为宿主 Agent 的文件工具。

新增 scripts/plugin/stage-hosts.mjs：核对输入产品全部指纹与文件清单，拒绝链接/异常输入，在新目录保留完整 product 并生成 .claude-plugin / .qoder-plugin 清单、根路径/数据变量和相应 .mcp.json。Codex 保留原九文件 Stage；三者使用同一个 SHA 的 JS、Skills 与许可，不复制 node_modules 或另建 Core 实现。

新增 host-config.mjs：Node 内置 parseArgs/fs/path，生成明确宿主的 TOML/JSON 新文件。绝对 argv、独立 dataRoot、可选 Node 路径/--web；拒绝相对路径、安装目录内数据、覆盖、链接输出。不会写入真实账户，不自动合并配置；复制到最终位置后再生成本机路径。smoke-hosts.mjs 使用已安装的官方 MCP SDK 验证该备用入口，并明确标记不是原生宿主验收。

宿主依据与安装/升级/禁用/保留数据说明见 [分发指南](./host-distribution.md)。依据是各平台官方文档与实际安装版本 help；没有复制第三方项目或添加生产依赖。

## 原生宿主验收矩阵

| 宿主 / 实测版本 | 安装、Skills | 连接 | 工具调用 | UI 与备用入口 |
|---|---|---|---|---|
| Codex App 随附 CLI/App Server 0.162.0-alpha.17.2 | 独立配置、原 marketplace、两份启用 Skill | 19 个工具 | App Server 实际环境/工程/非法路径调用，0 模型轮次 | 生成 TOML 被原生宿主读取；--web 的同进程浏览器 API 通过 |
| Claude Code 2.1.206 | 原生严格 validate、独立 marketplace install/list、两份 Skill | 19 个工具 | 官方 Agent SDK 0.3.299 + 本机 Provider 回放，原生 CLI 实际执行环境/工程/不存在任务三次调用；0 真实模型调用 | 生成 JSON 被原生 CLI 读取，19 工具及活动会话内浏览器 API 通过 |
| Qoder CLI 1.1.71 | 原生严格 validate/install/list；两份 Skill | 原生会话 init 明确 connected，列出 19 工具 | **待验收**：未登录，authentication_failed，0 模型额度；用户选择保留 | SDK/生成配置的浏览器备用检查通过；不冒充 Qoder 原生调用或 UI |

Claude 回放只决定返回哪条 tool_use；Core 的实际结果由运行中的原生 CLI/MCP 返回。读取到工程 modId、环境 contractVersion/dataRoot 和 JOB_NOT_FOUND，未用回放文本伪造 MCP 结果，也没有证明真实模型开发质量。

Qoder 的 `mcp list` 未列出插件服务，但其原生 stream-json 会话 init 完整列出已连接插件与 19 工具；列表子命令不能代替会话加载证明。此前 control initialize 探针进入了未登录的对话路径，因此保留认证失败及 system/init，不声称该探针完成 SDK 控制请求。实际调用仍保留。

三宿主均只安装到 D:/Temp/modcrafting-p4-IjlblL/ 的专用配置，不登录/升级真实账户。Claude_CONFIG_DIR / QODER_CONFIG_DIR 与 Codex 测试 home 均位于本轮目录。关闭会话后对测试插件执行禁用（Codex 使用自己配置中的 enabled=false），原生 list 确认三者 disabled；缓存和 agent-owned 数据标记保留，未执行卸载/删除。没有验证真实账户升级或 GUI 点击安装。

MCP Apps 与新游戏 HUD 没有实现；MCP 连通不等于宿主支持嵌入 UI。首发浏览器沿用 P3，跨进程数据根相同也不会共享运行任务；每次浏览器只连接对应 MCP 所有者。Claude Desktop、Qoder IDE、其他系统/宿主未验收。

## 最小验证与边界

- Node 22.23.3 / 24.19.0 定向回归各 73/73，新增五项配置/路径/覆盖/链接/指纹/同 bundle 分发测试；无新增 Core 回归失败。
- 三宿主配置的 SDK Smoke 在 Node 22/24 均通过，每项 19 工具、环境/工程/非法路径与 --web API、仓库外隔离模块解析。报告 execution=SDK/config、nativeHostTest=false。
- 全仓 837/816/21，失败名称与 P3 的 21 项一致；23 条既存 TS 错误逐项相同。远端 CI 没有运行。
- CI 仅扩展 host fixture 路径和定向回归，不安装/登录宿主 CLI、不执行模型或 MC、不上传/发布。
- 当前 Core bundle SHA-256：8c866ef43e831a12ae3c90a185a3d1ac45fc8741d4feac6729af12e750c0d98e，与 P3 被测包完全一致，故本阶段未重复构建或启动 Minecraft。

测试用 Qoder 二进制仅解包到验证目录：官方安装脚本指向的 Windows x64 1.1.71 ZIP，97,617,418 字节，发布 SHA-256 3bf283d0065273fd91d2529a7ecb9bd2212e21257b51cc755cc55a5827e9c120 已核对；没有执行安装脚本或全局安装器。Claude SDK 仅在 temp 测试目录安装，其测试依赖使用共享 pnpm Store/独立 node_modules，SDK 与 CLI 不随产品分发，正式 package/lock 不增加依赖。

中间失败保留：Claude 动态 MCP 首轮 pending 时回放请求看不到工具，改用官方初始化/重连接口等到 connected 后开始输入；随后会话结束导致浏览器服务按约关闭，检查改在活动会话内执行，最终原生 JSON/三次工具/API 通过。重复测试目录拒绝覆盖的失败也保留，没有回退覆盖文件。

## 证据与后续

工程证据 temp/p4-verification/run-mfg17pmn/ 保存 before.json、原生安装/协议/配置驱动、Node 两版本回归、生成配置 Smoke、全仓/类型日志和基线对照。宿主证据 D:/Temp/modcrafting-p4-IjlblL/，包含 install.json、原生会话/回放请求结果、配置备用验收与 disable-preserves-data.json。最终本地交付位置、指纹、安全/进程检查由 verification.json 登记。

分发包为本地未发布产物；Stage 从验证过的输入重新生成，所有 README、清单与配置脚本纳入 manifest。Observer V1→随包 V2 的显式应用步骤继续保留，资源 present 不代表 V2 就绪。后续只需在可用且获授权的已登录 Qoder 环境完成实际调用，再检查 P4 退出条件；当前不开始 P5 或删除 Desktop。

原 main、九个用户未跟踪文件、P0～P3 成果和历史失败证据保留；没有提交/推送/发布、删除用户数据或修改真实账户配置。
