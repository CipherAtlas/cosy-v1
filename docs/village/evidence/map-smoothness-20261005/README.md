# Map smoothness and geographic anchors — local 2026-10-05

The final atlas updates player glyphs on uncapped animation frames, keeps destination icons at their true coordinates, anchors Little postbox to the saved prop, and offers one **Meadow Swings** option. Clear destination names remain visible; crowded names reveal directly above the icon on pointer hover or keyboard focus. Player markers retain their gold/blue treatment and draw above destinations. Shared simulation and action clocks continue while hidden 3D drawing is suspended.

## Measured optimized exports

Five-second samples use an actual accepted moving visitor over a local Worker WebSocket, Chrome headless at 1366×768, and CDP CPU metrics. The second visitor is a socket in the same browser, avoiding a second hidden 3D renderer during profiling. Both samples use the existing low scene preference. The final three profile assertions passed.

| Measurement | Before | Final |
| --- | ---: | ---: |
| Browser animation cadence | 60.21 FPS | 60.09 FPS |
| Visible player-marker updates | 3.79/s | 58.49/s |
| p95 frame interval | 16.7 ms | 16.7 ms |
| Longest measured interval | 16.8 ms | 16.8 ms |
| Main-thread task time | 2,146.6 ms | 1,340.6 ms |
| Script time | 1,618.1 ms | 538.8 ms |
| Landscape mutations | 0 | 0 |
| Hidden-world renders | Not sampled | 0 |
| Postbox icon displacement from anchor | (+120.7, +181.6) px | (0, 0) px |

[Before metrics](before/performance.json), [final metrics](after/performance.json), [final capture](after/atlas-profile.png). The original choppiness was the four-Hz marker pose poll despite a 60-Hz browser. The pose poll now changes only the roster; direct SVG transforms follow interpolated engine positions. The full scene is no longer submitted underneath the opaque map. FPS itself was already near 60 in the baseline; the improvement is visible marker cadence and lower processing cost.

This scheduler sample does not prove a physical 120-Hz display. The map has no 60-FPS timer cap and can follow the display's animation frames. Native Firefox/Safari, physical laptop/GPU acceptance, long sessions and crowded-world performance remain unverified. Co-located player names can overlap; moving players may briefly cover a destination label, but their markers retain true coordinates.

## Browser and build verification

[71 actual three-client checks](three-client/checks.json) pass before the final hover-label spacing refinement; the final served checks cover that refinement. They cover true self/remote anchors, gold/blue markers and readable names, absence of NPC/dog markers/callout lines, accepted keyboard motion, exact saved postbox coordinates, one unnumbered swing option, 3D draw suspension/resumption, custom cursor, four full-screen desktop windows, 44-pixel buttons clickable at their actual centres, visible label geometry, unobstructed edge controls, all seven accepted outdoor arrivals and observer broadcasts, independent private focus, disconnect refusal/reconnect, Enter, rebinding, Japanese and reduced motion. There are no page errors.

Reviewed final [1366×768](three-client/atlas-1366.png), [1280×720](three-client/atlas-1280.png), [1024×640](three-client/atlas-1024.png) and [800×640](three-client/atlas-800.png) screenshots. Iterations caught central label collisions, misleading far-away names and selected destinations covering the gold player marker. Final labels stay close to anchors, crowded labels are contextual, and player markers draw above destination highlights. Retained `failed-client-*.png` files are earlier attempts, not accepted final captures.

Final optimized production build with lint/types, snapshot and checkout typechecks, export privacy and `git diff --check` pass. Full lint/Worker/types/contracts passed before the final label-only refinements; shared authority and physical objects were unchanged by those refinements. Snapshot source is recorded in `/tmp/cosy-map-smooth-preview-path.txt`, based on the served lookout-walking snapshot and preserving farm/bridge/riverbank/watchtower work. QA Worker2585 was isolated from regular Worker2567 and stopped after verification.

The main preview now serves the byte-identical checked export on 3051; its source is also recorded in `/tmp/cosy-town-final-preview-path.txt`. [30 final actual-served map/basket checks](served/checks.json) pass with the regular shared connection, postbox hover/name geometry at all four desktop sizes, correct saved coordinates, one unnumbered swing option, retained physical landmarks, absent NPC/dog markers, 3D draw suspension/resumption and accepted private inventory; no page errors. Reviewed [served postbox at 1280×720](served/map-1280.png) and [800×640](served/map-800.png). Reload existing preview tabs. No Git writes, deployment, saved layout or physics changes were made.

To reproduce the isolated profile after starting the matching local QA Worker:

```sh
PLAYWRIGHT_PATH=/Users/sabar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
EXPORT_DIR="$(cat /tmp/cosy-map-smooth-preview-path.txt)/out" \
LOCAL_WORKER_URL=ws://127.0.0.1:2585 \
MAP_PROFILE_ONLY=1 OUTPUT_DIR=/tmp/cosy-map-profile \
node scripts/village/tests/map-travel.cjs
```

Omit `MAP_PROFILE_ONLY` to run the three-client regression. To check the actual served preview, run `scripts/village/tests/town-interface.cjs` with `VILLAGE_URL=http://127.0.0.1:3051/` and an `OUTPUT_DIR`.
