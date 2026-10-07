# Water and bridge refinement — 2026-10-07

Local production-engine and exported-app verification only. Preview: http://127.0.0.1:3051, matching local Worker: ws://127.0.0.1:2567. No publication or Git writes.

- `bridge-corners-local.json`: 60 runtime/editor checks, including rendered animated/frozen waterfall pixels, physical deck rays, original bridge openings, real W input, and isolated bridge transform/save/reload.
- `editor.json`: nine waterfall shelf, transform, save/reload and temporary Apply checks; source layout and protected saved files remain byte-identical.
- `shared-bridge.json`: seven exported-app checks with three real clients. Keyboard crossings use laptop and iPad CSS sizes in opposite directions, a third client observes both outcomes and reconnects, and reduced motion freezes the real water clock. Bank placement is a QA fixture; no resources or claims are granted.
- `scene-visual.json` and PNGs: final waterfall/stream/bridge rendering with no shader, batching or page errors. FPS samples include warmup/camera changes and do not prove sustained performance.
- Logs: full lint/types/contracts, final production build, post-build types/export privacy, 487 layout/physics checks, bridge geometry/jump/recovery/rail contracts, and 122 Worker contracts.

Walking stress checks hold into both rails in both directions at 30/60/120 fps. The rotated hill bridge retains clear footprints and speed above 2.4 m/s after acceleration. Worker physics is regenerated from the same renderer and the source/export layout bytes match.

Native Firefox/Safari, physical iPad, full tablet UI acceptance, long sessions and production remain unverified.
