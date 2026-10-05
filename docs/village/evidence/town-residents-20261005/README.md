# Farmers and horse caretaker — local 2026-10-05

Rusk is the gruff carrot farmer, Poppy the cheerful radish farmer and Cress the dreamy mint farmer. Rowan tends available stable horses on shared feeding/petting clocks. All four use the current projected villager dialogue; Rowan reveals **Race together C** after **Chat F**. Acceptance automatically seats the visitor and Rowan; rejected requests grant no race or mount.

## Evidence

- [27 actual two-client browser assertions](checks.json): farmer personality/dialogue, real keycaps and 44 px targets at 1366×768/1024×640, competing owners, observer speech, owner-only invitations, automatic mount, no duplicate Rowan, cancel, disconnect and reconnect. Zero page errors.
- [26 actual three-client regressions](shared-regression/checks.json): full bench refusal and distinct seats, leaving, dog/resident contention, tricks/following, disconnect/reconnect, shared flock clocks, simultaneous private focus and smaller desktop layouts. Zero page errors.
- [19 real editor checks](editor-checks.json): rendered previews, position/rotation/uniform scale, named routes, named save/reload, isolated Apply. Zero page errors.
- [30 focused resident/authority checks](resident-checks.log): accepted talk/invite, direct-start refusal, occupied horses/no partial grants, shared countdown/restoration/return, stationary farmer conversations and horse feeding/petting.
- [61 actual SQLite/WebSocket town checks](town-runtime-checks.json): accepted race invitation followed by authoritative horse input through eight gates, countdown/observer state, finish, hibernation, cancelled/departed racers and private focus; existing farm/animal/resource checks remain.
- [Fresh contract summary](contracts-summary.log): lint and application/Worker types pass; full village contracts pass, including 98 shared-world Worker checks and 112 shared town checks. Existing RoomScene image warning remains.
- Isolated production build and static-export privacy check pass. Renderer/Worker parity confirms 1,890 colliders/eight benches unchanged, with matching layout fingerprint.

## Captures

[Grumpy Rusk](rusk-dialogue.png), [cheerful Poppy](poppy-dialogue.png), [dreamy Cress](cress-dialogue.png), [Rowan's invitation](rowan-invitation.png), [accepted mounted racers](race-mounted.png). All four real asset thumbnails are saved as `editor-*-preview.png`.

## Reproduction and limits

Run `node scripts/village/tests/town-residents.cjs` and `npm run check` from the project. The actual town runner is `scripts/village/tests/town-runtime.cjs`; set `TEST_TOOLS_ROOT` to the already-installed external Miniflare 5/esbuild directory. It creates/disposes its own local SQLite fixture and accelerates its server clock.

The resident and broader browser runners require the installed external `PLAYWRIGHT_PATH`, an isolated `EXPORT_DIR`, `LOCAL_WORKER_URL=ws://127.0.0.1:2579` and `OUTPUT_DIR`. They fulfill preview-origin requests directly from that export, preserving the main 3051 server. The editor runner uses `EDITOR_URL=http://127.0.0.1:3042` against a disposable source copy: its Save and Apply stages must never target the user's normal editor. Source-copy path was recorded in `/tmp/cosy-town-residents-build-path.txt`; its editor Apply deliberately changes only that copy, while its earlier exported build retains the canonical playable layout.

Fresh browser evidence covers the resident implementation. The isolated build predates concurrent changes to the farm action panel, so the farm HUD in these captures reflects that earlier snapshot. Those later source edits are preserved and pass the fresh contracts/types. Main preview3051, Worker2567 and editor3040 remain untouched; test services are closed after verification. No deployment, Git writes, physical-device acceptance or native Firefox/Safari review.
