# Rendering optimization — October 7, 2026

Local source profiling and isolated production export. No publication or Git writes.

## Implementation

- Static supplemental props are merged once per asset template, then identical geometry/material parts are instanced in 32 m cells. Original placement transforms and instance colors survive. Shadow flags, render order, depth materials and layers remain separate. Unique meshes, transparent surfaces and animated/skinned actors retain their existing rendering paths. This works without WEBGL_multi_draw.
- The existing attribute-aware Meshopt simplifier removes redundant static architectural triangles before spatial batching, with normalized error 0.0001, LockBorder and original normals/UV/color data. Editor captures retain their authoring geometry. No asset, layout or physics files were changed by this optimization.
- Shared farm crops now use independent row bounds instead of one whole-town batch per crop type. The four shared crop geometries are simplified at normalized error 0.002 nearby and 0.02 far away. All 28 plants per row, transforms, accepted watering/growth clocks and disconnect hiding are preserved; `TownCropRendering` owns only this rendering responsibility.
- Garden plants get a shared distant geometry at normalized error 0.02, retaining original vertex attributes and density. Existing cell-distance hysteresis switches beyond 18 m from the nearest cell edge and restores detailed geometry inside 14 m. Original bounds remain conservative; disposal restores source geometry before releasing distant resources.
- Detailed retains its original resolution budget, full planting counts, native actors and 2048 px moving shadows. Graphics reports identify this renderer as `static-detail-v3`.

## Measurements

Chrome 154, Apple M4 / ANGLE Metal, 1920×965, DPR 1, explicit Detailed, same QA positions/camera angles, 2 s settling and 6 s samples. Reported triangles include the main view and refreshed shadow pass. Idle Battery samples alternate shadow refresh frames, so compare means rather than single screenshots.

The first QA pass omitted accepted shared farms and substantially understated this scene. A read-only public Worker snapshot supplied 14 mature rows: four carrot, five radish and five mint, with one empty row. The original mint batch alone submitted **4,037,040 color triangles** at the hilltop. `farm-state.json` contains only public beds and their sampling time; replay applies them to the QA client without changing Worker resources.

| Detailed view, same farm state | Submitted triangles | Draw calls | CPU frame work | Sample FPS |
| --- | --- | --- | --- | --- |
| picnic | 7.65 → 3.58 M | 995 → 868 | 16.24 → 16.16 ms | 53.8 → 56.5 |
| entry | 3.15 → 2.61 M | 646 → 572 | 15.64 → 15.94 ms | 60 → 60 |
| orchard | 2.34 → 1.80 M | 400 → 344 | 11.63 → 12.49 ms | 60 → 60 |

The matched hilltop submits **53.2% fewer triangles** and **12.8% fewer calls**. Frame/CPU/GPU times vary considerably between runs: the final forced-no-multi-draw hilltop sample submits the same 3.58 M triangles with 1,069 calls, 7.90 ms CPU / 9.22 ms GPU and 60 FPS. These short Chrome/M4 samples establish geometry savings, not sustained native Firefox or M1 FPS. The user's original Battery view is a different quality mode and camera pose.

Initial files named `render-*` retain the earlier farm-free baseline and static-prop pass (picnic 3.27 → 2.92 M). The final representative comparisons are `farms-before.json`, `farms-after.json` and `farms-after-fallback.json`, with matched picnic/orchard screenshots. Triangle totals include color and refreshed shadow submissions.

## Verification

- Application lint/types pass in the final build; all required fast contracts pass via `npm test`, including 2,177 rendering topology/transform/bounds/accepted-crop-state checks. The first full check exposed a missing temporary-compiler `@/*` path alias; the alias was fixed and contracts rerun successfully. Existing unrelated RoomScene image lint warning remains.
- Engine graphics/plant-detail checks: 299; moving-shadow checks: 84; supplemental catalog: all 15 expected assets; zero captured page errors. Explicit approaching/distant checks retain plant counts and restore original geometry.
- Isolated optimized Next build and `npm run check:export` pass; no editor, save API or admin route in the export. Checked rendering files are byte-identical to canonical source at build time.
- Worker/rendering parity passes: 1,952 colliders and seven benches. This is local evidence; shared Worker behavior was not changed.
- Visual review: hilltop, entrance, pond and orchard; nearby foliage, woven basket, rooftops and moving actors retained. A test welding matching vertices saved only roughly 1,400 hilltop triangles and was discarded as negligible.

Three real Chrome clients using the final exported app and existing local Worker pass seven join/bridge/reconnection/reduced-motion checks with no page errors (`shared-bridge.json`). The first run assumed exactly three total visitors and timed out because the existing native Firefox visitor was also present; the harness now checks the three test IDs explicitly. No Worker or persisted farm state was modified.

The final local review URL is [127.0.0.1:3051](http://127.0.0.1:3051/), serving `/tmp/cosy-render-farms-20261007-vmrx81fi/out` with Worker2567 and existing persistence retained. All 333 runtime-source/public-asset files match the build snapshot (`source-sha256.json`). Temporary QA servers have been stopped. Reload the Firefox village tab to load this export.

Native Firefox 157 rendered the earlier static-prop pass; that connected view exposed the omitted mature farms, leading to the final crop fix. The final farm export's native check was blocked because the Mac locked and automatic unlock failed. The Firefox preview therefore still needs reload and review; no final native FPS result is claimed. Automated Firefox could not run: available Firefox-1495 rejects the current Playwright protocol's viewport.isMobile field; no browser/dependency installation or patch was made.

No physical/native iPad, Safari, M1 hardware, thermal-duration, cold-network or live deployment acceptance is established. CSS viewport checks from other tasks do not prove native performance. Near/far mesh transitions have hysteresis but no crossfade, so plant shape changes at the boundary may be visible.

## Research and next priorities

Primary sources checked October 7:

- [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices): batch draws, keep static vertex bindings, avoid synchronous GPU readback and use bounded drawing-buffer budgets.
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): reuse geometry/materials across transforms; update conservative bounds when instances change. Instancing reduces submission overhead but does not itself reduce triangles.
- [Three.js LOD](https://threejs.org/docs/pages/LOD.html): use simpler distant meshes with hysteresis. This project retains its existing instanced-cell implementation rather than adding one Object3D LOD controller per blade.
- [Three.js BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html): per-object frustum culling and sorting; multi-draw is optional, so fallback must be measured.
- [Meshoptimizer simplification](https://github.com/zeux/meshoptimizer#simplification): preserve attribute discontinuities/borders and choose error bounds; simplification is constrained by appearance, not just a requested triangle ratio.

Further optimization should use a repeatable Firefox 157 camera path on the affected machine. Prioritize screen-size-based LODs for dense static foliage and roofs, material consolidation for meadow cells, and shadow-caster/pass attribution. Measure fragment/overdraw cost before lowering resolution. A terrain/hill occlusion system needs profiling and conservative visibility handling; blanket camera-frustum hiding would remove offscreen shadow casters. A WebGPU/engine rewrite or one giant world mesh is not justified by the present measurements.

Reproduce with `scripts/village/preview_qa.py`, then `PLAYWRIGHT_PATH=/path/to/existing/playwright URL=http://127.0.0.1:3074 WIDTH=1920 HEIGHT=965 VIEWS=picnic,entry,orchard CASES=high FARM_STATE=/absolute/path/to/farm-state.json OUTPUT=/tmp/profile.json node scripts/village/profile.cjs chrome`. Add `NO_MULTI_DRAW=1` for the fallback, or `CHECKS=1` for graphics and shadow contracts. The new `picnic` view reproduces the western hilltop.
