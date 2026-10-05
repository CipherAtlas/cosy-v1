# Full-screen village atlas — 2026-10-05 (local)

M/the personal map binding opens and closes the atlas; Escape and the close button return to the village. A native cream-and-green cursor covers the entire map, including destination buttons. The landscape fills the viewport without stretching world coordinates; responsive bounds and callouts keep 44 px destinations clear of the compact forest-green edge controls. Hover/focus highlights and labels a destination. Click, keyboard navigation and Enter retain the accepted shared travel paths. Closing uses a 180 ms fade, removed for reduced motion.

## Verification

- `npm run check` passed earlier in this task. Unchanged contracts are reused for the final map-only refinement; the final isolated production build runs lint and type validation again, followed by `npm run typecheck` and `npm run check:export`, all passing.
- [49 actual two-client atlas checks](checks.json) passed against the served export: all eight outdoor arrivals and observer broadcasts, simultaneous private cottages, disconnected refusal/reconnect, M/Escape/close-button focus return, cursor scoping, Enter, personal binding/keycap, Japanese labels, arrows and reduced motion. No page errors.
- Full-screen geometry, separated 44 px markers and unobstructed edge controls pass at [1366×768](atlas-1366.png), [1280×720](atlas-1280.png), [1024×640](atlas-1024.png) and [800×640](atlas-800.png). Captures fast-forward opening animations to show settled appearance.
- Broader three-client regression: the [initial run](shared-initial/failed-checks.json) and the [fresh snapshot Worker rerun](shared/failed-checks.json) each pass 11 checks, then time out waiting for dog pet mode after reconnect, before opening the atlas. Both capture no page errors. This unresolved dog-petting regression is outside the map change; no dog/Worker behavior is edited here. Reports and captures are retained. [19 focused three-client swing checks](seats/checks.json) pass for both physical swing sets: distinct accepted seats, full-seat refusal, release, disconnect and reconnect; no page errors.

The preview at `http://127.0.0.1:3051` serves `/tmp/cosy-fullscreen-map-build-UPAWeP/out`, also recorded in `/tmp/cosy-fullscreen-map-build-path.txt`. Its source snapshot isolates the atlas from later concurrent village edits. Worker2567 now runs the same snapshot with fresh temporary local storage. The three map TSX files and the atlas CSS block match the verified snapshot byte-for-byte; later farm-only CSS edits are preserved in the checkout. The existing Tab-hint change and all concurrent work are preserved; no Git writes or deployment.

## Reproduce

```bash
PLAYWRIGHT_PATH=/Users/sabar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
EXPORT_DIR="$(cat /tmp/cosy-fullscreen-map-build-path.txt)/out" \
LOCAL_WORKER_URL=ws://127.0.0.1:2567 USE_SERVED_EXPORT=1 \
OUTPUT_DIR=docs/village/evidence/fullscreen-map-20261005 \
node scripts/village/tests/map-travel.cjs
```

Native Firefox/Safari, physical laptop review and OS cursor appearance remain unverified. The illustration uses existing map scenery; no new world assets or editor registrations are needed.
