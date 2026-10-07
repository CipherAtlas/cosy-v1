# Kitchen and pond-side picnic — local evidence

The kitchen is in the eastern clearing (113,-78). The grassy hill is on the western outskirts beyond the pond (-108,-22), with a 24 m summit, winding walking trail, flowers, trees, blanket, basket and two shared cushions.

- `worker.json`: 36 actual SQLite Durable Object/WebSocket checks, covering all four recipes, cook contention, ingredient spending, pack-once/reconnect, shared portions/late join/final removal, remote refusal, bite cooldown, full/released/disconnected seats, private-focus isolation, full-mat preservation, transaction rollback and recovery. Ingredients, clock acceleration and a failed write exist only in the test Worker copy.
- `browser.json`: 26 actual three-browser checks against the local static export and isolated Worker. Covers cook/steam/pack/share, keyboard E eating, late joining, occupied cushions, seated eating/final removal and reload. The later UI cleanup does not change these authority/seat paths; `ui-final.json` checks the final menu source separately.
- `ui-final.json`: 28 final served UI checks after copy cleanup: laptop/small windows and six iPad orientations, no Settings controls inside cooking/picnic menus, Japanese copy, guide copy, atlas marker visibility and accepted travel.
- `preview.json`: five final checks against the regular export3051/Worker2567, including shared connection, accepted travel to both destinations and 24 m terrain parity, with zero page errors and no ingredient grants. The historical Worker snapshot was refreshed from current source while retaining its persistence directory.
- `editor.json`: 38 actual Chrome Layout Studio checks for all seven props: geometry previews, pointer placement, Scene selection, position/yaw/scale, file save/reload and temporary Apply. The fixture contains terrain and picnic props, omitting unrelated town objects/routes. Canonical layout, existing named designs and original presets stay byte-identical throughout this test.
- `layout.json`: 430 saved-layout/renderer-physics checks, including actual walking up the entire trail without jumping, 24 m summit and kitchen/hill separation. Worker physics matches 1,896 colliders and eight bench entities, including the two-seat mat.
- `cooking-ui.png`, `picnic-ipad.png`, `kitchen-japanese.png`: final served UI screenshots. `kitchen.png`, `hill.png`, `village-view.png`: actual engine geometry review; the two display dishes/steam in these three scenery captures use synthetic rendering state, not resource acceptance evidence.

Browser sizes include 1366×768, 1024×640 and 810×1080, 820×1180, 744×1133 with all three tablet rotations. These are CSS/touch-capability checks, not native/physical iPad acceptance. Long-session performance, physical-device comfort, live production and deployment are unverified. No Git writes or deployment were performed.

Reproduction uses existing external test dependencies; no dependency installation or repository configuration changes:

```sh
TEST_TOOLS_ROOT=/path/to/wrangler/node_modules node scripts/village/tests/picnic-worker.cjs
PICNIC_BROWSER_ONLY=1 PICNIC_UI_ONLY=1 TEST_TOOLS_ROOT=/path/to/wrangler/node_modules PLAYWRIGHT_PATH=/path/to/playwright node scripts/village/tests/picnic-worker.cjs
EDITOR_URL=http://127.0.0.1:3041 PLAYWRIGHT_PATH=/path/to/playwright node scripts/village/tests/picnic-editor.cjs
```

Serve the fresh static export on 3051. The editor test requires an isolated server with temporary `--layouts-dir` and `--playable-file` paths; never point it at the user's active editor. For the full three-browser flow omit `PICNIC_UI_ONLY`. Required production build/types/contracts/export boundaries are recorded in `VILLAGE_BUILD.md`.
