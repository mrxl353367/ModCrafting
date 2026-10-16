---
description: Validate and build a Fabric project, then report its final result.
argument-hint: Absolute Fabric project path
---

For the Fabric 1.21.4 project in $ARGUMENTS, inspect the environment and run fabric_validate, then fabric_build_start with task build. If no path was supplied, ask for it. Poll fabric_job_status using the returned jobId until completion. Report the final status and useful errors; receiving a jobId is not success. Do not modify code, start Minecraft or publish artifacts.
