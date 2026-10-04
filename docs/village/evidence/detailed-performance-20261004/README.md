# Detailed rendering performance — 2026-10-04 (local)

The comparison uses this unreleased working tree on `9ad7425`, not the older published scene. See the [build ledger](../../../VILLAGE_BUILD.md#2026-10-04--detailed-rendering-budgets-local) for behavior, exact six-view counts and remaining limits.

Chrome 154, Apple M4 / ANGLE Metal, DPR 1, 1366×768 drawing buffer, explicit Detailed, full planting and 2048 px sun shadows. Each fixed view warms for two seconds and samples for six; triangle counts include both color and shadow passes. Camera positions/yaw/pitch are declared in `scripts/village/profile.cjs`. Multiple-draw support is recorded. The engine harness runs the production modules without React/UI or shared visitors; the served-app sample below exercises the full export and real Worker separately.

- [Before](before.json) / [after](after.json): six views; 35.4–68.5% fewer submitted triangles, zero captured errors and 60 FPS display cadence. The first after-run entrance GPU sample overlaps a source-copy operation and is excluded from the timing claim; its counts remain valid.
- [Sequential before](paired-before.json) / [after](paired-after.json): entrance 9.71→7.44 ms mean GPU, overhead 5.80→5.72 ms. Background/GPU conditions varied across repeats. These are measured local samples, not a universal FPS increase or the user's native Firefox reproduction. Both remain capped at 60 FPS.
- [Graphics/shadow/catalog checks](graphics-checks.json): 28 graphics, 84 moving-shadow and all 15 town/editor asset IDs; reduced motion, moving/jumping shadows, minimal/restored shadows, pixel budgets, graphics downgrade paths and native farm-prop loading pass.
- [Batching fallback](batching-fallback.json): Chrome with `WEBGL_multi_draw` deliberately unavailable still renders Detailed at 60 FPS and 2.55M triangles without errors. Draws increase from about 533 to 710; this is a functional fallback check, not native Safari/Firefox performance proof.
- [Contract output](contracts.txt): complete current contracts, 9,746 original animal binary checks, byte-identical farm-prop buffers/puppy subsets and 2,165 topology/placement/bounds/grass-detail assertions pass.
- [Build output](build.txt): successful isolated Next production export. Application and Worker types, lint and static-export privacy also pass; the existing RoomScene image/Browserslist/Next/CommonJS warnings remain.
- [Real two-client production checks](map-travel-checks.txt): 23 map arrivals/broadcasts, keyboard travel, disconnected refusal, reconnection, simultaneous private focus and laptop-size marker checks pass.
- [Served production smoke](production-smoke.json): actual 3051 export / Worker2567; 60 FPS at 1366×768 Detailed, scale 1, shadows enabled, 2.84M triangles/516 draws, all 595 layout items, loaded native farm props, connected shared state, clean 1024×640 resize, zero captured page errors. Its normal camera differs from the fixed harness entrance.

Measured village response bodies drop from 22,215,487 to 19,514,536 bytes (12.2%); the retained static farm props alone save 2,711,480 bytes. Paired loopback loading is 6.28→4.57 s, but other runs vary, and this does not establish constrained-network or shader-warm-up performance.

## Visual captures

Before/after images use the same view coordinates and resolution; wind/actor timing is not pixel-locked. Original architecture/animals/colors, near planting density and shadows are retained. Ground/garden simplification and distant blade contours have their documented visual trade-offs; user approval remains open.

| View | Before | After |
| --- | --- | --- |
| Entrance | [Image](before-entry.png) | [Image](after-entry.png) |
| Pond | [Image](before-pond.png) | [Image](after-pond.png) |
| Pasture | [Image](before-pasture.png) | [Image](after-pasture.png) |
| Stable | [Image](before-stable.png) | [Image](after-stable.png) |
| Orchard | [Image](before-orchard.png) | [Image](after-orchard.png) |
| Overhead | [Image](before-overhead.png) | [Image](after-overhead.png) |

Actual-app [1366×768](production-1366.png) and [1024×640](production-1024.png) captures verify the refreshed local export.

## Preview and reproduction

Reload [the main preview](http://127.0.0.1:3051/) and select Detailed. It serves the successful isolated export at `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/cosy-detailed-build-40c5u969/out`, also recorded by `/tmp/cosy-town-final-preview-path.txt`; Worker2567/editor3040 remain local. The previous preview path is preserved in `/tmp/cosy-detailed-previous-preview-path.txt`. The export contains only `ws://127.0.0.1:2567` and no editor/save/admin route.

Reproduce the renderer sample with the existing QA server and profile tool:

```sh
python3 scripts/village/preview_qa.py --port 3069
PLAYWRIGHT_PATH=/Users/sabar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright URL=http://127.0.0.1:3069 WIDTH=1366 HEIGHT=768 VIEWS=entry,pond,pasture,stable,orchard,overhead CASES=high OUTPUT=/tmp/detailed-profile.json node scripts/village/profile.cjs chrome
```

Use `CHECKS=1` for graphics/shadow/catalog checks or `NO_MULTI_DRAW=1` for fallback validation. The temporary QA servers were stopped after checks; only the normal game, Worker and local editor remain. No Git write or deployment occurred. Native Firefox/Safari, user-machine 40 FPS reproduction, physical laptop/thermal behavior, cold network performance and user visual acceptance remain open.
