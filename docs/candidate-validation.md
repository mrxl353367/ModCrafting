# 本地候选版本与首次使用验收

P0～P5 主体转型后，以“干净源码可构建完整包”和“新模组实际行为可验证”收口。此流程只做本地构建/验收，不修改账户插件、不创建发布 tag、不推送。旧 Desktop 基线和 Qoder 调用待验收项继续单列。

## 从源码构建完整候选包

```powershell
pnpm install --frozen-lockfile --ignore-scripts
$env:JAVA_HOME = 'C:/Program Files/Java/jdk-21'
$env:PATH = "$env:JAVA_HOME/bin;$env:PATH"
# 可选：显式使用已有 Gradle 缓存；未设置则由标准 Wrapper 采用 Gradle 默认位置
# $env:GRADLE_USER_HOME = 'D:/your-gradle-cache'
pnpm run candidate:build
# 仅在 Wrapper 分发和所有依赖已缓存时使用 --offline
```

candidate:build 复用现有 MCP/Bench/迁移构建和 Stage 校验，使用系统 JAVA_HOME + bridge-mod 自带 Wrapper 从当前源码构建 Observer V2，输出完整产品及三宿主包。日志、candidate.json 位于新 temp/candidate-artifacts/run-*，不依赖历史临时 JAR。默认 pnpm build 仍是纯 Node 构建，不要求 Java。--offline 是 Gradle 的依赖离线模式，缺失 Wrapper 分发时 Wrapper 本身仍可能下载，不能称为完整冷离线安装。

MCP 新建 Fabric 工程现在包含仓库已有 Windows Wrapper、固定 Gradle 9.5.0 和分发 SHA-256；首次 build 可通过标准 Wrapper 下载 Gradle/依赖，不自动安装 JDK。Wrapper 的 Apache-2.0 许可随插件 THIRD_PARTY_NOTICES 分发。直接调用 Core scaffold 时可由调用方注入 Wrapper，未注入时保持原有不写 Wrapper 的行为。

## 真实模组场景

examples/iron-ticket 包含 GPL-3.0 的最小示例源码与 V2 spec。通过 MCP scaffold 创建新工程，再复制示例 src，构建后启动隔离 Minecraft。右键消耗一张 iron_ticket:ticket，并得到一枚 minecraft:iron_ingot；只在服务端发奖励，测试不通过 give 铁锭模拟功能。

编写示例前已调用 minecraft_data_lookup：minecraft:iron_ingot / stackSize=64；开发参考 [Fabric 物品交互](https://docs.fabricmc.net/1.21.4/develop/items/custom-item-interactions) 与对应 [Yarn Item API](https://maven.fabricmc.net/docs/yarn-1.21.4%2Bbuild.1/net/minecraft/item/Item.html)。使用 Yarn 名称，不能直接复制新版 Mojang mappings 示例。

验收包含未启动 MC 的 INCONCLUSIVE、未使用物品的 FAIL、真实右键的 PASS、错误奖励数量的 FAIL、重复操作 PASS。断言读取新鲜库存、精确兑换券减少 2→1 和铁锭数量；每次 finally 清理。截图只作展示。普通世界禁止执行，区域限定 x/z [-16,16]、y [96,112]。

```powershell
pnpm run acceptance:first-use -- --product-dir 'ABSOLUTE-COMPLETE-PRODUCT' --assets-data 'ABSOLUTE-PREPARED-DATA' --world-input 'ABSOLUTE-PATH/ModCrafting Test World' --run-root 'ABSOLUTE-RESULTS-ROOT'
```

脚本使用本仓官方 MCP SDK，调用仓库外完整产品入口；默认不接模型 API，也不使用回放伪造游戏结果。需要系统 JDK 21、工程依赖可获取和有效专用世界。每次新建工程/数据/世界副本；输入目录的指纹前后检查，拒绝链接和嵌套输出。显式复用准备好的知识/基础模组缓存，并将完整包 V2 应用到新缓存；这不是冷下载验收。

输出包含 tool-trace.json、构建结果、四份真实游戏报告、acceptance.json 和 export/iron_ticket-0.1.0.jar。MCP/浏览器共用一个 Runtime；所有作业结束后关闭服务。该脚本会启动 Minecraft 并操作专用世界，不放入无游戏 CI 自动运行。

## 本地固化

先审查源码、配置和许可，精确暂存；不加入 node_modules、缓存、个人配置、原 main 的用户未跟踪日志和游戏数据。将候选源码保存为本地提交，以 git archive 导出到独立目录，再用 pnpm 共享 Store 安装独立 node_modules，验证 build/typecheck/test/candidate:build。源码可重建、协议可用和真实模组验收分别记录；本地通过不代替远端 CI 或真实账户升级。
