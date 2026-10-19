---
description: 打包当前模组并说明结果。
argument-hint: 工程路径（可省略）
---

按 modcrafting-start 的沟通约定执行。优先使用 $ARGUMENTS 路径，否则使用当前工作目录。检查环境和 fabric_validate，再执行 fabric_build_start(task="build")，通过 fabric_job_status 等待真实结束；任务编号不等于成功。首次下载前说明网络和实际缓存位置，遵循用户授权与宿主策略。成功后用普通中文给出模组产物位置；失败时解释原因与下一步，详细日志按需提供。不自动修改代码、启动游戏或发布。
