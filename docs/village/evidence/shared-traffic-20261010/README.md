# Shared presence traffic — 2026-10-10 local

Unchanged presence renews every five seconds (previously 120 ms), approximately 98% fewer idle heartbeats. Ownership/activity/visibility changes bypass the delay. The local 120 ms pose poll still detects walking and state changes; it does not send unchanged presence on every poll. One Worker-owned 100 ms timeout chain advances shared motion while any visitor sees the outdoor world, including menus. Hidden/private/empty worlds cancel it and retain WebSocket hibernation. Movement and horse control rates are unchanged.

Ordinary actor movement checkpoints every five seconds. Accepted actions/resources, race transitions, dismounts and departures save immediately. Race comparison uses the last successfully saved state so earlier input-driven advancement cannot skip a transition. Ordinary motion can restore a position roughly five seconds earlier on restart; accepted resource grants still use their existing atomic persistence. The timer consumes active duration while the world is visible rather than charging each visitor for incoming clock-driving messages. No dependencies, deployment configuration, layouts, public UI or production state changed.

## Verification

- Full `npm run check` passed with the initial clock implementation. The final race-baseline guard subsequently passed the Worker typecheck, 132 Worker contracts and focused chat/hour/admin/kick contracts; unchanged client/build evidence is reused.
- Local-endpoint production build and `npm run check:export` passed. No editor, save API or admin route is exported.
- Client contracts cover visible/hidden five-second renewals, immediate state/visibility changes, reconnect and listener cleanup. Worker contracts cover one timer, 100 snapshots with two periodic checkpoints over ten seconds, immediate accepted action/race saves, private/hidden suspension and stale visitor cleanup.
- [Actual three-client idle traffic](traffic.json): one heartbeat and 60 actor updates in 6.2 seconds, median gap 104.5 ms.
- [27 three-client horse checks](horses.json): movement/steering/braking, contention, observer attachment, late join, accepted dismount, disconnect/reconnect, forced release, full seats and concurrent private focus; three laptop windows and all six iPad CSS orientations. Zero page errors. `TRAFFIC_CHECK=1` deliberately verifies uncaptured Escape; it does not establish native pointer capture.
- [Five focused three-client pet/clock checks](petting.json): observation, sparse renewal, continuing world motion, observer pet animation without its owner's camera, and completion/release. Zero page errors. The initial full animal runner failed because its tutorial was still open, then because approach placement was unstable. Its setup now dismisses the tutorial and waits for grounded, stationary clear placement; focused petting passes. The full animal chain was not rerun after that fixture repair.
- An earlier horse run passed 17 movement/layout checks, then timed out acquiring pointer lock. The focused final run passes the shared behavior above without claiming that pointer-capture check.

## Preview and release limits

Port 3051 serves root `out`, built with `ws://127.0.0.1:2567`. Worker2567 uses separate synthetic persistence at `/tmp/cosy-shared-traffic-20261010-worker`. No Git writes or deployment. Production retains the previous heartbeat behavior. An authorized release must deploy the Worker and matching client; existing village tabs must reload. Native/physical devices, long background sessions, thermals and live billing/duration reduction are not established by these local checks.

## Authorized release progress

Fresh final `npm run check`, isolated production-endpoint build and export boundary checks pass. Worker `3ace9f87-18cb-4873-a3d6-fe557c33be01` is deployed and its health response is 200/`ok: true`. Pages publication and live-client acceptance are pending; the local evidence above remains local.
