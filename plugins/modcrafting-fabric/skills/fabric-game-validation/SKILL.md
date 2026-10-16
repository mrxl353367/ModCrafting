---
name: fabric-game-validation
description: Validate Fabric 1.21.4 gameplay changes with Observer V2 and deterministic ModCrafting game tests.
---

Use this skill when a Fabric change needs in-game evidence.

1. Build successfully, then use `minecraft_run_client` and poll `minecraft_runtime_status` until Observer V2 is ready.
2. Use `minecraft_snapshot`, `minecraft_command`, and `minecraft_input` only against the running local instance.
3. Submit a V2 test through `minecraft_test_start`. Its spec must include setup, actions, assertions, and cleanup.
4. Tests run only in `ModCrafting Test World` and the reserved test region. Never use a developer's ordinary world for automated cleanup.
5. Treat `PASS` as all structured assertions passing; use `FAIL` for observed product failures and `INCONCLUSIVE` for unavailable bridge capabilities, visual-only claims, or environment failures. A screenshot or command dispatch alone is not PASS.

This plugin supports inventory_contains, block_equals, entity_exists, snapshot_value, and snapshot_changed with fresh before/after snapshots. HUD, command_result, and trace-source snapshot assertions are CAPABILITY_UNAVAILABLE until freshness/semantics are implemented. Empty actions/assertions or malformed fields are INVALID_SPEC. Missing evidence and cleanup failure must never PASS. Check the report's code and cleanup status; these capabilities do not equal the full Desktop test engine.

Live entity_exists assertions with a tag are CAPABILITY_UNAVAILABLE: Observer V2 reads client entities and cannot verify server command tags. Use entityType for observed entities; server tags may still identify owned entities in cleanup commands.
