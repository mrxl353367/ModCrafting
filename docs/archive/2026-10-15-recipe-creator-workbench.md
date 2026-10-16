# 配方工坊：Web 编辑到真实游戏合成

**归档日期**：2026-10-15<br>
**触发方式**：大功能自动归档<br>
**问题类型**：创作能力迁移 / 新功能

## 背景与范围

用户指出原浏览器工作台偏重执行状态，缺少 Desktop 的 Minecraft 创作交互，选择首轮交付“合成配方：拖放编辑→保存→游戏验证”。本轮补齐 P3 的 R1/R2 首轮配方流程，不将 P5 完整替代标为完成。参数、MC UI、3D、建筑、整合包仍按创作需求推进。

## 实现与复用

| 关键位置 | 作用 |
|---|---|
| packages/modcrafting-core/src/recipe-format.ts、recipe-grid.ts | 迁出旧纯配方格式/校验与网格换位函数，旧 Renderer 路径继续导出 |
| packages/modcrafting-core/src/recipe-editor.ts、recipe-workspace.ts | 五种格式与表单转换、工程目录、原版/工程物品目录、版本检查、安全读写与旧版备份 |
| packages/modcrafting-view/src/RecipeEditor.tsx | 拖放/点击选材、数量、类型、JSON 预览、保存读回、冲突保留草稿及未保存离页提示 |
| plugins/modcrafting-fabric/src/browser-server.ts、mcp-server.ts | Web 与 fabric_recipe_workspace 共用 Core 操作，原 19 工具保留，当前 20 工具 |
| scripts/test/harness-recipe-workspace.test.ts | 文件往返、元数据、五种格式、只读保护、目录边界、冲突、认证 HTTP/MCP 文件一致性 |

复用 React、Zod、官方 MCP SDK、esbuild；无新增依赖、无新 Agent Loop。原版格式依据现有生成器、[Fabric recipes 文档](https://wiki.fabricmc.net/tutorial:recipes)及 [Mojang 1.21.2 格式变更](https://www.minecraft.net/fr-ca/article/minecraft-java-edition-1-21-2)。配方路径为单数 recipe，材料为字符串/标签，烹饪产物为字符串。修改数量时保留 category/group、自定义根字段及 result components。

## 必要验证

- 完整插件回归 87/87；旧 Fabric 配方兼容测试 11/11。最后元数据/离页提示调整后重新通过类型检查、构建和配方定向 5/5。
- 仓库外 Stage 官方 SDK 烟测：20 工具，initialize/tools/list/tools/call，禁止解析 Stage 外模块；新领域工具实际调用成功。最终烟测位于 D: 的 modcrafting-recipe-checks 临时目录。
- 真实 Chrome：网格拖动换位、材料与产物替换、数量修改、JSON 预览/保存、MCP 同文件读回、硬刷新恢复工程、外部 Agent 修改后的 RECIPE_CONFLICT 与草稿保留、重新加载、390px 无横向溢出、无脚本异常。
- 真实 JDK 21.0.3 / Gradle 9.5 / Fabric 1.21.4：Web 保存的两个金锭斜放→3 铁锭，工程构建成功，JAR 包含同一配方。两次实际合成均 PASS，库存金锭从 3→1、产物铁锭为 3；未合成与要求至少 4 个产物的反例均 FAIL。四例 cleanup 均完整，未使用奖励命令代替合成。

最终证据：temp/recipe-live-DxpaKY/evidence-v6/acceptance.json、build.json、tool-trace.json、四份 recipe_v6 场景报告及桌面/窄屏截图。早期失败均保留，不计入通过。

## 实机定位经验

首次单金锭配方匹配了原版金粒，两个金锭横排又匹配原版轻质测重压力板。逐动作 Observer 快照观察到了实际产物；读取知识库 recipesByResult 后改用斜放，避免歧义。文件存在、构建成功和配方列表出现均不能证明实际选择了自定义配方。

进入世界的同步点击可因加载超过桥接期限而报超时，验收脚本仅在该步骤通过后续世界状态确认结果，不盲目重复点击。保留区域可能已有目标方块，重复 setblock/fill 会报无变更；场景准备使用条件命令，清理仍要求完成。本轮未改 Observer 或裁决引擎来绕过失败。

## 本机交付与宿主边界

本机候选版本 0.1.0+desktop.20261015.recipes.ca46a210；源码构建 bundle SHA256 为 ca46a210725c21875fb44bc17e78578f2ff4ec3af8f61e468a9a26e51cf685f5。候选仅替换嵌入版本后的 bundle SHA256 为 c71b259ef7f33987ee37ac2c16b2c19dbf93942a5eb87ddd9725c749a4eb9753。保留旧版本和配置备份，安装位置/备份位置见本地 temp/recipe-validation-dh98ony8/installation.json，不提交个人路径与会话令牌。

Codex 真实配置的 App Server 已加载新版本两份 Skill、20 工具，实际调用环境检查及配方读回；未额外调用模型，不能代替用户当前聊天已重连。Qoder settings.json 与两份 Skill 已备份后更新，其他配置和旧 IDE mcp.json 保留；新版 Qoder 真实聊天调用尚未复验，隔离 CLI 登录验收继续保留。

稳定目录另有已打开示例的独立浏览器预览、启动器、工程、JAR 和报告。独立预览与宿主共享工程文件，不共享内存任务；查看宿主任务需打开该 MCP 进程返回的 browserUrl。候选安装方式参照 [OpenAI 官方本地插件文档](https://developers.openai.com/plugins/build/plugins)，旧会话需重新加载/新建。

## 明确限制与安全边界

当前物品为文字图块，工程物品来自 items/models/item 资源，不能证明已注册；标签成员、原版同输入配方冲突需游戏检查。支持五类基础配方，其他 serializer/不支持的材料形式只读。无热更新、通用 Java 反向编辑、MC UI/参数/3D/整合包能力；浏览器仍通过 Agent 配置具体游戏场景。

仅在隔离 Worktree 开发；pnpm 共享 Store，node_modules 独立，无新增依赖安装。原 main 和原九个未跟踪文件最终复核；不删除用户文件，不提交/推送/发布。验收仅操作复制的专用世界，测试拥有的游戏/构建进程已停止；预览后端保留供用户体验。

最终只读 Git 复核：远端 origin/main 为 6e6851293c65133b9bf44bdc5d1295a5e7ca7360；原工作区 HEAD 为 b40e1fa522cf87280b72ace2480417e051b908fa，状态与九份未跟踪文件 SHA256 均与 P0 基线一致。隔离 Worktree HEAD 保持 39c3b51f7965a700f566d113cddc7fccfb3f3c14，本轮源码/文档修改尚未提交；生成包、报告与会话配置位于忽略的本机目录。
