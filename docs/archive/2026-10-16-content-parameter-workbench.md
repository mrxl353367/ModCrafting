# R3 内容参数工作台与真实游戏验收

**归档日期**：2026-10-16（工作跨 10-15～16）<br>
**触发方式**：核心创作模块自动归档<br>
**问题类型**：功能迁移、生成器适配、真实宿主候选更新

## 背景与范围

工作台需承接 Minecraft 专属创作，而非仅展示监控。本轮完成 R3：物品堆叠/耐久、食物营养/饱和倍率/固定效果、方块硬度/爆炸抗性/光照、生物生命/速度/攻击、工具与护甲。Web/MCP 共用 Core，形成选择/新建 → 参数/纹理 → 预览变更 → 确认保存 → 刷新/Agent 读回 → 构建与游戏验证。旧 R2 配方和用户改动保留；R4 MC UI 尚未开始，完整 Desktop 替代仍未完成。

## 实现与复用

| 关键位置 | 本轮变化 |
|---|---|
| packages/modcrafting-core/src/template-schemas.ts、template-codegen.ts | 提取旧纯表单/生成逻辑，旧 Renderer 路径 reexport；拼音/提示词仍留 Renderer |
| packages/modcrafting-core/src/content-model.ts | 六类适用字段、明确单位范围、严格 schema、耐久单件堆叠等约束 |
| packages/modcrafting-core/src/content-codegen.ts | 每对象独立包/入口；复用物品/食物/方块生成器，适配原生工具/护甲/实体 |
| packages/modcrafting-core/src/content-workspace.ts | list/read/preview/save、版本冲突、文件哈希、保留共享入口/语言、备份与局部回滚 |
| packages/modcrafting-view/src/ContentEditor.tsx | 内容目录、六类参数表单、资源纹理、变更预览/写回、冲突草稿保护 |
| plugins/modcrafting-fabric/src/mcp-server.ts、browser-server.ts | 同一 Core 操作；新增 fabric_content_workspace，合计 21 工具 |
| bridge-mod/.../GameQueries.java、GameTestApi.java | 原生食物/挖掘/方块/生物属性、集成服务器装备及 activeEffects，能力 revision 5 |
| scripts/test/harness-content-workspace.test.ts | 保存/读回、冲突、未知源码、链接与回滚、PNG 保护回归 |

不新增依赖，不导入 Electron/旧 Harness 运行时。旧纯代码提取不是删除旧兼容入口。工具/护甲采用目标版本原生组件，实体复用猪/僵尸 AI、尺寸和渲染器；方块注册前提供 RegistryKey，修正 loot_table/blocks 路径与 1.21.4 items 模型入口。新生成物受声明文件及 SHA256 管理；不反向解析任意 Java。

复用项目已有生成器、React/Zod、文件事务和 MCP/Web 适配方式；参考 [Yarn ToolMaterial](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/item/ToolMaterial.html)、[ArmorMaterial](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/item/equipment/ArmorMaterial.html)、[FoodComponent](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/component/type/FoodComponent.html)、[ItemStack](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/item/ItemStack.html) 和 [Fabric 方块资源文档](https://wiki.fabricmc.net/tutorial:blocks)。生成注册代码前执行了标准 ID/基准查询，Core 操作也执行知识可用性核对。

## 保护与支持边界

- 元数据位于 .modcrafting/content/，每对象生成文件与入口独立，保留原初始化器、适配器、其他语言键。未知/改写的生成文件变只读；现有资源碰撞拒绝，不能默认值覆盖。
- expectedRevision 绑定对象和共享文件；previewRevision 绑定待写入及构建/自定义纹理上下文。写前再次校验、备份，拒绝链接/硬链接；失败只回滚仍匹配本次输出的文件。已有事务锁不自动删除。
- 表单显示名称、ID、纹理和适用参数。剑沿用原生挖掘规则并隐藏挖掘速度；护甲按单部位，穿戴外观/维修由材质决定，图标由纹理决定。
- 生物目前仅猪/僵尸基型，攻击数值不会让被动猪变为主动攻击 AI；复杂 AI/事件、手写源码交给 Agent。食物仅已列举效果，固定 30 秒 I 级。
- 自定义纹理须是工程中已存在的 PNG；原版纹理读取可选本机私有缓存，无缓存显示“类型示意”，不暗中下载。实体只显示纹理展开图，不是 3D。验收从已有本机客户端 JAR 提取少量纹理到私有缓存，不进入 Stage/模组分发，不引入 ZIP 运行依赖。
- 保存只改变工程；Java 改动需重建并重启游戏。当前未提供删除、任意 Java 迁入或自动冲突合并。

## 验证与根因记录

- 插件回归 94/94；旧模板参数/可靠性 24/24；最终类型检查、7 项内容定向回归（含新增负硬度约束）通过。最终 Stage 九文件与隔离 SDK 烟测通过，21 工具，未执行模型调用。
- 实际浏览器九对象逐项改值 → 预览 → 保存 → MCP 同值读回；刷新一致，Agent 外部改动后旧草稿被拒绝且保留，390px 无溢出。最终候选再次检查六类真实纹理、剑字段隐藏、390px 与无 JS 异常。
- 系统 JDK 21.0.3 / Gradle 9.5 构建含九对象的 Fabric 1.21.4 JAR 并实际加载。专用世界副本、隔离 gameDir 与受控区域执行 12 例：9 PASS，3 个故意错误期望得到 FAIL；清理完整。
- 游戏观察覆盖堆叠 32、耐久 350；食物营养 8、原生饱和恢复值 12.8、实际消费 2→1；方块硬度 4.5/抗性 18/光照 9；猪 40/.32/5，僵尸 36/.3/7；工具耐久 640/石头挖掘 9/伤害 8/速度 1.6；护甲 12/韧性 3/击退 .2/耐久 480。
- 初次工具/护甲客户端快照伤害 1、击退 0，而服务端分别 8、.2；诊断两端实际快照后增加服务端原生属性。验收改读权威集成服务器，期望值保持不变，没有放松裁决。初期给不可堆叠物品数量 2 导致的 setup INCONCLUSIVE 修为数量 1；历史失败报告均保留。
- 追加 3 例均 PASS：实际食用后 serverPlayer.activeEffects 包含 minecraft:speed，以及服务端工具/护甲复验；清理完整。最后只将能力声明 blocks.id 更正为实际 blocks.blockId，再构建，游戏逻辑未改变，不重复整套实机。
- 首次组合浏览器/游戏脚本因后续游戏失败，其 browser.json 顶层 ok=false；九项浏览器数据及刷新/冲突/移动端结果独立有效。最终 final-verification.json 汇总通过项，不改写历史失败。

证据（忽略目录，不提交运行产物）：temp/content-live-9fu02Q/evidence、evidence-game3、evidence-game4、data/reports；最终 temp/content-validation/final-verification.json、codex-native.json、safety.json；持久体验目录另存相同报告及最终页面截图。烟测有一次未继承 D 盘 TEMP 而在系统 Temp 留下本次隔离目录，保留未清理。

## 本地交付与宿主边界

候选：`0.1.0+desktop.20261016.r3.e73b8302`。独立 content-workshop-e73b8302 目录提供“打开内容创作.cmd”、示例工程、经过验证的模组 JAR、Observer、报告/证据。启动器复用自己的后端并打开独立浏览器配置；修正首次轮询日志为空时的 PowerShell 参数异常，已实际打开。与宿主共享工程文件，独立 --web-only 后端不共享其他 MCP 进程任务。

Codex 本地 marketplace 同 ID 升级，保留旧配方候选和缓存；真实配置 App Server 加载两份 Skill、21 工具，实际读回护甲及纹理，模型调用 0。候选环境变量遗漏曾导致默认数据目录，已恢复原 D 盘 MODCRAFTING_DATA 并复验。当前聊天不会自动换连接，需要新会话/重新加载。

Qoder 仅合并原 settings.json 对应服务器入口并更新两份 Skill；保留其他设置、旧 IDE mcp.json，未重启或中断用户会话。R3 新版真实聊天调用仍待复验；之前已登录桌面 19 工具调用不证明 R3。CLI 登录验收继续按用户要求保留。Observer 缓存更新前备份，旧插件/config/skills/Observer 全保留回退；未发布公共包。

| 产物 | SHA256 |
|---|---|
| 源 Stage bundle | e73b8302dacd91cec3c4cca0da0911c2c292e494d8264f5b969e71f0b34778e4 |
| 候选版本覆盖后的 bundle | 7d86ca6d073ec863f22ef14a40c73477ecde7f960df9d9a968d9076f02c7d167 |
| 最终 Observer JAR | 0f18789bc4221e82a5a7c12967dd6d2453405581b119607c5f345bcf77ae1e8e |
| 实机补验 Observer（仅能力字段名声明尚未更正） | 39960d0cef4a02bb0613ec28b8432b13b5694993a09c82777f2b6004c026f9bc |

## Git 安全与后续

仅隔离 feat/mcp-foundation-p1 工作区修改，HEAD 39c3b51；源码/文档尚未提交，保留此前 R2/宿主改动，运行产物位于忽略目录与仓库外。原 main HEAD b40e1fa、状态及 9 个用户未跟踪文件 SHA256 全部一致；远端 main 只读查询为 6e6851293c65133b9bf44bdc5d1295a5e7ca7360。本轮不删除用户文件、不提交/推送/tag/发布。

下一项为 R4 MC Screen/HUD 创作；先复用旧布局结构与画布，建立真实写回/游戏验收，不能把 HTML 预览当作 MC 界面。R5 3D、R6 建筑与 R7 整合包维持后续主线，完整 P5 创作替代不标完成。
