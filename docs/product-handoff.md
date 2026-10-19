# 本地候选包交接

候选包面向外部 Agent 使用，不包含 Electron、模型账户、聊天历史或用户存档。Core/MCP、浏览器工作台和 Observer V2 由同一版本源码构建。

## 完整候选

在 Windows x64、Node.js 22.15+ 和 pnpm 10.34.7 环境中执行。构建 Observer 需要 JDK 21；首次 Gradle 解析可能联网。

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
pnpm install --frozen-lockfile --ignore-scripts
pnpm run candidate:build
```

结果位于 `temp/candidate-artifacts/run-*/`；`candidate.json` 提供产品和宿主分发目录。产品目录包含：

- `plugin/`：自包含 MCP、Skills、会话/配置工具、浏览器资源和 Observer 指纹。
- `bench/`：离线及真实游戏案例工具与输入。
- `observer/`：与插件内置组件匹配的 Observer V2 JAR、指纹和许可证。
- `examples/iron-ticket/`：可构建的 Fabric 示例工程。
- `README.md`、`CANDIDATE.md`、`manifest.json`：安装顺序、验收边界和文件 SHA-256。

候选生成只写本地 `temp/`，不会安装宿主插件、修改账户配置、创建 tag、推送或发布。

## Qoder ZIP

从 `candidate.json` 读取产品目录，传入其中的插件目录：

```powershell
pnpm run plugin:qoder -- --source 'D:\path\to\candidate\plugin'
```

ZIP 输出到 `temp/qoder-artifacts/`。它包含 Qoder manifest、`.mcp.json`、三份 Skills、命令、MCP bundle、许可证和兼容性指纹。默认使用 `${QODER_PLUGIN_DATA}` 独立数据目录，不写入 Qoder 设置。

## 首次使用与游戏测试

1. 在 Qoder 中安装 ZIP，启用 ModCrafting，重新载入插件并新建聊天。
2. 先运行环境与工程检查；需要编辑时再调用 `modcrafting_open_workbench`。
3. 每个任务显式创建 `sessionId`，后续构建、游戏、测试、状态查询和停止都使用同一个 ID。
4. 游戏模块可读取/调整测试配置：简体中文、1280×720、视距 8、60 FPS、30% 音量、旁白关闭；地图默认平地、种子 0、创造模式、和平难度并允许命令。
5. 启动后等待 `canRunTests=true`。桥接已连接但仍停留在欢迎向导、加载界面或主菜单时不能开始玩法测试。
6. 失败结果注明阶段、原因、当前界面和建议恢复动作。游戏测试仅在 session 专属副本中运行；复制存档来源只读。

任务配置默认属于当前 session。保存为工程默认是显式操作；运行期间修改只对下次启动生效。结束 session 会停止其拥有的作业并保留报告。关闭浏览器不会停止任务。

## 验收边界

类型检查、插件回归、MCP Smoke、浏览器截图、真实 Minecraft 和 Qoder 真实聊天是不同层级的证据。不能用 SDK 工具发现或本地游戏通过代替 Qoder 登录会话中的真实 Agent 使用。宿主真实聊天若未完成，应明确标注待复验。
