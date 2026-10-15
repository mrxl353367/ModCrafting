# Iron Ticket

最小真实模组验收：右键使用一张 `iron_ticket:ticket`，获得一枚铁锭并消耗兑换券。物品通过测试命令放入背包，奖励由模组的服务端 use 实现产生。

使用 ModCrafting MCP scaffold 创建 `modId=iron_ticket` 的新 Fabric 1.21.4 工程（含 Windows Wrapper），再将本目录 src 合并到新工程 src，执行 build。用 `/give @s iron_ticket:ticket 2` 获取道具。当前演示使用原版铁锭纹理和中英物品名称，不添加配方或创造物品栏。

test-spec.json 只适用于专用 ModCrafting Test World 与保留区域，会清空测试玩家背包并清理测试平台。开发者验收脚本每次使用世界副本，完整步骤见 [候选版本指南](../../docs/candidate-validation.md)。代码生成前已执行标准物品数据查询；GPL-3.0，遵循仓库许可证。
