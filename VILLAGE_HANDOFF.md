# Cosy Village — canonical handoff

## 2026-09-30 — local chat timestamps (local)

New shared-chat entries store the Worker's send time and show a small timestamp beside each message in the viewing computer's local time and hour format. Older current-hour entries without a recorded send time stay visible without a timestamp. A focused Worker/client test confirms persistence and delivery; typecheck and the static export passed. A local browser preview with a mock WebSocket room showed the local time beside the new message and no time beside an older entry. Live deployment remains unverified. See [the build entry](VILLAGE_BUILD.md#2026-09-30-local-chat-timestamps-local). No deployment occurred.

## 2026-09-30 — shared chat participant list (local)

The chat shows up to three visitor names directly. With four or more, **See everyone here (count)** opens a short, independently scrollable name list with the current visitor first. This keeps the fixed chat and composer usable as the room grows toward its 64-visitor cap. A local mock room with 64 visitors and 40 messages verified the collapsed layout and inspected the bounded list in the browser DOM. Live load, physical touch and screen reader behavior remain unverified. See [the build entry](VILLAGE_BUILD.md#2026-09-30-shared-chat-participant-list-local). No deployment occurred.

## 2026-09-30 — dialogue and animal action keycaps (local)

NPC conversation actions and nearby puppy actions now keep clear square shortcut keycaps inside bordered, touchable buttons on desktop and phone layouts. NPC keys are F/C/B/E; puppy keys are E/P/H, including when a puppy button has focus. Puppy buttons expose the shortcuts with `aria-keyshortcuts` without repeating the visual letter in their accessible names. The rule is in `AGENTS.md`. Typecheck, 40 local dialogue checks and desktop/touch CSS checks passed; physical devices, the full React puppy overlay and deployed behavior remain unverified. See [the build entry](VILLAGE_BUILD.md#2026-09-30-dialogue-and-animal-action-keycaps-local). No deployment occurred.

## 2026-09-29 — bench side selection (local)

Near a bench, visitors can click or tap the half they want, including the birdwatching bench and layout-authored benches. The bench-sized hit area follows its rotation and scale; tapping seats on release, while dragging continues camera look. E and the Sit button still choose an open side automatically, and shared seating remains available when both sides are occupied. The Controls guide names the gesture. TypeScript, local Chrome checks for both sides of all eight benches, touch, pointer lock and drag, the existing seating/camera regressions, and the root static export passed. The full React overlay, physical devices and live site were not tested. This has not been deployed. See [the build entry](VILLAGE_BUILD.md#2026-09-29-bench-side-selection-local).

## 2026-09-29 — fixed and resizable shared chat (local)

The chat now opens at a fixed 320 × 390 px size. Messages scroll inside it, and the lower-right corner resizes its width and height within the viewport. A local desktop drag and 390 × 844 viewport check passed; a live shared-world message stream, physical touch resizing and the deployed site remain unverified. See [the build entry](VILLAGE_BUILD.md#2026-09-29-fixed-and-resizable-shared-chat-local). No deployment occurred.

## 2026-09-29 — local chat admin (published)

`tools/village-admin/` has a loopback-only admin page for the current shared chat. Start it from the repository root with `python3 tools/village-admin/server.py`, then open `http://127.0.0.1:3052/`; the [operator guide](tools/village-admin/README.md) covers the private secret, controls, stopping and troubleshooting. Its Python proxy reads a private mode-0600 secret file or prompts in the terminal, sends authenticated requests to the Worker over HTTPS, and does not give the secret to the browser. The page offers Remove per message and Clear all messages for the current hour. The Worker assigns stable message IDs, persists removal and broadcasts `chat_sync` so updated clients remove entries and matching overhead bubbles. Clear all also sends the established `hour` reset event to clear older open clients. The Worker and matching client shipped in [`747a27c`](https://github.com/CipherAtlas/cosy-v1/commit/747a27c109b1186a8be222fabf955ae45137bbb2) through successful [Pages run 36612482359](https://github.com/CipherAtlas/cosy-v1/actions/runs/36612482359). The follow-up Worker version `4938111e-591c-4083-8fb2-52d34f3555cb` cleared the user's already-open production tab after a second Clear all. Individual removal in an older tab still needs a reload. See [the build entry](VILLAGE_BUILD.md#2026-09-29-local-chat-admin).

## 2026-09-29 — automatic shared chat reset (local)

The shared chat's hourly alarm now clears and broadcasts the new UTC hour even after the Worker hibernates and wakes with no new message. The Worker restores the saved chat hour for the alarm to compare; a room without a saved chat starts uninitialized so its first connection schedules the same hourly cycle. The client's open log clears on the hour event, and an unsent draft remains available. A focused local Worker/client simulation, syntax checks and typecheck passed; the live alarm and deployed site have not been checked. See [the build entry](VILLAGE_BUILD.md#2026-09-29-automatic-shared-chat-reset-local). No deployment occurred.

## 2026-09-29 — background world sound (local)

Rain, river, fire and wind now continue with recorded music after a tab is hidden or the browser is minimized, while Sound off, master mute and individual mixer levels still apply. The mixer no longer mutes ambience on visibility changes, and the three short recordings use Web Audio loops with crossfaded seams so background timer throttling cannot interrupt them. Hidden-page effects remain suppressed. A local Chrome check simulated hidden visibility and stalled timers and measured non-silent output through multiple seams; actual minimized windows, other browsers/devices and listening quality remain open. No deployment occurred. See [the build entry](VILLAGE_BUILD.md#2026-09-29-background-world-sound-local).

## 2026-09-29 — Luma mint interaction cue (local)

After a mint harvest, a red animated exclamation follows Luma's visible head and her **Share your harvest over tea** button stays open and highlighted until the last mint is given away. E beside Luma activates the same tea action as the button. Nearby NPC actions show boxed keys like Chat's F. Reduced motion keeps the exclamation still. This is local only; see [the build entry](VILLAGE_BUILD.md#2026-09-29-luma-mint-interaction-cue-local) for checks and limits.

## 2026-09-29 — journal note retention safeguards (local)

The user reports that all Past notes disappear after updates at the same address and browser. That full-loss cause remains unconfirmed: the repository does not clear the stable `peaceful-room-gratitude-entries` key. A separate confirmed loss path was fixed: `/gratitude` used to keep only the newest eight entries when saving to the same key as Writing nook. Both screens now use the shared storage module, which preserves the full list and refuses to overwrite unreadable data. Writing nook → Past notes has Download notes and Restore backup; restore merges valid JSON backups with existing entries. This remains browser-local and is not a live or cross-device guarantee. A local reload check, storage regression checks, typecheck and static build passed. [Build evidence](VILLAGE_BUILD.md#2026-09-29-journal-note-retention-safeguards-local). No release was made.

## 2026-09-29 — nearby unstuck recovery (local)

R now recovers a stuck spirit onto nearby collision-checked ground; G takes over the quick-glide toggle. Touch exploration has an Unstuck button. The pictured east bridge-end gap beside the lamppost now has a direct bank-side opening through the shortened north parapet, with the masonry and collision boundary aligned. The deck profile and central rails remain. A focused regression crosses the opening in both directions and still checks R recovery, both bridge approaches and the middle. This is local only; see [the build entry](VILLAGE_BUILD.md#2026-09-29-nearby-unstuck-recovery-local) for verification and remaining limits.

## 2026-09-29 — village puppies (local)

Four original Blender puppies now load from `puppies.glb`: Mochi the corgi at the entrance, Kiko the Shiba on the cottage lane, Biscuit the beagle west of the bridge, and Cloud the Samoyed on the northern path. Their saved layout objects drive position, facing, scale and short collision-aware patrols. Nearby E or the Pet button starts a spirit reach, puppy nuzzle/wag/hop, two happy yips and brief floating hearts. Nearby P or **Walk with** invites one puppy to follow just behind the spirit; H or **Send home** dismisses it, and inviting another switches companions. The follower uses collision-aware paths, waits during activities and catches up after long travel. Follow state is local to this visit and is not shared with remote visitors. The yips are four edited cuts from a CC0 recording, routed through the existing spatial Effects bus after explicit sound activation. Reduced motion removes wagging, hopping and hearts. The local studio exposes each breed with a rendered preview and supports transform save/reload and Apply; protected presets and named working copies were not rewritten.

The [build entry](VILLAGE_BUILD.md#2026-09-29-village-puppies-local) records the Blender source, sound provenance, local browser/editor checks and evidence. This work is local only. Headphone/speaker judgment, physical touch, sustained frame time and live deployment remain open.

## 2026-09-29 — shared chat input prompt (local)

The empty chat input now says “Press "Enter" to type!” Enter already opens and focuses chat from exploration. This copy change has only local verification. See [the build entry](VILLAGE_BUILD.md#2026-09-29-shared-chat-input-prompt-local).

## 2026-09-29 — Safari scenery stalls and Detailed budget (local)

The visitor's published Safari 26.6.2 build froze for 4–5 seconds on scenery changes at 1920×960 Detailed. Its 27 FPS report compared with 60 FPS after the battery preference had automatically reached Minimal at 1018×509 with shadows off; this changes pixel load by about 3.56×, plus geometry and shadow work. A local WebKit 26.5 direct night switch reproduced a roughly 6.6-second render-submission stall as lighting shader programs changed. The local fix shows a full-screen preparation view, compiles the target lighting asynchronously before revealing it, limits runtime point lights to the two nearest fixtures plus the local spirit, and lets Detailed lower only its drawing-buffer scale after sustained low FPS while retaining geometry and shadows. The editor night preview still shows all fixture lights. Focused local WebKit/exported-app checks and before/after night captures are in [the build ledger](VILLAGE_BUILD.md#2026-09-29-safari-scenery-stalls-and-detailed-budget-local). This has not been deployed or tested in Safari 26.6.2; the exact cause of unrelated long-session pauses remains open.

## 2026-09-29 — activity spirit seating (local)

The Worker gives each visitor a persistent increasing slot number, which had been pushing the spirit progressively farther from every activity's fixed camera and the focus cottage chair. Activity staging now uses its authored position regardless of slot. Outdoor activity visitors may overlap; the focus cottage interior shows only the local spirit. Benches retain two side seats, with later visitors sharing an occupied side instead of being rejected. An 81-check production-scene regression covers all eight activities and high slot numbers. The local renderer passed the six-scene activity, solo-focus, camera-return and reduced-motion checks at slot 1000; a separate browser regression passed seating and overflow checks across all eight benches. Typecheck and the static export passed. React panels, the live Worker, deployed site and physical devices were not retested. No deployment occurred. See [the build entry](VILLAGE_BUILD.md#2026-09-29-activity-spirit-seating-local).

## 2026-09-29 — point-light shader investigation (local)

The live Firefox report near the bridge was 10 FPS in Golden hour on an M4 MacBook Air at 1920×965 Detailed graphics; intermittent 2 FPS was reported but did not reproduce in an isolated local run. The local runtime now skips point-light shading beyond each light's exact cutoff radius, preserving the lighting result. Native Firefox bridge captures retain the scene and show no WebGL error. A synchronized render probe showed a substantial night improvement; Golden-hour timings were variable and do not prove a win. The performance report now keeps low-FPS and longest-frame/render-submission evidence for the next episode. This is a local change only; sustained and live behavior remain open. See [the investigation ledger](VILLAGE_BUILD.md#2026-09-29-point-light-shader-performance-investigation-local).

## 2026-09-29 — completed garden countdowns (local)

The world and garden-panel growth clocks now hide at the deadline, including when a shared snapshot still says `growing`. Connected clients advance completed beds locally each second, and the Worker advances growth before validating a harvest, so a ripe crop can be picked once the Worker reaches the same deadline. Typecheck, Worker syntax, diff checks and a simulated early/completed harvest check passed. The focused world-clock browser regression was added but its QA preview controls did not initialize in the in-app browser; panel, live Worker and clock-skew behavior remain unverified. No deployment occurred. See [the build entry](VILLAGE_BUILD.md#2026-09-29-completed-garden-countdowns-local).

## 2026-09-29 — rapid shared-chat messages (local)

The shared chat client now disables Send and blocks Enter for 3.1 seconds after a send, matching the Worker's three-second per-visitor limit. The input remains editable and a follow-up sentence stays there until the visitor sends it after the cooldown. The prior automatic queue is removed. A focused cooldown test, typecheck, production-configured static export and local browser flow with a rate-limited localhost WebSocket server passed. The Worker and live site are unchanged; deployed delivery and tab-close recovery remain unverified. See [the build entry](VILLAGE_BUILD.md#2026-09-29-rapid-shared-chat-follow-up-local).

## 2026-09-29 — saved My village layout and editor controls (local)

The newest named **My village** working copy has been applied to `public/village/world-layout.json` with its 345 objects plus six newer garden/pond lanterns, for 351 playable objects. The saved copy and protected presets were not modified; Apply created a backup in `tools/village-editor/layouts/.history/`. The saved planting clearings now affect the local game. Three cottages and the spire use saved positions/facing in runtime geometry and collision; three trees moved and one tree was removed. Other legacy props, bridges, activity anchors, garden behavior and cameras still follow their code-authored positions.

The local studio has a Path-style Fence tool with editable points, length and height; saved fence lines follow terrain and block movement. Shelf placement stays active for multiple objects. Right-click offers Cut, Copy, Paste here, Duplicate, Focus, Remove, Undo and Redo while right-drag still pans. Typecheck, nine server tests, focused Chrome editor/landscape checks, the 41-check broad studio suite, root static export and a local browser entry into the playable scene passed. The fenced runtime was loaded through the studio's shared world builder, but has not been inspected from a visitor camera or profiled in a long session. No deployment or Git write occurred. See [the build entry](VILLAGE_BUILD.md#2026-09-29-saved-my-village-layout-and-studio-editing-local) and [studio guide](tools/village-editor/README.md).

## 2026-09-29 — planting eraser (local)

The studio's **Erase** brush clears meadow grass and decorative lane wildflowers under a chosen radius, even when a path is visually in front. It saves reversible clearing areas in the existing layout object format; the path and planted grass source objects remain intact. Saved clearing rings are hidden in the ordinary editor view and shown only when that clearing is selected in Scene; the active Erase cursor still shows its radius. Undo restores a whole stroke, and a saved working copy or **Apply to local game** carries the clearing to the playable layout. The editor keeps the source instances for restoration after moving or undoing a clearing. Interactive garden flowers are unaffected. Typecheck, isolated server tests and a focused Chrome path/erase/undo/save check passed for the original eraser work. At that earlier checkpoint the user's playable layout had not changed; the saved My village layout above has since applied its 45 clearings locally. See [the build entry](VILLAGE_BUILD.md#2026-09-29-planting-eraser-local) and [studio guide](tools/village-editor/README.md).

## 2026-09-29 — local-time mood and low lanterns (local)

Time & weather now follows the visitor's local clock by default: blue hour at 05:00–06:59 and 18:00–19:59, bright scene at 07:00–17:59, and starlit night at 20:00–04:59. It refreshes on a minute timer and page focus/visibility. Any fixed choice persists as a manual override; older dusk/night/rain choices remain manual, while older saved golden defaults become automatic. This uses device time, not a weather service.

Three low stone lanterns edge the kitchen garden and three trace dry pond banks. They brighten at dusk and night and appear as six editable instances plus one reusable Furnishings asset in the local studio. The playable layout has 298 objects. Editor working-copy transforms save and reload, but Apply to local game continues to reject prop transform changes because the runtime still authors these fixtures in `world.ts`. Protected presets and named working copies remain untouched. Typecheck, root static export, diff checks, local auto/manual reloads, garden/pond night views and an isolated editor transform save/reload passed. Clock-boundary timing, other devices, sustained performance and live release remain open. See [the build ledger](VILLAGE_BUILD.md#2026-09-29-local-time-mood-and-gardenpond-lanterns-local).

## 2026-09-29 — playable map authoring and Sunrise meadow (local)

`public/village/world-layout.json` is the local playable layout source. Its 292 objects retain the preserved village composition and add an eastern walkable meadow, curved path, eleven trees, twelve grass patches, a seat and four new moonlit lampposts. The game reads saved paths, grass, trees, walkable ellipses, oak meadow benches and resident routes; these affect rendering, movement surfaces, collision/seating and resident navigation. The separate loopback studio opens a working copy of this map, offers drag-to-draw paths with point/width handles, a grass brush, resident waypoint/pause editing and reachability checks, and an explicit **Apply to local game** action with revision protection and a backup. Protected presets and the user's saved Current village copy were not rewritten.

Apply rejects edits to objects the game still authors in code: existing buildings, bridges, most furnishings/scenery, activity and garden anchors, cameras, and visual ground tiles/hills. Treat the editor as the authority for the supported world layers only. The next engine milestone is integrating those remaining runtime anchors and props without breaking activity exits, shared seating or garden state, then adding terrain authoring and a performance budget for larger regions. The [studio guide](tools/village-editor/README.md) names the exact supported controls; [local checks and images](VILLAGE_BUILD.md#2026-09-29-playable-layout-and-sunrise-meadow-local) distinguish this from the live site. No deployment was performed.

## 2026-09-29 — starlit night (local)

Time & weather now includes a saved Starlit night choice. The sky is near-black, with a low moon, dense stars and a colorful galaxy band. Village windows and lanterns glow; four new path lampposts illuminate the bridge, tea garden, bird clearing and pond approaches. The hearth brightens, and all spirit bodies emit warm gold while four pooled lights illuminate nearby ground. The editor has a night preview and a reusable, editable lamppost asset while protected presets remain unchanged. The first local browser view was too bright, so the lighting and sky were revised; final visual evidence is recorded in [the build ledger](VILLAGE_BUILD.md#2026-09-29-starlit-night-local). This work is local and not deployed.

## 2026-09-29 — spatial vegetation culling (local)

The public runtime now groups seeded and placed meadow grass in 18 m camera-cullable cells and distant forest trees in 48 m cells. The editor capture path and saved layouts retain the original assets. In the tested layout, three fixed 1280×720 Chrome views rendered pixel-identically with culling on and off, with 439,000–620,000 fewer main-pass triangles when enabled. Splitting adds potential draw calls versus the prior single batches; a short local M4 profile did not establish an FPS improvement. Device and moving-camera checks remain open. See [the build ledger](VILLAGE_BUILD.md#2026-09-29-spatial-vegetation-culling-local).

## 2026-09-29 — mouse sensitivity (local)

Settings now has a 25–200% mouse-sensitivity slider, with 100% matching the previous camera speed. It adjusts captured mouse look, fallback mouse dragging, and mouse dragging during activities; touch dragging is unchanged. The choice uses the existing browser-local village preferences and survives reload. Typecheck, root-path static export, diff checks, and a local exported-UI check of the slider and reload persistence passed. Actual relative mouse rotation, physical devices, and the live site were not verified for this change. See [the build ledger](VILLAGE_BUILD.md#2026-09-29-mouse-sensitivity).

## 2026-09-28 — current sound and mouse controls

The personal lo-fi radio is disabled at `PERSONAL_RADIO_ENABLED` in `features/village/Village.tsx`. The village uses its original four recorded soundtracks, scenery-based selection, Sound panel and six sound sliders. Radio UI, catalog, playback code and design notes remain for later; saved radio preferences are ignored while disabled. Desktop exploration captures the mouse on scene click and releases it with Escape, menu opening or activity entry. The focus cottage and individual crumb-pouch changes from the local checkpoint below are included in this release candidate. The Worker with per-visitor crumb enforcement has been deployed as version `4e3abdbe-18d7-4fbd-8818-0589a77b6b36` and its health endpoint returned HTTP 200. Typecheck, production static export, Worker syntax and dry run, and a focused Firefox camera test passed. The local browser showed the restored soundtrack controls and no radio dock. See [the current build entry](VILLAGE_BUILD.md#2026-09-28-original-sound-and-mouse-capture).

## 2026-09-28 — focus cottage and simpler exploration (local)

The local build names the village Hearthwillow in the arrival screen, navigation wordmark, chat and browser title.

The focus room now places a visible coffee cup beside the desk, renders the real village bridge and roaming residents through its timber-framed window, and has enclosed plaster-and-oak walls and warmer fireplace light. The outdoor view updates while the visitor focuses, with a small camera parallax and lower resolution on reduced graphics tiers. Idle focus sessions show 10/25/50-minute choices directly. The local layout editor includes placeable coffee-cup and bridge-window assets with previews; an isolated working-copy check covered placement, transforms, save and reload without changing presets. The Friends panel and bottom-left location copy are removed; the Places button and M shortcut remain. The walking hint shows WASD, hold Shift and E; the full guide remains in Settings. Companions are still invited through nearby resident dialogue. Bird and duck feeding now requires the visitor to ask Maple or Wren for crumbs in the world; the Worker tracks the pouch per connection instead of treating another visitor’s pouch as permission. Chat still clears on the shared UTC-hour boundary and now labels its next reset in the visitor’s local time. Typecheck, static build, Worker syntax, browser scene inspection and focused bird/bench checks passed. At this checkpoint, the Worker and client were still local and uncommitted.

The focus room follow-up freezes shadow-map updates and steadies the indoor fire light while focusing. Its bridge window now refreshes at up to 30 fps on Detailed/Battery graphics (20 fps on Minimal) using a smaller render target; the sun lights the outdoor window view but no longer shines through the cottage walls. The local browser check showed the room at 50–60 fps on an Apple M4 Chromium renderer after this change. Firefox still needs a post-change visual check on the user's setup.

The focus tabletop now uses a layered writing journal, an inkwell that grounds a slimmer quill, a glazed coffee cup with rising and fading steam wisps, and a clearer glass-and-sand hourglass. Steam stays separate from the room's static mesh batches and stops moving for reduced-motion visitors. The journal, inkwell, quill and hourglass share runtime geometry with placeable local-editor assets; a fresh isolated editor showed all previews and preserved journal rotation and scale after save/reload. Typecheck passed, and a local browser check of the final scene showed the revised desk and visible steam at the normal focus camera distance.

## 2026-09-28 — shared chat and seating follow-up

Published at [cosy.sabarg.com](https://cosy.sabarg.com/) in commit [`140bf4a`](https://github.com/CipherAtlas/cosy-v1/commit/140bf4ab36061344ab13f6afd6759cb11a0a6e7b) through successful [Pages run 36411414878](https://github.com/CipherAtlas/cosy-v1/actions/runs/36411414878). Village chat opens on entry, stays open until closed, scrolls to the newest message, and focuses its input with Enter. New messages show a small animated cue when chat is hidden. Accepted messages appear in short overhead bubbles for the sender, including the local spirit; Worker version `a7f037cf-d7fd-414a-9bbc-666bf3907bae` includes sender IDs in new chat entries while the client still accepts older name-only entries. All seven benches use two lateral seats, show a full-bench notice, resolve simultaneous seat conflicts by visitor slot, avoid a centered visitor from an older client, and retain clear stand-up points. The nearby “Wander into the garden” scene transition and simple view mode are removed; garden tending in the walkable world and direct Places access remain. A failed 3D scene offers Retry.

Typecheck, production-configured static export, Worker syntax and diff checks pass. The focused scene test covers every bench, two visitors, a full bench, simultaneous arrivals, centered older clients arriving before or after the local sitter, safe exits, and absence of the nearby garden transition. Firefox against an isolated local chat server confirms initial open state, newest-message scroll, Enter focus, hidden-chat cue, remote overhead speech and local overhead speech after sending. The public page returned HTTP 200 and served the new client bundle. In a live browser, the shared world connected, chat opened by default, and Enter reopened and focused chat after closing it. One brief disconnect recovered automatically; a repeat live session stayed connected for 15 seconds. No public chat message was sent. Two physical visitors, mobile touch, and longer seating sessions remain unverified. See [the build ledger](VILLAGE_BUILD.md#2026-09-28-shared-chat-and-seating-follow-up).

## 2026-09-28 — public shared village

Published at [cosy.sabarg.com](https://cosy.sabarg.com/) in commit [`a73c913`](https://github.com/CipherAtlas/cosy-v1/commit/a73c913c5d48d01ceade23eb3852881b949b2960) through successful [Pages run 36404159427](https://github.com/CipherAtlas/cosy-v1/actions/runs/36404159427). The local 3D multiplayer trial is now a public, single shared village. A Cloudflare Worker with one SQLite-backed Durable Object owns connected visitors, server-generated two-word cosy names and colors, shared garden state, feeding events and chat that clears hourly. The Worker uses hibernatable WebSockets and stores the garden across restarts. The GitHub Pages client joins automatically after entering the 3D village, renders other visitors as spirit models with name labels and reconnects after a dropped connection. The first release is capped at 64 simultaneous visitors; horizontal scaling, moderation and physical-device performance are future work. The editor stays local. Two live visitors saw each other in the 3D village, and a chat message sent from one reached the other. Earlier local-only notes below are historical. See [the build ledger](VILLAGE_BUILD.md#2026-09-28-public-shared-village).

## 2026-09-28 — bird clearing and benches

Wren/Maple dialogue now stays in overhead bubbles instead of duplicating at the bottom. Walking into the bird clearing offers Scatter sourdough crumbs directly; all seven benches offer Sit and E to stand, with scattering also available from the birdwatching seat. Bird feeding no longer requires Wren's optional pouch, and thrown crumbs arc from the spirit to the ground. The old visit prompt and Wren's extra visit link are removed, while Places and simple view retain the bird activity. Scene bench and bird checks, typecheck, static export and a Chrome app flow pass; long seating and physical touch remain open. This is local, uncommitted work. See [the current milestone](VILLAGE_BUILD.md#2026-09-28-bird-clearing-and-bench-interactions).

## 2026-09-27 — quieter walk-along dialogue

Villager lines now close after five seconds for automatic speech or six seconds for chat, leaving a compact name and Chat control for the nearest resident. Following companions no longer repeat ambient lines. The control retains the F shortcut and a 44 px touch target. Typecheck, static export and 33 loaded-scene Chrome dialogue checks pass; physical touch and extended walking were not retested. This is a local change, not committed or deployed. See [the milestone](VILLAGE_BUILD.md#2026-09-27-shorter-villager-dialogue).

## 2026-09-27 — studio grass, paths and map expansion

The local studio now offers wind-animated grass tufts/patches, editable straight and curved limestone paths, textured 20/40 m meadow ground tiles and a grassy hill. Path length/width/shape, tangent extension and continuing by ground clicks work on the existing path object. Ground tiles have directional edge-to-edge expansion. Paths and grass follow placed surfaces; grass clears under editable paths and solid props. New asset IDs retain the version-1 layout shape and existing preset compatibility.

`spatial.ts` provides editor support surfaces and oriented solid bounds for placement, transforms and swept camera movement. Solid overlaps are rejected by default; an explicit checkbox allows intentional layering. Locked solids still collide, hidden ones do not, and camera collision stays active. Ground, paths and vegetation can overlap. This is editor behavior only: public gameplay collision and activity routing are unchanged. Existing presets and user files were not rewritten. See the updated [studio guide](tools/village-editor/README.md).

Typecheck, six persistence tests and the focused eight-check `tests/landscape.cjs` browser smoke pass cover elevated ground/grass placement, edge-to-edge expansion, path edits/extension, collision rejection, intentional layering/undo, exact file saves/reloads and a thin rotated-wall camera sweep. No comprehensive application suite or production build was run for this follow-up. Existing concurrent village edits were preserved.

## 2026-09-27 — saved village copy applied locally

Applied the editor’s saved 262-object **Current village copy** (`layout-c087f09f-6662-415f-b80b-b70fe9fb5783.json`) to the playable world. The bird terrace/dish/bench, flower border, twelve landing spots and Wren now sit at the western bridge-path end around `(-37,4)`. The previous clearing has the copied tea paving, widened oak bench and eight shrubs; tree 5 moves to `(-36.5,-28.5)`. Existing preset files and the saved working copy remain intact. Runtime props retain editor captures/library support. Saves in the editor still require an explicit gameplay integration pass.

The flock follows a continuous 30-second pond circuit with an eastern climb and western descent. Wren’s roaming/return route, companion staging, activity arrival/exit, desktop/compact cameras, collision/floor surfaces and positional feeding/coo sounds follow the new clearing. Bird feet sit on the paving rather than at the saved pose’s below-paving height. Seeded background placements are retained, with plants cleared only under the added paving. Concurrent hearth and editor-control work is preserved.

Typecheck and focused Node checks cover the exact saved landing X/Z coordinates, flight endpoints, terrain/bench clearance, safe arrival, Wren’s return route with the clearing bench collider, and the feeding/thanks/takeoff cycle. The existing browser bird script is retargeted but was not run. No broad browser suite, production build, Git writes or deployment; visual testing is left to the user as requested.

## 2026-09-27 — studio navigation and area selection

The local editor now has faster cursor-directed zoom, WASD camera movement (Shift for 3× speed), Page Up/Down for height, and a default terrain floor 1.5 m below the camera. Move-tool shortcut is G so W remains navigation. Shift-drag adds visible, unlocked objects intersecting the rectangle; Cut/Copy/Paste buttons and Cmd/Ctrl+X/C/V preserve group transforms and paste at the view centre. Cuts/pastes use existing undo and draft recovery, and the studio clipboard is persisted before removing cut objects. Text inputs retain normal typing and clipboard behavior.

Typecheck, diff whitespace and a focused eight-check Chrome smoke pass cover navigation/speed, zoom, ground protection, text inputs, marquee selection, grouped copy/paste, cut/undo and JavaScript errors. No comprehensive suite or production build was run for this follow-up, as requested. The local server was restarted on port 3040; reload the editor to load these controls. No public runtime, presets or dependencies were changed; no Git write operations were performed.

## 2026-09-27 — birds, harvest basket and companion release

Published at [cosy.sabarg.com](https://cosy.sabarg.com/) in release commit [`d6f218f`](https://github.com/CipherAtlas/cosy-v1/commit/d6f218f205ca26605c226a862d7c2c55607afa7e), through successful [Pages run 36323478979](https://github.com/CipherAtlas/cosy-v1/actions/runs/36323478979). This includes the white doves/Wren, sunflower growing/harvest basket, and companion hand-holding described below. The layout studio, presets and new asset registrations are committed as local development tools; the public export has no editor route. Earlier local-only statements record implementation milestones and are superseded by this release.

Fresh root-path build, typecheck and release diff checks passed, plus 633 bird, 46 companion and 50 sunflower scene checks and 16 exported-app bird checks. Live Chrome passes all 16 bird checks, including Wren's crumb gift, an actual 34.33-second scatter-to-thanks cycle, hearts/speech, exits, reload, Wren invitation, Japanese simple view and phone bounds. All 15 live sunflower/basket checks pass. Root plus 19 assets return HTTP 200; the deployed dove and credits match local bytes. [Publication evidence](docs/village/evidence/bird-release-publication.json), [live clearing](docs/village/evidence/bird-release-live.png), and [release ledger](VILLAGE_BUILD.md#2026-09-27-birds-harvest-and-companion-release). Physical-device, long-session performance and subjective audio acceptance remain outside this verification.

## 2026-09-27 — companion hand-holding

Side-conversation request implemented locally: an invited blob walks beside the player and holds their existing soft hand. Two companions can take one hand each; additional companions follow in rows. Formation follows the player's facing and velocity, including while chatting. A collision/terrain probe checks the next metre: narrow passages release hands and use the player's recent trail in single file, then return beside the player after 0.8 seconds of clear space. Sharp reversals take a small arc around the player. Jumping, menus and activities release the pose, and the original fin transforms are restored every frame. Reduced motion keeps the hand-hold without adding decorative motion. This reuses the existing spirit asset and adds no placeable object or editor asset.

Implementation is confined to `features/village/companionWalk.ts`, companion movement in `life.ts`, and animation hooks in `VillageEngine.ts`; existing bird/garden/editor work is preserved. `scripts/village/tests/companions.cjs` runs against `preview_qa.py --port 3048` with an existing Playwright installation. It covers 30/60/120 FPS narrow traversal and reunion, actual Blender hand contact, walking dialogue, turns/body clearance, reduced motion, jump/dismissal, every activity, the actual pond dock, and five-resident bridge/cottage/return routes. Chrome and Firefox also retain the 20 resident-encounter checks. Evidence is under `docs/village/evidence/companion-walking/`.

Typecheck and an isolated production export pass (only the existing RoomScene image/Browserslist warnings). The exported app's Friends invitation, walking and dismissal were exercised in Chrome/Firefox, with phone control checks in Chrome. A separate app preview is at `http://127.0.0.1:3049/`; the main task's 3046 export was left untouched. No Git writes, dependency/config changes or deployment. Physical-device and sustained-performance acceptance are not established by these checks.

## 2026-09-27 — white doves and Wren's bird clearing

Implemented locally, **not committed or deployed**. An eighth place, Bird clearing, sits on Willow pond's dry northern bank at `(-24,-31)`. A narrow path follows the dry corridor between pond and river, with the existing bench kept clear. The clearing has a limestone terrace, flower border, low feeding dish and a bench with a safe arrival/exit.

Twelve original white Blender doves replace the former sky silhouettes. They take a continuous 30-second flying circuit, land in the clearing, peck at sourdough crumbs and celebrate with pink hearts, wing flutters and **“Coo coo~ (Thank you~)”** before taking off again. Crumbs scattered during flight wait for the same flock. A meal cannot be restarted by repeated input. Wren, a pink blob with a flower and crumb pouch, tends a short route here and feeds the birds automatically (giving a nearby visitor time to take a turn). F/Chat or B gives her sourdough crumbs. She joins the existing companion system and resumes her job after returning. The existing crumb-pouch save is reused; no data schema changes.

The Blender source, generator, runtime GLB and measured manifest are `assets/village/dove.blend`, `scripts/village/create_dove.py`, `public/village/models/dove.glb` and `docs/village/dove-manifest.json`. Twelve birds share four instanced mesh draws. The separate `birds.ts` owns flock timing/animation/speech; `life.ts` owns Wren; normal Places, accessible controls, Japanese, simple view, reduced motion and explicit exits are retained. Existing sunflower/basket work and the ongoing local editor are preserved. The garden constructor accepts its established sunlight direction as a default for the editor caller. The dove, Wren, terrace, dish, bench, flower border and approach path are available in the local editor library with previews and editable/saved transforms; the preserved default layout is unchanged.

Typecheck and production export pass. Chrome/Firefox scene checks cover timing, feeding, absence of the caretaker, reload data, reduced motion and five-resident staging; exported-app checks include a real flight/feed cycle, phone controls and switching a queued meal into Japanese simple view. See [the bird milestone](VILLAGE_BUILD.md#2026-09-27-bird-clearing) and `docs/village/evidence/bird-clearing/` for exact evidence and limits. Preview: `http://127.0.0.1:3046/` → Places → Bird clearing.

## 2026-09-27 — local layout studio

Implemented under `tools/village-editor/`. Run `npm run dev:editor`, then open `http://127.0.0.1:3040`. The standalone Python server uses the existing TypeScript/Three.js installation, binds only to loopback, and adds no public Next.js route. Its optional world capture callback preserves the public renderer's normal batching. This task made no dependency changes, Git writes or deployment.

The studio has rendered asset thumbnails, searchable scene/library, move/rotate/scale handles, precise transforms, multiple selection, snapping, locks/visibility, duplication, ground placement, editable curved paths, scenery extensions, undo/redo and camera/lighting previews with an explicit exit. Draft recovery, named local JSON files, imports/exports, atomic writes, previous versions and stale-save checks keep experiments recoverable. See [the guide](tools/village-editor/README.md).

At the user's explicit follow-up request, `presets/current-village.json` now includes the latest garden, bird clearing, five residents and twelve doves (252 objects). This supersedes the earlier bird milestone's unchanged-default note above. The earlier 231-object snapshot remains in `presets/original-village.json`; riverside and meadow starters are also available. Presets always open as working copies and are read-only through the server. They preserve transforms while referencing the current shared artwork.

Typecheck, full static export, six server tests, forty Chrome browser assertions and thirteen movement/bridge regression checks pass. Actual pointer/keyboard checks cover the transform handle, selection, placement, paths, saves/reload, downloaded JSON, malformed imports, presets and desktop/tablet/phone layouts. [Evidence and remaining boundaries](docs/village/evidence/layout-studio/README.md). Layouts remain visual designs: saved transforms do not yet retarget the playable game's collision, bridge walkability, activity anchors or resident routes. That integration is the next step if applying a design to the game is requested.

## 2026-09-27 — tea seating access and growing daisies

Tea entry now covers a second 4 m interaction area centered on the seating at `(14.7,-10)`, including the back of the bench and both sides of the pergola. The original arrival approach, click/E parity, prepared-tea priority and safe exit remain intact.

Daisies occupy the sixth reusable raised wooden bed at `(27.2,-1)`, matching the mint/vegetable soil, border and planting height. They start ready to pick, then follow plant → water → grow for 3 minutes → harvest, with a visible countdown and no wilting. Harvests enter the basket and can be given to Luma. English/Japanese and simple view use the shared garden controls. Five-bed saves retain their beds, inventory, timers, tea and crumb pouch; the new bed and daisy count default safely under the existing garden key. Decorative watering now targets the sunflower border.

Source/build and 202 module checks per browser pass in Chrome 154 and Firefox 142. Both exported-app runs complete the real three-minute cycle, reload, harvest and gift; Chrome also verifies 390×844 controls. Published at [cosy.sabarg.com](https://cosy.sabarg.com/) in application commit [`5507ec0`](https://github.com/CipherAtlas/cosy-v1/commit/5507ec0990ff43e5ee95e3831918e55f28583981) after successful [Pages run 36315999478](https://github.com/CipherAtlas/cosy-v1/actions/runs/36315999478). Live Chrome repeats tea approach/entry, daisy tending/reload/gift and phone controls without app errors; see [the current evidence](VILLAGE_BUILD.md#2026-09-27-tea-seating-and-daisy-growing).

## 2026-09-27 — nearby interaction and garden prop fix

The tea approach could display “Take a quiet moment” while E silently selected an unavailable mint-tea action. The keyboard now uses the same `nearbyGardenAction` availability check as the visible button and falls back to the nearby activity. This also fixes garden entry beside growing crops. The static basket is removed from the mint/daisy aisle; the watering can is hidden except during its existing watering animation.

Typecheck/root static export pass. All 15 targeted interaction checks and 89 garden/pond/companion regressions pass in Chrome 154 and Firefox 142. Exported-app testing confirms captured-pointer E entry, pointer release, button entry, mint watering/countdown and visible exits; Chrome also covers 390×844. [Evidence and release verification](VILLAGE_BUILD.md#2026-09-27-nearby-interaction-fix).

## 2026-09-27 — garden release published

All garden, pond, companion, growth/tea, countdown/sign and courtyard changes below are committed and published at [cosy.sabarg.com](https://cosy.sabarg.com/). Application commit [`e38e517`](https://github.com/CipherAtlas/cosy-v1/commit/e38e5173cb9eba63dae9e8bb18157f768f2d0d64) passed [Pages run 36312226275](https://github.com/CipherAtlas/cosy-v1/actions/runs/36312226275). The earlier local-only status notes are historical.

Fresh release typecheck/static export and staged whitespace checks passed. Live verification confirms all seven Places entries, mint watering/countdown, wooden labels and continuous paving, carrot harvest/Luma's compliment and heart, all four companions, Maple's crumbs, happy duck hearts, pond camera dragging and return to exploration. No browser warnings/errors were captured. All 13 root HTML assets and six sampled runtime assets return HTTP 200; the deployed garden GLB matches the manifest. [Release evidence and limits](VILLAGE_BUILD.md#2026-09-27-garden-release).

## 2026-09-27 — garden labels and visible countdowns

The latest request explicitly adds a small visual countdown: each growing crop has a sage circular ring with minutes/seconds beside its wooden bed label and in the activity panel. The ring advances once per second, resumes after reload and disappears when ready; ripe crops still wait indefinitely. All five crop beds and three flower beds have English/Japanese wooden signs, with crop labels following replanted choices. The front-left mint bed is labeled “Mint · Tea leaves”; the original Blender asset now has upright stems, serrated green blades and veins.

The mint and daisy beds align with the vegetable columns and 4.5 m row spacing. One continuous level limestone surface with shared footpath UVs replaces the overlapping inner path ribbons. The tea approach joins it without the leftover internal grass strip; meadow scattering clears paving, and flower soil sits above it. Separate ongoing world-layout capture hooks are preserved.

Verified locally: typecheck/full static export/diff checks, 19 focused assertions (including 224 clear aisle samples) and 89 garden/pond/companion regressions. Exported UI checks cover desktop/390×844 countdowns, real ticking, mint identification, and resumed time after reload, with no captured app warning/error logs. [Evidence and limits](VILLAGE_BUILD.md#2026-09-27-garden-labels-countdowns-and-ground). Preview remains `http://127.0.0.1:3030/`; no Git writes or deployment.

## 2026-09-27 — pond-end cottage and garden paths

Side-conversation layout request implemented in `world.ts`: removed the second pond cottage at `(-23,-31)`, preserving all other house variants; rerouted the tea approach around the cottage at `(10,-4)`; added a rounded limestone tea terrace, two lanterns, planted pots, a tea-to-vegetable connection, central garden aisle and mint/flower loop. The stone texture scale and moss shoulders match existing footpaths. Meadow scattering now clears the full new routes. No farming, NPC, camera or save logic was edited by this layout task.

Typecheck, an isolated full static build and diff checks passed. Eight layout assertions include 1,212 collision samples across the four routes and clear tea/garden exits. [Images and evidence](docs/village/evidence/README.md#tea-courtyard-and-garden-paths). The separate exported preview is at `http://127.0.0.1:3034/`; the main thread's `3030` output was left untouched. Local only; no Git writes or deployment.

## 2026-09-27 — timed growing and harvest gifts

The latest request supersedes instant growth: watering starts radishes at 2 minutes, mint at 3, and carrots at 5. Plants visibly grow, continue while away and stay ripe indefinitely. Mint now occupies a fifth reusable bed with the same plant → water → grow → pick cycle. Saved watering timestamps and prepared mint tea are additive fields under `cosy-village-garden-v1`; old beds and inventory remain readable.

Bring harvests to Luma through the tea panel, Friends or her conversation button. Each vegetable earns its own compliment and a held-harvest, flutter and heart animation. Mint earns a saved cup of special tea, with green tea/leaves and an explicit sip action. Luma hosts without changing companion selection. The player sits on the bench facing the garden; a four-second entry pan yields to manual dragging, and reduced motion skips the pan. Phone framing keeps both characters above the controls. Garden beds share the world's painted soil/oak and limestone footpath surfaces.

Verification complete locally: TypeScript, full static export, 43 focused growth/gift checks, 82 garden/companion checks and 39 duck/camera regressions pass. Exported UI checks include actual radish/mint waits, harvesting, compliments, saved tea after reload and drinking; desktop/390×844 composition, native tea dragging and Japanese simple-view mint planting/watering were inspected. [Evidence and boundaries](VILLAGE_BUILD.md#2026-09-27-gentle-growth-and-lumas-tea). Preview: `http://127.0.0.1:3030/`. No Git writes or deployment.

## 2026-09-27 — happy ducks, activity cameras and feedback spacing

After eating, the ducks and ducklings give a short wing flutter, bob and wiggle, with floating pink hearts and a soft duck call. Reduced motion keeps still hearts. Dragging the scene with a mouse or touch now orbits every settled activity, including the fireplace and pond; the player remains seated, release stops dragging, and a new visit restores the authored view. Notices and interaction/activity controls share vertical flow with a 12 px gap, fixing the reported overlap on desktop, phone and simple view.

All 39 focused controller/animation checks, TypeScript and static export pass. Native mouse dragging was inspected at the pond and hearth; exported UI spacing was checked at 1280×720 and 390×844, including simple view. [Evidence and limits](VILLAGE_BUILD.md#2026-09-27-happy-ducks-and-settled-cameras). Local only, not committed or deployed.

## 2026-09-27 — garden, pond and companions implemented locally

The kitchen garden is the seventh place, beside the tea courtyard. The initial addition used four reusable vegetable beds and instant **plant → water → pick** growth. The timed-growth milestone above supersedes that behavior; no wilting, limited supplies, deadlines or daily upkeep were added. Sunflowers, daisies, irises and mint complete the garden. The newer mint bed and Luma exchange above replace the original instant mint picking and brewing. Beds, vegetables, mint and Maple's reusable bread-crumb pouch use the independent `cosy-village-garden-v1` key; older notes/preferences remain intact.

Willow pond is now an ellipse at `(-27,-14)` with radii `(9,12)`, over twice its former water area. The cottage at `(-24,-5)` is removed. A walkable east dock, smooth planted bank, reeds/irises/lilies, four jumping fish, a swan, an adult duck and four ducklings replace it. Maple gives crumbs through his nearby bubble or Friends; feeding brings the ducks to the dock. Original editable Blender artwork and seven procedural interaction sounds are included.

**C** toggles a nearby resident's company; **Friends → Invite everyone** brings all four. Any subset can follow, cross the bridge using shared collision rules, join all seven activities and return to roaming when dismissed. Tea cups, garden watering cans and activity gestures animate with the player. Invitations last for this visit; they do not create persistent obligations. **E** handles nearby plants/mint/duck feeding; **B** asks nearby Maple for crumbs. All actions also have click/tap controls, with English/Japanese and simple view.

Local verification: 80 feature assertions, 12 sound assertions, 43 roaming/street assertions, 20 approach assertions, 28 dialogue assertions, and 13 movement/bridge contracts pass. Typecheck and static export pass. Exported-app flows were exercised at phone dimensions, including persistence, planting/watering/harvesting, mint tea, invitations and dismissal; Japanese simple view was checked. Renderer images, motion recording and a short 720p profile are indexed in [the evidence](docs/village/evidence/README.md#garden-pond-and-companions). Physical touch, other browser engines, subjective sound listening and sustained target-device performance remain unverified for this addition.

**Status:** local implementation complete; no commit, push or deployment performed. The published release below is the prior village. Current source contracts include seven places; historical six-place evidence remains historical. See [the build milestone](VILLAGE_BUILD.md#2026-09-27-garden-pond-and-companions) before changing these systems.

Published application: [`738e408`](https://github.com/CipherAtlas/cosy-v1/commit/738e4085de1c88a3fbe5f1d26ef48f0b5b68f57b) through successful [Pages run 36245251354](https://github.com/CipherAtlas/cosy-v1/actions/runs/36245251354). Includes wider resident circuits, three timber fingerposts, clear hearth seating, adjusted tea-garden seating, unlimited dashing without an energy bar, desktop mouse-look, and restyled dialogue. Local and live verification are recorded in [the release ledger](VILLAGE_BUILD.md#2026-09-26-village-controls-and-layout-release).

Hosting moved to [cosy.sabarg.com](https://cosy.sabarg.com/) with root-path export commit [`ec0da2d`](https://github.com/CipherAtlas/cosy-v1/commit/ec0da2d52eae51b0ddc5b6f1e7d822c2a3b2e1ec) and successful [Pages run 36257520921](https://github.com/CipherAtlas/cosy-v1/actions/runs/36257520921). Browser storage is origin-specific and does not transfer from the old `github.io` address. See [domain release evidence](VILLAGE_BUILD.md#2026-09-26-custom-domain-release).

Current movement: WASD/arrows glide, G toggles quick glide, Shift dashes continuously, Space jumps, and R moves a stuck spirit to nearby safe ground. Click the desktop canvas to capture the mouse; Escape, menus, activities, blur and disposal release it. Touch retains dragging and direction buttons plus Unstuck. Ground clicks/taps do not move the player. No stamina, exhaustion, energy recovery or energy UI remains. Preserve the [movement/input contracts](docs/village/MOVEMENT_AND_WORLD.md).

Current village: all four residents roam wider multi-point circuits, including Luma leaving the tea garden. Three bilingual timber fingerposts replace the older nine-sign layout. The hearth's road-facing east side is open; full sign/bench footprints are verified outside the streets. Dialogue retains both languages and the existing personalities with dark green panels, cream serif text and visible keyboard hints.

The prior performance release caps drawing-buffer pixels at 1080p/720p/540p by tier, preserves automatic downgrades and adds an opt-in performance report. Read [the investigation](VILLAGE_BUILD.md#2026-09-26-performance-investigation) before renderer changes. The friend's Windows GPU path, native-current Safari/Firefox performance and physical-device acceptance remain unverified.

## Current art direction — 2026-09-26

The user has superseded the earlier realistic traveler brief: use **Arkenfall atmosphere plus a strongly Genshin-inspired, colorful stylized palette**, with **a cute floating white spirit and a cartoon smile** as the player. Keep all artwork original. The approved village image still guides composition, scale and environmental craft, but its muted palette and human player are no longer requirements. Preserve the named villagers and their conversations.

The latest user update extends the fantasy direction to houses, distant scenery and all four residents. The cottages now have swept colorful roofs, arched glazing, turrets, shutters and flower boxes. Original painted surfaces replace the photographic house/path materials. Rounded opaque tree crowns and vertex-painted mountain layers replace distant birch cards and repeated stone texture; two suspended gardens add fantasy landmarks. Pip, Maple, Moss and Luma reuse the spirit mesh with pastel colors, distinct accessories and hovering animation. The human traveler and birch remain archived assets and are no longer loaded by the village. Preserve the controller, original six activities plus the garden, weather, resident encounters and Controls guide. Current evidence is in the newest build/QA milestone.

The earlier polish removed the player’s automatic idle turn toward the camera and softened shadows. Its nine-sign layout is superseded by the current three timber fingerposts. The 2026-09-26 release used four complete licensed recordings selected by location/scenery; stream, fire and rain are recordings too. The prior art state was committed/pushed first at `7642527`; the following polish is bundled with the water/activity release. Read [the current milestone](VILLAGE_BUILD.md#2026-09-26-orientation-shadows-wayfinding-and-recorded-soundtrack) and [recorded audio specification](docs/village/MUSIC_AND_SOUND.md) before changing these systems.

The optional personal lo-fi radio is disabled for now at `PERSONAL_RADIO_ENABLED` in `Village.tsx`. Its Audius station catalog, player, mixer, browser-only preferences and playback code remain in source; [the radio design notes](docs/village/MUSIC_AND_SOUND.md) remain for later. The active experience uses the four local recordings, scenery-based soundtrack selector and original Sound panel with six volume controls. Radio preferences saved by local experiments are ignored while disabled.

The latest water/activity pass includes: flowing water shading; layered fire, embers, smoke and charred logs; visible spirit staging with animated hourglass, breathing rings, tea, quill and letters; warm activity panels, a phone bottom sheet and an Enjoy the view toggle. Keep the `ActivityMoment` bridge and camera/actor staging together when changing an activity. Read [the latest evidence](VILLAGE_BUILD.md#2026-09-26-water-fire-and-inhabited-activities) and [stage captures](docs/village/evidence/README.md#water-fire-and-inhabited-activities) before refining this pass. Both this pass and the preceding orientation/shadow/audio polish are included in the published application above.

## Start here in every new task

1. Read applicable `AGENTS.md` instructions and inspect the current Git status. Preserve any uncommitted work; do not reset it or assume it is disposable.
2. Read this document, then [the implementation evidence](VILLAGE_BUILD.md) and [design QA](design-qa.md).
3. Open the [approved image](docs/village/references/approved-village.png) and [current entrance](docs/village/evidence/roaming-entrance.png), then inspect the [cottage](docs/village/evidence/fantasy-cottage-exterior.png), [residents](docs/village/evidence/fantasy-spirit-villagers.png), [bridge](docs/village/evidence/fantasy-bridge-side.png) and [movement recording](docs/village/evidence/fantasy-motion.webm). Use the [evidence index](docs/village/evidence/README.md) for provenance. The unprefixed, `art-` and `fantasy-` captures are earlier milestones; `references/prototype-*` captures are historical.
4. Read the relevant specification: [art, lighting, and assets](docs/village/ART_AND_ASSETS.md), [movement and living world](docs/village/MOVEMENT_AND_WORLD.md), or [music and sound](docs/village/MUSIC_AND_SOUND.md).
5. Verify the relevant source before changing it. Historical test results are not evidence that a new change works. Update the status and evidence after each verified milestone.

## The agreed product

Cosy becomes a small, genuinely walkable, third-person village. Each place is a peaceful environment for one of the original Cosy activities. Arriving, wandering, hearing the village, and settling into a place should feel like entering a carefully made RPG world.

The target is **as close to AAA craft as practical in a small browser world**: convincing character movement, cohesive authored assets, rich material response, beautiful light, restrained environmental motion, and excellent sound. This is a quality ambition, not a claim that the current prototype meets it or a reason to ignore download size and frame time. A smaller, finished village is preferable to expanding unfinished scenery.

### Sources of truth

| Reference | Authority and use |
| --- | --- |
| Latest user requirements | Stress-free vegetable gardening, flowers/sunflowers/mint and mint tea; expanded planted pond, jumping fish, swan/ducklings and Maple's crumbs; any/all resident companions joining activities.  Natural flowing water and lively fireplaces; visible, animated activities that belong in the world; warmer, clearer UI; recorded music matched to scenery and location; player retains heading when idle; smooth shadows; three restrained roadside fingerposts; clear roads and hearth seating; wider NPC roaming; jumping; unlimited gliding/dashing without energy; desktop mouse-look; wind and world sound; richer art/light; useful vertical camera range, clouds and distant scenery, residents/birds, working Firefox sound, sensible hearth seating and a traversable bridge; MMO-style overhead dialogue, distinct cute personalities and nearby villagers approaching to greet the player. |
| [Approved village image](docs/village/references/approved-village.png) | Composition and craft reference: detailed cottages, stream/bridge, planting, mountains and restrained UI. The latest colorful stylized palette and white spirit replace its palette/player brief. |
| Original Cosy v1, preserved in [baseline captures](docs/village/references/README.md) | **Only functional baseline.** The [live Pages URL](https://cosy.sabarg.com/) tracks the village on `main`. Ignore earlier local redesign experiments as product/design references. The original six activities remain, with the kitchen garden added on 2026-09-27. |
| [Arkenfall](https://www.arkenfall.site/) | **Heavy experiential reference**, throughout development: sense of place, RPG traversal and camera feel, environmental atmosphere, wind, world sound, and immersion. Study the live experience; do not reduce this reference to a title-screen palette. |
| Genshin Impact | User-requested inspiration for the vivid stylized color palette and movement feel. Keep original characters and assets; do not import combat, proprietary UI or progression systems. |

The approved image controls visual direction when other references differ. Arkenfall guides the feeling of inhabiting the world. Neither reference grants permission to extract proprietary models, music, textures, or code.

**Excluded:** PDF, manga, books, and book/search experiences. Do not bring them into village navigation or spend this roadmap on them. Existing unrelated routes are outside this work. Combat, enemies, loot, quests, multiplayer, and progression systems are not required to achieve the requested RPG feel.

## Places and presentation

Keep the stable place IDs in [places.ts](features/village/places.ts). Improve the environmental identity of each place; activities must also remain available through direct travel and the accessible simple view.

**Keep roads clear.** Never place furniture, props, decorative objects or signage on roads, walking paths or bridge approaches. Place them beside routes in verges, courtyards or dedicated clearings. Their full geometry, overhangs and collision bounds must stay outside the travel surface; a roadside origin or signpost base alone is not sufficient. This applies to hearth seating and every future layout change. Follow the [placement and clearance rules](docs/village/ART_AND_ASSETS.md#placement-and-road-clearance).

| ID / place | Existing activity to preserve | Environmental direction |
| --- | --- | --- |
| `focus` / Focus cottage | Focus/break timer, intention, pause/resume, persistence | Detailed timber interior, window light, desk, textiles, quiet fire; comfortable still camera while working. |
| `music` / Village hearth | Music presets and mixer | Open riverside fire clearing beside the road, with three benches facing inward. Preserve clear circulation and the shared hearth anchor; music remains usable everywhere. |
| `breathe` / Willow pond | Manual breathing exercises and phase timing | Willow canopy, soft water, reeds and wind; stable breathing composition with minimal visual distraction. |
| `mood` / Tea garden | Mood check-in and suggested next activity | Intimate planted courtyard, tea setting, dappled light; gentle transitions to suggested places. |
| `gratitude` / Writing nook | Local notes, history, confirmed deletion | Riverside writing spot, paper and wood detail, distant water; readable notes with a calm stationary background. |
| `compliment` / Little postbox | Another kind note and Keep | Handcrafted postbox, small garden, soft paper/latch feedback; warm, understated delivery. |
| `garden` / Kitchen garden | Plant, water, pick; flowers and mint | Four vegetable beds and a mint bed beside tea; 2–5 minute growth after watering, endless seeds/water and no decay. |

The entrance, cottage, stream/bridge, and hearth should form one convincing first scene. Distant landmarks provide orientation and depth; they do not require a large explorable map.

## Earlier interaction and environment milestones

These records describe the 2026-09-25 feedback fixes and subsequent resident work. The current art, soundtrack and performance evidence above supersedes their traveler, birch and generated-audio descriptions.

Pip, Maple, Moss and Luma now have distinct personalities, English/Japanese overhead dialogue, weather remarks and click/F conversations. A nearby villager can approach over a clear path, stop with personal space, greet the player and return to their routine. Only one visit runs at a time; menus/activities suppress invitations, and distance plus cooldown prevent repeated visits. Read the [villager approach](VILLAGE_BUILD.md#2026-09-26-villager-approaches) and [dialogue](VILLAGE_BUILD.md#2026-09-25-villager-dialogue) milestones before changing these systems. Their 48 browser checks and integrated runtime observation supplement the earlier scene evidence; the old renderer-only captures do not show the speech bubbles.

Activity exits now return to clear ground: the pond bench and writing-nook wall no longer trap the traveler. All six activities have a visible **Back to village** button on desktop and mobile, with walking-camera and keyboard-focus restoration. See the [activity-exit evidence](VILLAGE_BUILD.md#2026-09-25-activity-exit-fix) for Firefox collision checks and desktop/mobile/simple-view verification.

The reported Firefox silence, restricted vertical camera and reversed/overlapping hearth seats have been fixed. The bridge has also been rebuilt: solid masonry arch, upward-facing deck, connected approaches and verified bank-to-bank traversal. The scene now has a cloud sky, surrounding textured terrain/mountains and distant birch LODs, four ambient residents and twelve flying birds. Read [the latest implementation evidence](VILLAGE_BUILD.md#2026-09-25-user-feedback-fixes) before repeating this work. Full art and listening acceptance remain open.

Verified at this milestone: production build/type checks, ten controller/composition checks, three bridge geometry/traversal checks, nine Firefox audio lifecycle checks, non-silent Firefox output and a clean production-preview console. The final two-minute desktop sample at 1280×720, DPR 1, high tier reports mean 22.00 ms (about 45 fps), p95 33.4 ms. It does not establish the desktop target below. Record new measurements after changes; do not use the older 9.29 ms systems profile as current performance.

The detailed source contracts now live in the [movement/world spec](docs/village/MOVEMENT_AND_WORLD.md#camera-bridge-and-ambient-life-feedback-fixes) and [audio compatibility notes](docs/village/MUSIC_AND_SOUND.md#verification-and-acceptance). Preserve the bridge deck/physics profile and shared `HEARTH` coordinates when refining the art.

### Next work

1. Finish the existing entrance/cottage/bridge/hearth composition against the approved image: authored architecture, spirit residents, near foliage, terrain blending and light. Keep the working bridge and open hearth arrangement.
2. Profile shadow passes, foliage overdraw, resident rigs and distant scenery before adding more scene detail; tune quality tiers with measured frame times. Then validate declared physical devices and cold loading.
3. Review the existing movement/audio recordings, refine spirit motion and camera occlusion, and complete long-session listening and physical-touch checks. Expand the remaining places only after the representative slice passes.

## What exists now

The root page uses raw Three.js inside the existing accessible React shell. The original six activities and their storage keys remain intact; the seventh garden place has its own save. Direct travel and simple view cover all seven. Current implementation:

| Area | Implemented now | Still required |
| --- | --- | --- |
| Movement | 120 Hz fixed simulation; walk/run/sprint; acceleration; jump/air/landing; buffered jump; unlimited dashing; desktop mouse-look; keyboard and touch controls | Motion polish, exhaustive collision/camera checks and physical-touch proof. |
| Ambient life | Four named residents on wider multi-point circuits who approach nearby players, with overhead dialogue, click/F chat and weather remarks; twelve animated birds | Richer expressions and behavior; all four now use decorated pastel spirit forms. |
| Player / residents | Original white spirit plus four pastel blob residents; hover, lean, fin flutter and character accessories; reproducible base Blender source | More expressive faces and motion refinement; no free vertical flight. |
| Scene | Colorful swept-roof cottages, painted materials, stone bridge, rounded tree crowns, mountain layers/floating gardens, three roadside timber fingerposts, flowing water and layered indoor/outdoor fire | More authored variation, terrain/material blending and composition refinement. |
| Activities / UI | Visible spirit and optional companions at all seven stations; state-driven hourglass, breathing rings, tea, quill and letters; warm paper panels, portrait bottom sheet, Enjoy the view toggle | Further environmental craft and physical-touch/long-session usability review. |
| Lighting/wind | Cloud sky and sunset HDR illumination; coordinated sun, fill and haze; practical lights; shared gusts across foliage, water and audio; weighted 16-tap PCF with detailed shadows updated each frame | Authored indirect light, smooth weather transitions, wind refinement and weather visual acceptance. |
| Music | Four complete Holizna recordings, scenery/location selection, four-second crossfades, manual override and two streaming decks; generated score archived | Long-session listening, Firefox streaming and physical-device/network coverage. |
| World audio | Recorded spatial stream/fire and rain; synthesized wind, sparse birds, takeoff/landing and interaction effects; separate mixer controls; hovering suppresses footsteps | Perceptual mix/positioning review, richer foley, occlusion and physical output-device review. |

Read [VILLAGE_BUILD.md](VILLAGE_BUILD.md) for current evidence and limits. The latest local two-minute profile averaged 75.0 fps (13.34 ms), p95 20.4 ms, at 1280×720, DPR 1, detailed quality. This is not physical-device or thermal acceptance. Source and contract checks do not close art or listening acceptance; earlier profiles describe earlier scenes and conditions.

## Required work, in order

All acceptance entries below remain **open**. MOVE-01, AUDIO-01/02, WIND-01 and the representative art slice now have integrated candidate implementations; do not redo their foundations. Continue from the evidence and unresolved findings.

| ID | Priority | Work and definition of completion |
| --- | --- | --- |
| `VIS-01` | P1 | Rebuild the entrance's architecture, terrain, bridge, planting and skyline. Paired captures visibly approach the approved composition without obvious repeated blockout assets. |
| `VIS-02` | P1 | Player is an original cute white flying spirit. Verify its smile, silhouette, gliding, hover, dash and jump in close/in-world views; retain four distinct animated blob residents and their conversations. |
| `LIGHT-01` | P1 | Art-direct sunlight, indirect light, shadows, haze and practical lights. Golden/dusk/rain all remain readable and intentional; no blown-out water or uniformly flat illumination. |
| `MOVE-01` | P1 | Refine gliding/unlimited dashing, jump/air/landing and mouse-look with collisions, smooth camera, keyboard and touch support. Meet [movement acceptance](docs/village/MOVEMENT_AND_WORLD.md#acceptance). |
| `AUDIO-01` | P1 | Use authored recordings that fit each location and weather context, with comfortable transitions and long-session listening quality. The procedural-score requirement is superseded. |
| `AUDIO-02` | P1 | Add world sound and animation-linked effects, spatial attenuation and indoor/outdoor transitions. Demonstrate audible behavior in a recorded traversal. |
| `WIND-01` | P1 | Coordinate wind across grass, trees, cloth, water and sound. Preserve grounded roots, believable motion and a calm experience. |
| `PLACE-01` | P1 | Finish the cottage and one outdoor activity to the same standard as the entrance, then bring all six places to that standard. |
| `PERF-01` | P1 | Profile real target devices and cold loading, establish working quality tiers, and meet agreed frame-time/loading budgets with final assets. |
| `QA-01` | P1 | Repeat visual, movement, listening, functional, accessibility and recovery checks with linked evidence. No P1 remains disguised by a passing build. |

### Milestones

1. **Production contracts are integrated.** Preserve the implemented scale, rig/clip names and shared movement/audio/wind events. Asset delivery conventions and device budgets still need final validation. Do not recreate the controller or restart settled product discovery.
2. **Finish a representative slice.** Produce the entrance, expressive spirits, focus cottage and nearby hearth/bridge. Assets and lighting are developed together. Review against the approved image before dressing the entire map.
3. **Polish the integrated experience.** Movement, unlimited dashing, camera, wind, recorded music and world sound are implemented. Refine their quality and verify them together before expansion.
4. **Finish the remaining places.** Reuse a coherent art kit with authored variation, preserving every activity and persistence contract.
5. **Optimize and prove completion.** Profile the finished assets, tune tiers, validate loading/recovery, record visual and audio evidence, and update the QA verdict. Publishing is a separate authorized action.

Lighting and performance should be checked throughout, not deferred until every expensive asset is integrated.

## Architecture and contracts to preserve

| File / directory | Responsibility |
| --- | --- |
| [app/page.tsx](app/page.tsx), [app/layout.tsx](app/layout.tsx) | Root entry, metadata and fonts. |
| [Village.tsx](features/village/Village.tsx) | React shell, engine lifecycle, preferences, dialogs, language, simple view, mobile controls and audio coordination. |
| [VillageEngine.ts](features/village/VillageEngine.ts) | Three.js renderer, character/camera, input, collision, scene transitions, weather and frame loop. Main integration hotspot. |
| [world.ts](features/village/world.ts), [architecture.ts](features/village/architecture.ts), [paintedTextures.ts](features/village/paintedTextures.ts), [fantasyTrees.ts](features/village/fantasyTrees.ts), [flame.ts](features/village/flame.ts) | World placement/colliders, original cottage kit, painted materials, opaque tree geometry, vegetation/water and flames. |
| [water.ts](features/village/water.ts), [shadows.ts](features/village/shadows.ts), [wayfinding.ts](features/village/wayfinding.ts) | Flowing river/pond shading, directional shadow filtering and localized physical signs. |
| [Activities.tsx](features/village/Activities.tsx), [useSession.ts](features/village/useSession.ts) | Activity controls and local persistence; deadline-based focus session. |
| [activityScene.ts](features/village/activityScene.ts), [environment.ts](features/village/environment.ts) | Authored activity actor/camera positions, animated props and the typed `ActivityMoment` UI-to-scene contract. |
| [places.ts](features/village/places.ts) | Stable place IDs, position/camera definitions, `Quality`, `Weather`, `AudioMix`. |
| [audio.ts](features/village/audio.ts), [soundtrack.ts](features/village/soundtrack.ts) | Web Audio mixer, recorded music streaming/crossfades, location selection, recorded nature beds and responsive effects. `composition.ts` is retained historical code, no longer imported by the village runtime. |
| [bridge.ts](features/village/bridge.ts), [atmosphere.ts](features/village/atmosphere.ts), [life.ts](features/village/life.ts) | Solid bridge geometry, cloud sky and bounded resident/bird animation. |
| [dialogue.ts](features/village/dialogue.ts), [life.ts](features/village/life.ts) | Resident personalities/localization, overhead DOM speech, chat and approach/visit/return behavior. |
| [movement.ts](features/village/movement.ts), [environment.ts](features/village/environment.ts) | Fixed simulation and unlimited dashing; shared bridge/floor/surface/collider/wind definitions and engine-to-shell contracts. |
| [public/village](public/village), [scripts/village](scripts/village) | Runtime assets/credits and asset preparation scripts. |
| [lib/basePath.ts](lib/basePath.ts) | Static-host asset URL prefixing. Preserve subpath hosting. |

Current engine methods include `load`, `setBlocked`, `setQuality`, `setWeather`, `setLanguage`, `setPlace`, `travel`, `walkKey`, `toggleRun`, and `dispose`. Its callbacks also emit `MovementStatus` (throttled 10 Hz), `WorldContact` (once per contact), and `EnvironmentFrame` (up to 12.5 Hz). `VillageAudio` exposes `start`, `stop`, `setMix`, `setPlace`, `setEnvironment`, `contact`, `chime`, and `dispose`. These contracts are implemented in `environment.ts`; see the updated movement and sound specs.

Releases use the existing `main` → GitHub Pages workflow; follow the [release checks](README.md#github-pages-releases). Publishing the candidate does not close the acceptance work below or authorize future Git writes/deployments without a user request.

Use actual 3D geometry for the walkable scene. Keep activity controls and essential HUD elements as accessible DOM. Do not move the timer/notes into a texture or require successful 3D navigation to reach them.

Preserve these storage keys and their data:

- `cosy-village-preferences` — current village preferences.
- `cosy-village-focus` — persisted focus session; retain wall-clock deadline behavior across reload/background time.
- `peaceful-room-gratitude-entries` — existing notes, entries shaped as `{ id: string, text: string, createdAt: string }`, with ISO date strings.
- `cosy-kept-note` — kept kind note.

Do not silently reset or migrate user notes/timers. Preserve English/Japanese controls, reduced-motion support, explicit audio activation, mute, direct travel, mobile usability, and the simple activity view.

## Initial performance targets — proposed, not measured

Confirm hardware and rendering resolution in the first performance task. These are starting budgets to guide production, not measured capabilities or immutable limits.

| Surface | Initial target |
| --- | --- |
| Desktop balanced tier | Aim for sustained 60 fps at a 1920 × 1080 viewport; p95 frame time ≤20 ms during a repeatable two-minute traversal. Record actual drawing-buffer size and DPR. |
| Mobile low tier | Aim for sustained 30 fps; p95 ≤40 ms during the same traversal on an explicitly named physical phone, including thermal behavior. |
| Scene complexity | Start around ≤100 draw calls and ≤1M reported triangles in typical views; justify hero views above those by measured GPU time. Count shadow passes consistently. |
| Texture residency | Initial planning ceiling roughly 256 MB low / 512 MB high, estimated from actual formats, mipmaps and residency; JS heap is not GPU memory. |
| Loading | Aim for ≤10 MB transferred before a useful first scene, with later places/audio loaded as needed. Test cold cache at a stated constrained network profile. |
| Calm/idle behavior | Pause rendering when hidden; avoid unnecessary work when settled. Suspend/stop unused audio work safely; never burst overdue notes on resume. |

Lower detail, shadow resolution, distant vegetation and effects before harming controls or activity availability. Record both visual tradeoffs and measurements. A low tier must still look deliberately art-directed.

## Work packages for new agents

These are handoff boundaries, **not authorization to launch agents, buy assets, change dependencies, commit, or deploy**. Follow the current task's instructions. A primary integration owner should coordinate shared files.

| Package | Owns | Boundary / required delivery |
| --- | --- | --- |
| Environment art | Asset sources, GLBs/textures, placement proposal, credits | Read art spec. Supply an asset manifest, contact sheets, LOD/texture counts, and recommended placement. Coordinate `world.ts` edits with integration owner. |
| Character and movement | Traveler rig/clips, movement state/collision/camera, input hints | Read movement spec. Own `VillageEngine.ts` only during an agreed window; coordinate shell events/HUD with integrator. Deliver motion recordings and collision tests. |
| Lighting and atmosphere | Scene lighting, materials, environment maps, wind integration | Read both art and world specs. Coordinate renderer/world edits; demonstrate reference-matched captures and GPU cost. |
| Music and world sound | Composition engine, licensed samples/effects, mixer and audio events | Read sound spec. Own `audio.ts` and audio assets; request engine events rather than independently rewriting movement. Deliver playable recordings and listening notes. |
| Integration and performance | Shared contracts, shell, lifecycle, profiling, functional QA | Preserve source/data boundaries; review all assets and code. Own canonical evidence and final QA verdict. |

Every package returns: changed paths, implemented versus pending items, provenance, exact verification performed, linked screenshots/video/audio as applicable, measured costs, unresolved risks, and next steps. Update existing documents; avoid creating conflicting alternate roadmaps.

### Copyable task brief

> Read `VILLAGE_HANDOFF.md`, `VILLAGE_BUILD.md`, `design-qa.md`, and the specification for your assigned package. Open the bundled approved image and current captures under `docs/village/evidence`; the prototype reference captures are historical. Continue the existing Cosy village; do not restart the project or use earlier local redesigns as the baseline. Arkenfall is a heavy experiential reference; the approved image is the visual target. PDF/manga/books/search are excluded. Work only on **[package and gap IDs]**, within **[owned files / integration boundary]**. Preserve the six activities, local data, direct travel, simple view, audio consent, and static-host paths. Deliver implementation/assets plus visual, audible, functional and performance evidence appropriate to the change. State what remains unfinished and update the canonical status. Follow current approval rules for dependencies, costs, Git and deployment.

## Completion gate

- The entrance and activity environments visibly approach the approved image in composition, assets, lighting, depth and material quality. Updated paired visual QA has no unresolved P1 art gaps.
- The traveler walks, runs, sprints, jumps and lands convincingly; dashing remains unlimited and never blocks basic access to activities.
- Wind and world sound make the environment feel alive. Music passes actual long-session listening, with clearly distinct presets and meaningful musical development.
- All six activities and stored data still work across reloads; touch, keyboard, language, focus management and reduced motion are validated.
- Frame times, memory estimates and cold loading are measured on declared devices. Console, disposal, tab-resume and WebGL failure/recovery behavior have been checked.
- Evidence is linked and reproducible. A build alone, a generated concept, or a “playing” label cannot satisfy these gates.
