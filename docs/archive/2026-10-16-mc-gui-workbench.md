# R4 MC 界面创作工作台

**归档日期**：2026-10-16（Asia/Shanghai）<br>
**触发方式**：核心模块新增自动归档<br>
**问题类型**：创作能力迁移、原生生成、浏览器及游戏验收

## 交付范围

R4 首轮为 custom-screen、option-list、hud-overlay 三种布局，支持文字、面板、按钮、开关、整数滑块、展示槽位。复用旧 GuiLayoutElement 的 ID/几何/样式语义、8px 网格和 4px 对齐，以及已有 React、Zod、R3 文件事务和 MC 贴图读取链路；没有新增依赖。旧 Desktop/iframe 不作为运行依赖。

画布提供目录、属性、拖动/调整尺寸、网格/对齐、锚点及窗口/GUI 缩放预览。网页交互模拟与真实游戏配置分开。标签绑定本地开关/滑块或玩家生命/饥饿；按钮限关闭、恢复默认、递增指定滑块。HUD 限非交互组件；展示槽位只渲染物品，复杂容器交换/服务端同步、文本输入、循环选项、自由 HTML/脚本/命令未实现。手写或外改生成 Java 只读，交由宿主合并。此交付不代表 P3/P5 完整替代或 R5～R7 完成。

## 关键改动

| 位置 | 作用 |
|---|---|
| packages/modcrafting-core/src/gui-model.ts | 严格布局/组件约束、共享模板、吸附与尺寸/锚点几何 |
| packages/modcrafting-core/src/gui-codegen.ts | 每布局隔离的原生 Screen/HUD、按键、控件/标签、原子配置写入 |
| packages/modcrafting-core/src/gui-workspace.ts、index.ts | template/list/read/preview/save；文件哈希、共享修订、备份与有条件回滚 |
| packages/modcrafting-view/src/GuiEditor.tsx、App.tsx、view.css | 创作画布与模拟、文件预览/确认、冲突草稿保留、现有贴图复用 |
| plugins/modcrafting-fabric/src/browser-server.ts、mcp-server.ts | 认证 GUI 操作及第 22 个工具 fabric_gui_workspace |
| scripts/test/harness-gui-workspace.test.ts、scripts/plugin | 定向安全/几何测试、构建/Stage/协议工具清单 |
| plugins/modcrafting-fabric/skills/fabric-mod-development/SKILL.md、README.md | 同一工程与版本契约、控件范围和实机验证边界 |

工程声明位于 .modcrafting/gui；生成客户端 Java、assets 下布局资源，合并 client 入口及快捷键语言项。支持 splitEnvironmentSourceSets。expectedRevision 关联生成/共享入口、语言和构建上下文，previewRevision 锁定待应用变更。未知文件碰撞拒绝，独占锁不自动清除已有锁；拒绝链接，后期硬链接失败仅回滚本次仍匹配的文件。游戏 JSON 使用临时文件原子替换，与工程默认值分离。

原生实现参考目标版本的 [Yarn Screen](https://maven.fabricmc.net/docs/yarn-1.21.4+build.1/net/minecraft/client/gui/screen/Screen.html)、[SliderWidget](https://maven.fabricmc.net/docs/yarn-1.21.4+build.1/net/minecraft/client/gui/widget/SliderWidget.html) 和 [Fabric HudRenderCallback](https://maven.fabricmc.net/docs/fabric-api-0.116.0+1.21.4/net/fabricmc/fabric/api/client/rendering/v1/HudRenderCallback.html)。实际构建与映射字节码同时确认签名与调用顺序。

## 发现并修正的问题

- React 批量点击时，模拟开关/递增使用旧状态会丢失前一次修改。改为函数式 setValues；同批 Boost 与 Toggle 结果均保留。
- 首次原生 Screen 在 super.render 前绘制布局，被继承 renderBackground 的模糊过程覆盖。核对 Screen 字节码后改为重写 renderBackground：先原生背景，再布局，最后由继承 render 绘制原生控件。最终标题、绑定文字、铁锭和控件均清晰；没有放宽游戏断言。
- 浏览器初次读取纹理/目录是异步操作，验收等待实际加载条件，而非假设 400ms 内完成。失败场景和早期截图保留，不删除。

## 验收证据

本地忽略目录 temp/r4-validation 保存 browser.json、game.json、game2.json、codex-native.json、installed-browser.json、installation.json 与原始执行脚本。游戏隔离目录 temp/gui-live-dlx0il：专用世界为 ModCrafting Test World 的副本，生成源码和配置只在本次自建样例中修改。修正生成器时先核对旧文件哈希，将旧源码/声明保存在 evidence/pre-blur-fix，再更新该测试样例；没有增加绕过用户文件保护的产品接口。

- plugin:test：103/103；最终类型检查及 GUI 定向 5/5 通过。测试覆盖三布局、安全写入/回滚/硬链接/junction、冲突、布局及绑定非法值、重复按键与几何。独立 plugin Stage/SDK Smoke 发现 22 工具，实际 GUI 模板和目录调用通过。
- 真实 Chrome：拖动/吸附、调整尺寸、样式、HTML 文字不执行、交互模拟、4:3/GUI3、预览/保存→MCP 同值读回、刷新读回、外部变更冲突保留草稿、390px 无横向溢出/JS 异常。安装后另外检查六组件添加、HUD 禁用三类交互控件、铁锭 PNG 解码；可见浏览器停留在已保存样例。
- 真实构建与 Minecraft：7 PASS（打开、开关、滑块、递增、重置、自定义 Screen、配置重启读回），1 个预期 FAIL（实际 5 与故意预期 99），1 个预期 INCONCLUSIVE（HUD 断言 CAPABILITY_UNAVAILABLE），全部 cleanup 无失败。960×720/GUI2 和 1024×768/GUI3 的控件几何与 Web 计算一致。滑块 7/开关 ON 经完整游戏重启保留，最终 Reset 为 4/OFF。
- HUD 另外检查新请求/新序号的实际 DrawContext 记录，Health/Food=20、位置正确；隐藏后无新增对应绘制，重新显示恢复。此项是原生绘制观察，不计入自动 HUD PASS，也不以截图取代断言。
- 修复背景顺序后重新构建、启动并补验 3 PASS（打开/开关/滑块），检查最终标题坐标/颜色、物品与 HUD 截图。最终图片 evidence/game2/native-screen-sharp.png；game1 早期图片保留对照。自有游戏进程退出，状态清理为默认值。
- Codex 真实 CODEX_HOME 的 App Server 0.163.0-alpha.10.2：两份 Skill、22 工具、GUI 同工程可编辑读回、Power=4 与 HUD 模板成功；模型调用 0，desktopChatValidated=false。没有宣称当前聊天已重连。Qoder settings.json/Skill 更新并备份，新版聊天调用及 CLI 登录项按用户决定继续保留。

## 本地候选与回退

候选 0.1.0+desktop.20261016.r4.7d3b2432，独立 plugin/缓存版本，不覆盖既有 texture/R3/配方候选。新建 gui-workshop-7d3b2432，提供打开MC界面工坊.cmd、三个布局样例、源工程、JAR 与 evidence/reports。旧工程/启动器和用户文件保留。独立 --web-only 与宿主共享工程文件，任务归属各后端；要查看宿主任务应打开该宿主返回的 browserUrl。

源 bundle SHA256：7d3b2432ca9d94aac5c3a25af860a4a1b7404bd3a8051f648a3cee94245f7b83。候选 bundle（仅本地版本覆层）SHA256：050a6049e80ed369460e799bfa6a4d53ebc8240c237d00dcf85f08ad3e35da6b。Observer 实机/导出 SHA256：0f18789bc4221e82a5a7c12967dd6d2453405581b119607c5f345bcf77ae1e8e。

导出模组 JAR SHA256：cdc43f25dae4360bc8a497b6cc17d034532c4954974a79a7645d41a52b6fcc90。最终远端 main 只读查询为 6e6851293c65133b9bf44bdc5d1295a5e7ca7360；本地源码 HEAD 仍为 39c3b51，分支 feat/mcp-foundation-p1，工作区保留既有及本轮未提交修改。原 main HEAD 仍为 b40e1fa。

源码继续位于隔离 Worktree，HEAD/分支保留，未提交/推送/发布。原 main 的 HEAD、状态及 9 个未跟踪文件哈希复核；共享 pnpm Store、各自 node_modules 保持。远端 CI 未执行。宿主无关配置保留，旧 Qoder mcp.json 未改，配置回退备份位于本机 installation.json 指定目录，不在公开文档写入个人路径或会话链接。
