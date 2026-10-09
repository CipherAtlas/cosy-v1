# Shared presence traffic — 2026-10-10

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

Port 3051 serves root `out`, built with `ws://127.0.0.1:2567`. Worker2567 uses separate synthetic persistence at `/tmp/cosy-shared-traffic-20261010-worker`. The Worker and matching client are now published; existing village tabs must reload. Native/physical devices, long background sessions, thermals and live billing/duration reduction are not established by these local checks.

## Published release

Application `f3acc61` is pushed and published through [successful Pages build and deploy](https://github.com/CipherAtlas/cosy-v1/actions/runs/37982796596). Worker version `3ace9f87-18cb-4873-a3d6-fe557c33be01` is deployed and its health response is 200/`ok: true`. Fresh final source checks, isolated production-endpoint build and export privacy pass. The emitted bundle contains the production Worker endpoint and no local Worker endpoint.

- [Thirteen live Chrome checks](live-checks.json) pass with no page errors or failed resource responses: shared entry, farm travel, private cottage/cat, observation suspension/resumption, activity exit and accepted farmer conversation.
- [Live idle traffic](live-traffic.json): two heartbeats and 62 actor snapshots in 6.2 seconds, 98 ms median gap, using the production WebSocket endpoint.
- [Live route boundaries](live-http.json): all six editor/admin/layout-save/tools/AGENTS paths return 404.
- [Separate accepted live ride](live-riding.json): accepted mounting, 600 ms held steering and dismount; 22 ms local visual response and 605 ms accepted response. The first 120 ms timing sample missed server movement. A later horse position blocked both visual/server timing observations; [that trace](live-riding-blocked.json) remains recorded. These probes are not deterministic short-input latency acceptance.
- The first NPC test selected clear ground across a blocked walking path. Requiring the matching movement solver's clear path fixed the test; the final Worker conversation request succeeded without application changes.

Local multi-client/contention/tablet evidence above is reused for unchanged source. The live smoke uses one real browser visitor. Native/physical devices, long-session thermals, continuous riding feel and live daily billing savings remain unverified.
