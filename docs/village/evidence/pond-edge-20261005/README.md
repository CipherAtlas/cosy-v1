# Pond dock landing and shoreline stones — local evidence

The dock-side bench is hidden in the working layout. A 3.6 m-wide straight-path landing covers its former green entrance patch; dock approach/pond return paths are 2.2 m wide. Ninety-seven instances of the existing Small riverbank stone line the pond edge, grounded to the rendered bank. The pond, dock, bank, terrain and routes remain intact.

- `before.png`, `before-down.png`: preceding bench/approach geometry.
- `after.png`, `after-down.png`: final actual-engine views of the open dock entrance, stone landing and shoreline rocks.
- `after-scene.json`: final seven-bench catalog, 97 stones, four clear approach/deck positions and zero page errors.
- `scope-checks.json`: exactly three existing layout objects changed and 98 existing-asset placements added; routes/terrain preserved; final physics hash and 1,889 colliders/seven benches.
- `shared-clients.json`: seven real WebSocket checks on isolated Worker2583: removed-seat refusal for two clients, unchanged-seat contention, leave/reuse and fresh joining.
- `editor-api-checks.json`: current editor validation plus actual temporary named save/reload, including a stone position/rotation/scale edit and hidden bench retention.

Fresh isolated build, subsequent types/export privacy and full contracts pass. The first contract attempt observed a stale physics hash during the landing refinement; final matching physics and contracts pass. The first editor snapshot missed the existing stone allowlist; using current editor source corrects validation. Editor UI readiness timed out twice; the final UI attempt was stopped. Pointer-control appearance and native Firefox acceptance are unverified. The isolated snapshot is recorded in `/tmp/cosy-pond-edge-snapshot-path.txt`; the side chat did not switch or restart main3051/Worker2567. Their next coordinated refresh must include source layout/physics. No Git writes or deployment.
