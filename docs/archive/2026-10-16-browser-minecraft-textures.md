# 浏览器 Minecraft 素材贴图读取修复

归档日期：2026-10-16。触发：核心素材链路修复自动归档。

## 根因与最小方案

配方材料库和槽位实现仅显示文字方块，没有图片读取/渲染链路；R3 内容预览只读取少量临时准备的 PNG，新建对象要先保存或预览才可能取得图片。隔离工作区的旧 public/items、public/blocks 没有素材文件，不能靠恢复旧 URL 解决，更不应令新产品依赖原 main 或旧 Desktop 的路径。

复用现有本机 Fabric 1.21.4 客户端 JAR 与 Windows .NET ZipFile，首次准备模型定义与 PNG 到独立数据根，后续离线读取。不新增 npm 依赖，不下载新素材，不复制不同工作区 node_modules，不更改原 main。

## 关键改动

- packages/modcrafting-core/src/visual-assets.ts：检查 JAR 内 version.json，限定 assets/minecraft 的 items/models JSON 和 textures PNG；限文件大小/总量/数量，拒绝链接，只创建不存在的缓存文件。使用 [官方 ZipFile.OpenRead](https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.zipfile.openread)；路径通过环境变量传递，无 shell 字符串插值。优先 GRADLE_USER_HOME 的 Loom 缓存，兼容原版启动器标准目录；缺客户端明确诊断，不隐式下载。
- 同一模块按实际 1.21.4 items 定义、模型 parent、textures/#变量解析静态图片，工程资源优先。限制父链/变量循环，拒绝路径穿越，读取有大小上限。单次批量共享读取缓存，下一次请求重新读取工程变化；不长期缓存 Agent 修改前的工程纹理。
- plugins/modcrafting-fabric/src/browser-server.ts：新增 visuals 浏览器操作，沿用令牌、Origin/CSP 保护及工程检查；每批最多 80 物品、16 纹理。MCP 工具仍为 21，不新增任意文件读取 API。
- packages/modcrafting-view/src/visuals.tsx、RecipeEditor.tsx、ContentEditor.tsx、view.css：材料库/槽位/产物真实图像、数量角标、拖放不受影响；内容创建/修改纹理立即预览，无需保存；错误保留文字、重试和原草稿。物品图片不可自身拖动，保留原按钮拖放数据。
- scripts/test/harness-visual-assets.test.ts、harness-browser-view.test.ts、scripts/plugin/test.mjs：模型继承/变量、工程 PNG、循环/穿越/链接、冷缓存白名单与并发准备、认证与请求上限定向回归。

首次缓存准备暴露 PowerShell 逐文件重复检查目录的耗时问题；使用 .NET 文件 API 与已检查目录集合后，实际准备约 7～11 秒。整目录批量图片扫描 1392 项约 4.7 秒，未增加常驻长期工程缓存。旧失败记录保留，不删除用户文件。

## 验证

修复前独立浏览器复现首屏 60 个物品、0 张图片。修复后首屏 60/60 图片解码成功；石头/原木的模型父链、钻石剑、工程生成方块均有图；拖放金锭入材料槽、选择铁锭产物、角标数量 3 正常。工程自定义 PNG 经认证 API 读取并在真实浏览器成功解码。新建内容即显示素材，390px 无横向溢出，无 JS 异常。浏览器测试不保存草稿；持久示例工程 62 个文件与上轮来源逐字节一致。

`pnpm run plugin:test` 98/98；`pnpm run typecheck`、独立 plugin:build/stage 与 SDK 烟测通过，Stage 九文件、21 工具、无外置依赖。本次没有修改生成代码/Observer 或游戏逻辑，不重复启动 Minecraft；R3 的游戏证据保留。

实际目录统计 1392 项，1370 项可静态解析；剩余为 6 类头颅、16 色旗帜，需要游戏特殊渲染，不伪造贴图或承诺 3D。指南针/时钟为代表帧，方块为纹理面；不等同完整游戏渲染器。资源缺失或损坏可诊断/重试，自定义 PNG 须实际存在。

## 安装与回退

候选 `0.1.0+desktop.20261016.textures.e4c36b5b`；新独立插件目录与缓存，保留旧候选。两份原启动器只更新 backend 路径，保留工程、数据、浏览器配置及旧页面；原 main/用户文件不改，不强行关闭旧会话。新页面已实际打开并复验 60 图、产物/数量及自定义 PNG。两端独立数据根已准备本机素材。Codex App Server 真实配置连接 21 工具、两份 Skill，护甲/纹理读回通过，模型调用 0；Qoder 新版聊天验收继续保留。

源 bundle SHA256：e4c36b5bde817a336f23dceae10dfa9683771b4f3d0da7ee3351fba6c8f9f373。本地版本覆盖 bundle SHA256：bc0dcf5ac8da5ead14198db35129041ba78e80979a77990bcfda59c4a0e28cf6。安装缓存与候选字节一致。配置、marketplace、旧启动器与 README 备份到本次专有备份目录，未改其他连接器和旧 Qoder IDE 配置。运行证据位于 temp/texture-validation、独立 texture-browser-* 及持久工作台 evidence/textures-e4c36b5b；链接含本机会话令牌的 private 文件不公开。

## Git 安全

仍在 feat/mcp-foundation-p1，HEAD 39c3b51，保留前轮未提交改动。本轮源码/文档未提交；生成的 bundle/缓存/证据位于忽略目录或仓库外。原 main HEAD b40e1fa、状态和 9 个未跟踪文件哈希保持一致。远端 main 只读查询 6e6851293c65133b9bf44bdc5d1295a5e7ca7360；未推送、发布、tag 或删除用户文件。R4 不在本次范围。
