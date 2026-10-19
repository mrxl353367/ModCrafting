# Fabric Plugin GitHub Actions 与 Release 规则

## 背景

新默认发布线已从旧 Electron/Desktop 转为 Fabric MCP、Qoder Plugin 与浏览器工作台。旧 Desktop CI/Release 规则面向 Setup/Portable 安装器、旧更新索引和 Gitee，不能用于当前产品；旧 `main` 继续保留历史。

## 实施

- CI 仅面向 `release` Pull Request、推送、手动运行和 Release 可复用调用，升级到当前 GitHub Actions 主版本，并覆盖类型检查、插件回归、MCP Smoke、Fabric-Bench fixture 和白名单 Stage。
- Release 由明确推送的 `v*` tag 触发；tag 必须与根 package 版本完全一致且指向 `release` 历史。
- 发布 job 构建同一 tag 下的 Observer V2 完整候选，复用 Qoder/跨宿主 Stage 并输出桌面 Qoder ZIP、跨宿主包、来源/指纹信息、SHA-256 校验和与中文发布说明。
- 稳定版显式设置 GitHub Latest，避免历史 `v1.0.x` Desktop Release 继续冒充当前最新产品；预发布不覆盖 Latest。没有改写旧 Release、创建 tag 或实际发布新版本。
- 发布说明记录 CI 不运行真实 Minecraft 玩法或登录后的 Qoder Agent 聊天。人工验收清单仍由候选验收记录约束。

## 验证

使用已有本地完整候选包验证 release packager，确认 Qoder ZIP 与跨宿主 ZIP 可生成、隐藏插件 manifest 保留、校验和可重算，且版本不匹配会拒绝打包。类型检查通过；插件回归 107/107；MCP Smoke 发现 26 个工具；Fabric-Bench fixture 21/21 符合预期（5 PASS、5 FAIL、11 INCONCLUSIVE）；插件构建、manifest 校验、白名单 Stage 和 workflow YAML 解析通过。GitHub Actions CI 在提交 `8542c67` 的云端运行 [39216675522](https://github.com/newstarbar/ModCrafting/actions/runs/39216675522) 全部通过。Release 工作流已由 GitHub 识别，但本次未推送 tag，因此没有创建 Release；真实 Qoder 登录聊天及 Minecraft 玩法也未在本次验收。
