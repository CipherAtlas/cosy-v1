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

Port3051 serves `out` from the final build and connects to the existing local Worker2567 with retained storage. The isolated QA/editor servers are stopped after verification. This is local Chrome/source evidence; native Firefox/Safari, physical iPads/laptops, sustained performance and live-site acceptance remain open. No dependencies, layouts, presets, Git writes or deployment changes.
