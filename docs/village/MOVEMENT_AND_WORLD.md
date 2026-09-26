# Movement, camera, and a living world

Updated: 2026-09-26. Production specification and remaining acceptance for `MOVE-01`, `WIND-01`, and movement-linked `AUDIO-02`. Read the [canonical handoff](../../VILLAGE_HANDOFF.md) and [sound specification](MUSIC_AND_SOUND.md).

## 2026-09-26 unlimited dashing

The user removed energy from the product. The controller no longer tracks stamina, exhaustion, draining, recovery or cooldowns; the energy meter and its English/Japanese labels/styles are removed. Holding dash keeps the existing 6 m/s speed continuously. Normal glide, quick glide, jumping and collision behavior are unchanged. Earlier energy requirements are superseded.

## 2026-09-26 neighbourhood roaming

`life.ts` now gives every resident a multi-point circuit across a wider area: cottage/entrance (Pip), bridge/pond approach/cottages (Maple), northern lane/riverside verge (Moss), and tea garden/centre/garden perimeter (Luma). Intermediate waypoints guide continuous movement, with two 4.5-second rests per circuit. Luma is no longer stationary. Existing proximity approach, personal space, conversation and return rules are preserved. The new loaded-world checks cover every route segment and four-minute circulation at 30/60/120 FPS; see [the local milestone](../../VILLAGE_BUILD.md#2026-09-26-roaming-and-clear-streets). The road-side hearth bench now sits north of the same shared hearth anchor; the original southern activity seat remains.

## 2026-09-26 mouse camera controls

Ground clicks and taps no longer move the spirit; the destination ring and automatic target movement are removed. Click the canvas once to capture a desktop mouse, then move it to look without holding a button. Escape releases the cursor and clears held movement. Menus, activities, window blur, hiding the page, WebGL interruption and disposal also release capture. Closing a menu or returning from an activity leaves the cursor free until another click. Pending capture requests are canceled logically so they cannot grab the cursor after a menu opens.

The browser requires a user gesture for capture; merely hovering the canvas cannot acquire pointer lock. A rejected or unavailable capture uses drag-to-look with an explanatory hint. Touch retains drag-to-look and directional buttons, with no tap-to-move. The English/Japanese Controls guide and canvas description reflect these controls. This section supersedes historical click-to-glide and mouse-drag descriptions below. Verify with `scripts/village/tests/camera.cjs` against the local QA harness; see the latest build-ledger entry for evidence.

## 2026-09-26 player update

The player is now a floating white spirit. The existing speeds, bridge/deck collision, water boundaries, jumping and direct travel are preserved. UI language describes gliding and dashing. Hover, directional lean, retained movement heading while idle, fin flutter and landing squash are runtime transforms; no humanoid clips are required. Residents now reuse the spirit form with pastel materials and original accessories. Their wider authored routes preserve proximity visits, collisions, personal space and conversation timing. Player footstep audio is suppressed; takeoff/landing events remain. This is ground-constrained hovering, not unrestricted vertical flight. Reduced motion disables decorative bob, roll, lean and fin flutter for player and residents. Desktop mouse capture and touch dragging control the camera; ground clicks/taps have no movement target.


## Activity staging and exit contract

`activityScene.ts` defines `ACTIVITY_STAGES` for all six places, pairing the spirit's position/heading with camera and look-target coordinates. `ActivityMoment` in `environment.ts` carries focus progress, music state, breathing phase, mood, writing and postbox events from `Activities.tsx` through `Village.tsx` to `VillageEngine.setActivityMoment`. Props react without replacing DOM controls or local persistence. Portrait cameras leave the actor above the bottom sheet; hiding controls keeps the activity mounted. Reduced motion freezes decorative animation.

An activity's authored pose is temporary: exiting restores the prior movement heading, clear arrival position, walking camera and canvas focus. Do not reintroduce camera-facing idle rotation. [Current staging/reduced-motion checks](evidence/living-living-checks.json) and [all six exit checks](evidence/living-activity-exits.json) pass; the [published-release smoke check](../../VILLAGE_BUILD.md#2026-09-26-main-release) also verifies the tea-garden exit and subsequent Luma conversation.

## Implemented contracts

`environment.ts` is the shared source of truth. `WorldContact` contains `kind` (footstep/takeoff/landing), position, surface, achieved speed, impact and foot. `MovementStatus` contains gait and run-toggle state; the shell receives changes at most 10 Hz. `EnvironmentFrame` carries listener position, camera-forward vector, gust strength, weather and shelter at about 12.5 Hz. The listener follows the traveler outdoors and the settled look target in an activity; simple view explicitly sets the destination's sound position.

`VillageMovement` runs at 120 Hz with at most 100 ms catch-up. The starting tuning values below are now implemented. It resolves a radius-0.32 m, height-1.8 m proxy against authored boxes, respects water/parapets, handles bridge height from the shared `BRIDGE` definition, low-prop tops and overhead boxes. This is a small authored-world controller, not general rigid-body physics. It emits foot contacts at gait phase 0/0.5 based on achieved travel. `VillageEngine` presents those controller states through spirit hover, lean and jump/landing squash; no humanoid animation mixer is used.

The archived, no-longer-loaded candidate `traveller.glb` is skinned with 21 bones and clips `Idle`, `Walk`, `Run`, `Sprint`, `JumpStart`, `AirLoop`, `LandSoft`, `LandMoving`. Original editable source and export script are linked in the handoff. In-place strides are 1.65/2.8/3.5 m for walk/run/sprint. These humanoid clips and anatomy are historical, superseded by the current spirit direction.

Shared gusts now affect grass, bushes, tree canopies, willow leaves, water normals and wind gain. Foliage shadow shaders share the deformation; shadow refresh is bounded. Reduced motion disables secondary wind motion. No physical cloth solver, full acoustic occlusion, device acceptance or finished-art claim.

Keyboard: WASD/arrows, R toggle run, Shift hold sprint, Space jump, E interact with a place, F chat with a nearby visible villager. Touch has explicit run/sprint/jump alongside the direction pad and a Chat button on speech bubbles. Input clears on blur, canceled/lost pointers, dialogs and travel. See the evidence ledger for contract tests and recordings; the acceptance list at the bottom remains open.

The subsequent activity-exit fix gives all six activities a visible **Back to village** button on desktop and mobile. Button, wordmark and Escape share the exit path, restore the walking camera and return keyboard focus. Pond and writing-nook arrivals moved to clear ground at `(−19, −7)` and `(−19.5, 8)`. The existing [activity-exit evidence](evidence/activity-exits.json) records four-direction movement after every exit, input clearing, grounded state and restored camera distance; browser/device limits are recorded in the [build ledger](../../VILLAGE_BUILD.md#2026-09-25-activity-exit-fix).

## Camera, bridge and ambient life: feedback fixes

- `VillageEngine.ts`: drag pitch spans −0.85 to 1.35 radians; wheel distance spans 2.2–12 m. The spherical orbit lifts its target when looking up and clamps the camera above the shared terrain floor. Upward and overhead captures verify the expanded range; exhaustive roof/wall occlusion and physical-touch comfort remain open.
- `environment.ts` / `bridge.ts`: `BRIDGE` defines a 12 m crossing with 3.3 m clear width at `z = 3`. The deck height is `0.08 + sin(πt)² × 1.1`, where `t` runs from 0 to 1 across the span. Solid masonry sits beneath upward-facing paving; continuous parapets and end posts have matching collision boxes. Approaches connect both banks, with no flat path beneath the water crossing and no planting through the deck.
- `environment.ts` / `world.ts` / `places.ts`: `HEARTH` is at `(−5.8, −19)`, radius 1 m, inside a 3.6 m paved clearing beside the road. Three backed benches face the fire. Keep visuals, colliders, surface classification, sound and activity camera tied to this anchor.
- `life.ts`: four pastel spirit residents share the movement controller. All four follow wider authored circuits, including the bridge and tea-garden perimeter. They pause 4.5 seconds twice per circuit and stop when the player is within 1.2 m. Twelve instanced birds circle with wing animation; reduced motion freezes the bird orbit/flap. The later dialogue pass adds Pip, Maple, Moss and Luma: overhead DOM bubbles, approach greetings, click/F conversation, English/Japanese lines and weather remarks. Residents now notice players within 6 m, check a direct walkable path, approach one at a time, stop about 2.2–2.5 m away and return along their approach path after a short visit. Speaking residents pause and face the player. Invitations are disabled during arrival, menus and activities, and rearm after the player leaves beyond 9 m plus a cooldown. `dialogue.ts` handles projection, collider occlusion, overlap suppression and explicit-chat announcements; activities/menus hide the overlay. Quests and general navigation AI remain outside scope.
- `landscapeHeight` is shared by terrain, planting and floor queries. Distant scenery gives depth without implying a larger set of activities or unrestricted exploration.

Ten controller/composition checks and three dedicated bridge checks pass. The bridge checks raycast 147 deck positions, check the arched underside and water clearance, and test both crossing directions and parapets. The final [16.78-second recording](evidence/motion.webm) includes 43 footsteps, two takeoffs, two landings and both bank-to-bank crossings. The [scene audit](evidence/scene-audit.json) found four residents, twelve birds, clear bridge planting and clear access past the hearth. Reproduce checks from the [build ledger](../../VILLAGE_BUILD.md#reproduce-the-checks); these tests do not close motion, listening or device acceptance.

## Historical prototype audit (before this milestone)


[VillageEngine.ts](../../features/village/VillageEngine.ts) implements camera-relative WASD/arrows, straight-line tap-to-walk, drag look, wheel distance, proximity interaction and simple collision checks. Normal speed is 2.6 world units/second; Shift increases it to 4.5. **Both use the same `Walking_A` animation.** There is no distinct run/sprint, stamina, jump velocity, grounded/airborne state or landing animation. Space is prevented from scrolling but does not jump.

Current movement grounds the player to terrain with special bridge handling and blocks motion using simplified building/water bounds. It is not a general character controller. Adding a vertical animation offset alone would not implement jumping, collisions or believable landings.

Current vegetation has basic grass sway. There is no coherent wind system shared by trees, cloth, water and sound.

## Desired movement feel

The user requested **Genshin Impact–inspired movement**, plus jumping, and subsequently removed energy. Preserve fluid acceleration, directional turns and clean takeoff/landing with unlimited dashing. Use original assets and an implementation appropriate to this small calm village. Do not add combat movement, health, climbing, swimming, gliding or progression as assumed scope.

Movement should be comfortable enough to explore for pleasure and predictable enough that opening a focus session is effortless. Arkenfall remains a heavy reference for traversal, framing and the sensation of being inside the environment. Verify actual reference behavior before attributing a specific detail to it.

## Character and animation contract

Refine or replace the current candidate skinned traveler with finished character art suited to the [art direction](ART_AND_ASSETS.md), preserving the implemented rig/clip contract. Inspect exported clip names and skeletons rather than assuming a generator's labels are correct.

Implemented clip names and required quality:

| Clip | Required behavior |
| --- | --- |
| `Idle` | Subtle breathing/weight shift, stable feet, no distracting loop tic. |
| `Walk` | Grounded relaxed gait, foot contacts aligned to actual travel speed. |
| `Run` | Distinct stride, arm motion and torso response; not accelerated walking. |
| `Sprint` | Readable extra effort and longer stride during sustained dashing. |
| `JumpStart` | Anticipation/takeoff matched to controller impulse, without sluggish input. |
| `AirLoop` | Plausible airborne pose, no continued walking feet; handle rising/falling state. |
| `LandSoft` | Weight absorption when landing with little horizontal movement. |
| `LandMoving` | A landing that returns smoothly into traversal without forced full stop. |

Start/stop and turn animations improve quality; include them when the rig and controller can use them coherently. Sitting clips are useful for future authored settled poses but are not a substitute for the required locomotion set.

Use consistent skeleton/rest pose, scale and foot origin across clips. Prefer in-place locomotion driven by controller velocity for the initial browser integration; document any root-motion exception. Provide left/right foot-contact times and transition previews. Match stride speed to displacement, blend by actual velocity, and avoid sliding feet when blocked by a wall. Add modest coat/scarf secondary motion without introducing unstable expensive full cloth simulation by default.

Blend times around 0.12–0.25 seconds are an initial tuning range, not a global setting for every transition. Jump/landing events need appropriate timing rather than a generic crossfade that smears contact.

## Controls and initial tuning

Preserve WASD/arrows, drag look, tap travel, `E` interaction, direct travel, Space jump and explicit touch jump/sprint controls. Preserve accessible names, visible focus, adequate targets and pointer cancellation. Inputs must not leak through dialogs or text fields. Clear held movement on blur, pointer cancellation and mode changes.

Recommended initial behavior: default walking remains available, a run preference/toggle supports comfortable traversal, and Shift/hold-sprint requests sprint while moving. Touch offers corresponding controls. This mapping is now implemented; physical-touch usability still needs testing.

The starting values below are now implemented. They are project tuning values, not exact Genshin values:

| Parameter | Starting value / intent |
| --- | --- |
| Walk / run / sprint | 2.6 / 4.5 / 6.0 metres per second; tune to the final stride and village scale. |
| Jump velocity / gravity | 5 m/s upward, 12 m/s² downward; approximately 1 m jump height before collision constraints. |
| Jump input buffer / coyote time | About 120 / 100 ms for forgiving edge/input timing. |

Keep animation playback and physics frame-rate independent. Dashing has no duration limit or cooldown; releasing dash restores the selected glide speed.


## Controller and camera requirements

- Track position, horizontal velocity, vertical velocity, grounded state, locomotion state explicitly. A stable fixed simulation step with bounded catch-up is a suitable starting design; rendering may interpolate.
- Replace hard ground snapping with tested ground detection and collision resolution. Check slopes, steps, bridge deck/edges, walls, ceilings and landing surfaces. Preserve water boundaries unless crossing behavior is intentionally designed.
- Use a simple capsule or equivalent character proxy and authored collider data. A physics dependency is not assumed or preapproved; choose the smallest approach that passes the required cases.
- Drive animation from achieved motion, not raw key intent. Clear tap goals when manual movement takes over and stop gracefully when a goal is unreachable. Do not silently promise obstacle navigation from straight-line tap movement.
- Filter character turning and camera follow without making input sluggish. Let the camera handle jump height smoothly while maintaining a useful look direction; avoid forced head bob and unnecessary shake.
- Keep the camera out of walls, roofs, bridge masonry and dense foreground geometry. Recover from occlusion smoothly. Test portrait views and the cottage transition, not just the entrance.
- Activity entry and direct travel must reset/settle vertical velocity, input and camera appropriately. Dialogs pause movement; the focus timer continues using wall-clock time.

## Shared world contracts — implementation

Keep simulation in the engine and UI state in the shell. Avoid frame-rate React rerenders and tight coupling between the audio engine and animation implementation. These boundaries are implemented through the types in `environment.ts`; coordinate changes before separate agents edit shared files:

| Producer → consumer | Data / cadence |
| --- | --- |
| Controller → animation | Achieved velocity, grounded/vertical state, gait, turning and jump/landing transitions; every simulation step. |
| Animation/controller → audio | Foot contact with surface, position, foot and speed; takeoff; landing with impact velocity and surface. Events once per actual contact, not once per render frame. |
| Engine → DOM HUD | Gait and current control mode; throttle values and emit state changes promptly. |
| World → controller/audio | Authored surface classification and colliders: stone, wood, soil, grass and relevant water edges. |
| Camera → audio | Listener position/orientation, sampled smoothly while exploring. Specify the settled camera/listener policy during activities. |
| Environment → shaders/audio | Shared wind direction, average strength, gust envelope, weather and indoor/outdoor exposure. |

Reuse [places.ts](../../features/village/places.ts) for existing shared types and IDs. Introduce only meaningful shared event types. The exact current types and cadence are documented at the top of this specification.

## Wind and environmental life

Build a coherent lightweight wind field: a prevailing direction plus slow gust envelopes and spatially offset variation. Pass the same environmental state to visual and sound systems.

- Grass bends from rooted bases; trees move by branch/leaf scale with stronger response high in the canopy. Avoid translating entire trunks or giving every instance identical phase.
- Scarf, coat hems and selected hanging signs/cloth respond with appropriate lag. Use rigged secondary bones or weighted shader deformation where practical; preserve body/cloth intersections.
- Water ripples, occasional drifting leaves and chimney smoke respond consistently. Density stays restrained; a calm environment should not look like a particle benchmark.
- Rain and gusts alter motion/sound together. Interiors reduce exposure; vegetation can remain visible and moving outside a window.
- Reduced-motion settings reduce nonessential motion while preserving essential traversal and clear state feedback.
- Reconcile moving casters with cached shadows. Profile vertex cost, overdraw and shadow updates; wind must not erase the performance gains of batching/instancing.

## Acceptance

Deliver short recordings and measured observations, not just source tests:

1. Walk → run → sprint → stop; standing and moving jumps; repeated jump attempts; turns and direction reversals. Inspect foot plants, head/torso motion, cloth, blends and landings.
2. Hold dash continuously for at least a minute without slowdown at 30/60/120 FPS. Releasing dash restores the selected glide speed; blocking obstacles and opening dialogs still stop movement.
3. Bridge approaches/edges, slopes, building corners, cottage entry, low overhead geometry, water boundaries and landing beside props. No tunneling, hovering, falling through terrain or ground-snap jitter.
4. Repeat at 30/60/120 fps or controlled equivalent frame pacing and after a long background pause. Jump height and travel distance should remain consistent; no catch-up launch.
5. Keyboard, real touch input, portrait camera, focus loss, canceled pointers, simultaneous controls, text entry and reduced motion. Keep direct travel and simple view functional.
6. Wind visible in near/far planting, cloth and water without synchronized motion, ungrounded trees or frozen contradictory shadows. Record golden/dusk/rain behavior and cost.
7. Audible footsteps align with visible contact; jumping/landing and surface changes sound correct. Include the sound team's verification rather than assuming emitted events are sufficient.

Only mark `MOVE-01`/`WIND-01` complete after these checks and integration with the finished character/environment. A speed multiplier, bouncing mesh or grass-only sine wave does not meet the request.
