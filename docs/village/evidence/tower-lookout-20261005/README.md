# Watchtower circular lookout — local evidence

The existing watchtower now has an open timber gallery under its teal roof. Visitors enter at the door, observe the real town in first person, rotate through 360°, look down/up and return with Esc or Come down.

- `checks.json`: 22 actual exported-app checks against isolated Worker2579, including three rendered browser clients, eight real WebSocket gallery occupants and ninth-visitor refusal, disconnect/reconnect/late join, simultaneous private focus and four desktop sizes.
- `served-checks.json`: eight fresh checks against actual port 3051 and matching Worker2567 after the final integrated build, including observer height, compact controls and safe exits.
- `editor-checks.json`: six real local editor checks for registration, rendered preview, placement/rotation and named save/reload. Uses temporary copies; protected presets stay unchanged.
- `tower-village-served.png`: final first-person view and compact translucent controls on the actual served preview.
- `tower-entrance.png`, `tower-village.png`, `tower-down.png`: rendered gallery entry and camera views.
- `editor-tower-preview.png`: the complete reusable tower asset, including the gallery and door.

Fresh build/types/contracts/export privacy pass; contracts include 116 Worker assertions, 18 added for gallery authority/capacity/release/transformed placement. Final rendering/Worker physics match 1,890 colliders and eight benches. Build directory: `/tmp/cosy-lookout-build-path.txt`; active preview directory: `/tmp/cosy-town-final-preview-path.txt`. Only local WebSocket endpoint 2567 is emitted. The matching local Worker preserves its existing state directory. Later map and riverbank updates are included in the final served build; the original 22 gallery behavior checks are reused for unchanged gallery/controller/Worker code, with fresh served layout/entry/exit checks after integration.

This is local Chrome browser evidence. Native Firefox/Safari appearance, physical-device performance and production publication are unverified. No Git writes or deployment.

## Firefox floor flicker correction

The initial Chrome evidence missed two coplanar floor caps. Native Firefox reproduced the flashing cream/timber triangles. `scripts/village/tests/tower-lookout.cjs` raycasts the real reusable tower: it failed with two meshes at the nearest depth before the fix and passes with one timber floor after lowering the stone support by 0.08 m. The same gallery geometry appears in the editor; placement and shared floor height remain unchanged.

Fresh full contracts, isolated build, subsequent types/export privacy and eight served checks pass. `floor-fix-served-checks.json` and `tower-floor-fix-served.png` record the corrected served build. Preview snapshot: `/tmp/cosy-lookout-floor-fix-path.txt`; active directory: `/tmp/cosy-town-final-preview-path.txt`. The existing local Worker and state are unchanged.

Post-fix native Firefox visual acceptance is still open: reload navigation/HTTP requests changed, but computer-use screenshots kept returning the old frame and AX omitted page content, including after resetting/reacquiring the connection and trying a fresh tab. The extra tab was closed. No production release or Git writes.

## First-person gallery walking

WASD/arrows walk/strafe around the deck; mouse look remains independent. Home/End turn and Page Up/Page Down tilt. The Worker accepts bounded walking poses and corrects requests beyond the 3.05 m railing boundary or authored floor height. Shared admission stays capped at eight visitors.

- `walking-checks.json`: 26 real Chrome checks with isolated Worker2587 and actual 3051 frontend, covering walking/observer positions, railing safety, all camera controls, four desktop sizes, exits, re-entry, disconnect/reconnect, late join, real gallery capacity and simultaneous private focus.
- `walking-served-checks.json`: eight final actual 3051/Worker2567 checks, including the later served map-smoothing build, accepted entry/observer elevation, compact controls and safe exits.
- `tower-walking.png`, `tower-walking-down.png`: viewpoint at the railing and steep downward camera view.

Fresh feature-snapshot build/types/export and full contracts pass, including 121 Worker assertions. Feature build: `/tmp/cosy-lookout-walk-path.txt`; active frontend: `/tmp/cosy-town-final-preview-path.txt`. Worker2567 preserves its existing state. Initial browser attempts saw delayed/retrying WebSocket joins during concurrent local checks; isolated final QA passes. The checkout's concurrent layout briefly mismatched its physics fingerprint; the matching feature snapshot passes and unrelated work remains intact. No asset/physics changes; earlier editor placement/save/reload checks are reused for unchanged asset/editor code. Firefox loaded this build and its shared connection was confirmed in the native console; native gallery walking/appearance remains unverified after user activity and control-service interruptions. No publication or Git writes.

## Multiplayer perception review — 2026-10-05

[19 final checks](multiplayer-checks.json) use the actual served 3051 export, four independent Chrome browser clients and six additional real WebSocket clients for eight gallery occupants. Fresh local Worker2593 isolates contention from the regular preview. It covers simultaneous entry, ground/upstairs visible named spirits, independent walking observed on the ground, immediate late-join XYZ/claims, authoritative floor correction, overlap behavior, full capacity/refusal/refreed capacity, visible departure, disconnect/reconnect and simultaneous private focus. No page errors. [Eight final normal-preview checks](multiplayer-served-checks.json) pass on Worker2567 at four desktop sizes; this last two-client suite uses `LOW_RESOURCE=1` (10 FPS drawing, half pixel ratio) and runs alone.

Two bugs were corrected. Worker welcome snapshots now include `lookout` metadata alongside current walking XYZ; both the browser and Worker regressions failed before the correction. Remote visitor rendering now snaps on tower admission changes while retaining walking interpolation. A dedicated real-browser transition regression failed against the old renderer; final sync-time checks confirm zero distance between observed and accepted positions on entry, crowded arrival and exit. Compare [floating arrival before](multiplayer-floating-before.png) with [the full gallery after](multiplayer-full-gallery.png). Other captures show [ground view](multiplayer-from-ground.png), [upstairs view](multiplayer-inside.png), [observed walking](multiplayer-ground-after-walk.png) and [body overlap](multiplayer-overlap.png). [The old welcome payload](multiplayer-welcome-before.json) omits claims; the corrected values are in the final report.

Visitors can walk through one another and occupy the same XYZ. Eight admission claims are capacity reservations, not permanent standing spots. Crowded name labels overlap and are not occlusion-tested against tower geometry; the 2D map gives no floor-height distinction. Physical Firefox/Safari and long-session/hardware visual acceptance remain open. Initial concurrent browser runs timed out on startup/screenshots; the final complete run was sequential. An initial rebuilt export omitted the local Worker URL and did not connect; it was replaced by the correctly configured final build.

Fresh full contracts include 122 Worker assertions. Fresh build/lint/types, subsequent typecheck and export privacy pass after the renderer change. Run the existing `scripts/village/tests/tower-lookout-browser.cjs` with `MULTIPLAYER_ONLY=1 USE_SERVED=1`, `EXPORT_DIR` and an isolated `LOCAL_WORKER_URL` to repeat this review; use `TRANSITION_ONLY=1` for the focused observed-entry regression and `SMOKE_ONLY=1 LOW_RESOURCE=1` for the light preview check. Build previews with `NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_SHARED_WORLD_URL=ws://127.0.0.1:2567 npm run build`.

The active frontend snapshot is `/tmp/cosy-lookout-multiplayer-path.txt` (also `/tmp/cosy-town-final-preview-path.txt`); Worker2567 retains its earlier source/state with only the welcome correction applied. QA Worker2593 is stopped after verification. No production deployment or Git writes.
