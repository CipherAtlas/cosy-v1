# Radish-bank repair — October 8, 2026

Solid collision is restored for automatic riverside stones and independent pond stones. Only stream corridors receive finer terrain triangles, keeping green ground below the water beside the radish farm. Narrow paved banks retain stone edging; overlapping paving shoulders preserve paving at junctions. Bridge side entrances remain clear. The local editor regenerates the same surfaces and collisions when editing; saved designs and protected presets are unchanged.

- `radish-before.png`: source-module reproduction at 1366×768, Detailed/golden.
- `radish-after.png`: final actual-served local export at the same position, 1366×768, Detailed/golden. The full UI and shared residents are present.
- `served.json`: local shared connection, matching 3,323 colliders, all 1,366 generated rock bounds matching saved Worker boxes within 0.1 mm, bank samples and no page errors. The tolerance accounts for Float32 instance matrices.
- `check.log`, `build.log`: fresh full lint/types/contracts and production build. Export privacy passed separately.
- `physics.log`: 498 actual-collision layout checks, including the curved-river terrain and overlapping-paving regressions.
- `bridge-checks.json`: 56 final production-engine checks including side access, crossing, water motion and no page errors. An earlier candidate obstructed an approach; final clearance passes.
- `editor-checks.json`: 23 isolated shelf, transformed collision, grounding, river-edit and named-save/reload checks. The fixture tests precede the final bridge-only clearance widening; final world checks cover that widening. The first editor attempt omitted the temporary playable file and timed out; corrected fixture setup passes.
- `shared-checks.json`, `shared.log`: 27 real three-client checks including riding contention, observer attachment, leaving/disconnection/reconnection, full seats and simultaneous private focus.

Port3051 serves `out` from the final build and connects to the existing local Worker2567 with retained storage. The isolated QA/editor servers are stopped after verification. This paragraph records the local development checkpoint; publication evidence follows. No dependencies, layouts or presets changed.

## Published release

Code commit `da23d2d` is pushed to `main`. [Pages build and deploy](https://github.com/CipherAtlas/cosy-v1/actions/runs/37670619730) succeeded after one unchanged retry of an existing Google-font loader failure. The isolated root-path production build uses the public Worker endpoint and passes export privacy; all 120 village/Worker source and physics/layout files match the checked local snapshot. The preceding local multi-client evidence is reused, not relabelled as live contention testing.

Worker version `b2844b37-1245-46fc-85f2-edb44d57c286` is deployed with healthy `/health`. `live-http.json` records byte-identical public layout and 404 responses for editor/admin/save-API/tools/AGENTS paths. `live-radish.png` records the released shoreline at 1366×768. `live-checks.json` records nine fresh live Chrome checks: shared entry, collider catalog, all 1,366 automatic rocks matching saved boxes within 0.1 mm, accepted farm travel, private cottage/cat, button exit, accepted return travel and farmer speech. No page errors or failed resource responses were captured. Early fixtures used an unsupported focus map call, checked before cottage assets finished loading and did not wait for return travel. The final check uses actual map/leave controls and accepted Worker results; it does not establish live keyboard exit. Native Firefox/Safari, physical devices, sustained performance and subjective user acceptance remain open.
