# Simpler village atlas — local, 2026-10-05

The final map contains destination options, your gold compass and larger blue markers for other outdoor visitors. NPCs and dogs are absent from both maps. Player names are centered directly above their true positions; neither player markers nor names use callout lines. Destination guide lines are also removed. The full-screen view is 18% closer, with upright 13 px labels and 44 px destination buttons. Controls make room for player names; outer destinations are placed before central options so they stay closer to their world locations.

[Three-client report](checks.json) checks actual exported UI and local WebSocket clients: uniform blue markers, the gold self marker, exact player anchors, names above, real keyboard movement, private-focus hiding, full-screen/custom-cursor behavior, four window sizes, eight accepted clicked arrivals and observer broadcasts, Enter travel, disconnect refusal/reconnect, independent private cottages, reduced motion, map-key rebinding and Japanese labels. All 65 assertions pass with zero page errors. The updated existing map/basket regression also passes [20 actual served checks](town-interface/checks.json), covering authored landmarks, visibility at three sizes and accepted private inventory. Final production build, types, full lint/Worker/types/contracts and export privacy pass.

- [1366×768](atlas-1366.png)
- [1280×720](atlas-1280.png)
- [1024×640](atlas-1024.png)
- [800×640](atlas-800.png)

Testing uses the isolated export recorded in `/tmp/cosy-map-final-preview-path.txt` and a separate QA Worker on 2577. The static export itself connects to the regular local Worker2567. Port3051 serves this final export. [Actual-served smoke](served-smoke.json) confirms byte-identical HTML, the connected regular Worker, readable names, the gold marker, no NPCs/dogs or guide lines, the custom cursor and accepted travel; [served capture](served-atlas.png). It preserves the served farm controls, authored bridge paths, riverbank stones, watchtower and floor repair. No shared-action rules, world objects, layout/editor data or production services are changed by this map work.

The temporary QA Worker was stopped after verification. To reproduce, start `wrangler dev --config wrangler.jsonc --local --port 2577 --persist-to /tmp/cosy-map-labels-worker-state` from the snapshot directory, then run from the repository:

```sh
PLAYWRIGHT_PATH=/Users/sabar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
EXPORT_DIR="$(cat /tmp/cosy-map-final-preview-path.txt)/out" \
LOCAL_WORKER_URL=ws://127.0.0.1:2577 \
OUTPUT_DIR=docs/village/evidence/map-labels-20261005 \
node scripts/village/tests/map-travel.cjs
```

`earlier-attempts/` contains intermediate captures, not the accepted final design. Exact co-located player names can overlap because their markers retain true positions. This is local Chrome verification; physical laptop, native Firefox/Safari appearance and deployment are not claimed.
