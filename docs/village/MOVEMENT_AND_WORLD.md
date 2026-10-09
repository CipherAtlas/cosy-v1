# Movement, camera, and a living world

## Quiet-space rendering and camera — 2026-10-09 local

Stationary visible sessions render at 30 FPS; keyboard, pointer, touch movement, riding and swinging restore interactive cadence immediately. Static tree instance classification/uploads are cached until the camera, player or projection changes. The private cottage's outdoor window renders at 10 Hz while idle. Intentional idle cadence does not trigger graphics fallback; genuinely slow frames still can. Visible 120 ms heartbeats retain the shared actor clock beneath menus. Unchanged hidden-page heartbeats renew at one second, while ownership/visibility changes bypass the throttle.

Camera obstruction uses indexed layout solids and camera-only stable roof/willow bounds. Near rails or roofs it tries a clear side or lower view before compressing the camera into the visitor. Pond staging follows the authored dock transform from the open bank. A shared screen-space allocator reserves NPC conversation first, then animal responses, visitor speech and names, avoiding visible HUD/panels, screen edges and other bubbles. Distance/frustum checks precede indexed scenery visibility. Worker collision, saved world geometry and interaction authority are unchanged. [Verification and remaining limits](../../VILLAGE_BUILD.md#2026-10-09--quiet-space-audit-fixes-local).

## Horse riding and shared collision latency — 2026-10-09 local

Rider corrections compare positions at the same frame time. Horse acceleration/braking are 8/18 m/s², coasting deceleration is 9 m/s², and steering ranges from 2.4 rad/s at rest to 1.5 rad/s at 9 m/s canter. The solver accepts moderate .85 terrain grades and shallow .12 m × scale paving steps without allowing cliffs or water. Collision-edge sliding retains forward speed. The full body, shared occupancy and countdown rules still apply to both Worker and bounded rider prediction.

Movement controllers share an 8 m spatial index of fixed layout colliders, including rotated bounds and footprint margins. Public actors advanced by horse controls no longer scan every solid for every movement probe; walking, jump supports and ceilings use the same exact tests on nearby candidates. [Verification and local/live limits](../../VILLAGE_BUILD.md#2026-10-09--horse-riding-physics-and-collision-latency-local).

## Multiplayer horse response — 2026-10-07 local

The accepted rider sees keyboard/thumbstick steering and braking on display frames, with at most 350 ms of motion projected from the latest Worker snapshot. Newer rapid controls replace the held input without a 50 ms rejection window. The same horse footprint, terrain, acceleration and braking rules apply to prediction and authority; snapshots reconcile small positional errors. Prediction clears on dismount/ownership loss, cannot move during race countdowns, and stops on stale delivery. Other visitors keep the accepted shared path and saddle attachment; predicted poses cannot grant ownership, move the shared horse or advance race checkpoints. Older Worker snapshots retain accepted-path rendering. [Checks and limits](../../VILLAGE_BUILD.md#2026-10-07--responsive-multiplayer-horse-controls-local).

River surface details follow distance along each saved curve, flowing from the first path point to the last. Fine ripple normals and sparse foam share one downstream field. Hill waterfall has one falling curtain and a narrow lowered outlet with a carved bed, replacing the elevated disk. Reduced motion freezes water. [Local rendered-direction/editor/export checks](../../VILLAGE_BUILD.md#2026-10-07--downstream-water-correction-local).

The active north pond clearing has no circular paving, lamppost or low lantern; existing grass fills the removed paving footprint. Worker physics omits the two removed lamp collisions. [Local checks](../../VILLAGE_BUILD.md#2026-10-07--north-pond-clearing-cleanup-local).

## Starter screen — 2026-10-05 local

A slow animated view of the existing village sits behind **Enter Hearthwillow**, **Language** and **Settings**. Language opens English/Japanese choices; Settings opens the same Experience, Sound and Controls used during play, with immediate on-device saving. Loading first fills the screen with Hearthwillow and a progress bar without visible numbers. A 550 ms fade reveals the menu once assets are ready; reduced motion reveals it immediately. Menus close with Escape, contain keyboard focus and return focus to their opening button. WASD (or saved movement bindings) navigate menu controls and E (or the saved interaction binding) activates them; Up/Down, Home/End and Enter/Space retain their main-menu roles. Inputs, native selects, sliders and key capture retain their normal keys. Entry focuses the gameplay canvas and starts the shared connection. An explicit sound choice before entry is respected. Reduced motion holds the title camera still; graphics failure preserves Settings and offers retry. The phone gate remains ahead of scene loading. [Current local/live checks and limits](../../VILLAGE_BUILD.md#2026-10-05--full-screen-loading-and-game-key-menu-navigation).

After entry, a short English/Japanese welcome guide explains movement/look, nearby actions, map activities, visitor chat/resident conversation and Settings. The guide starts at the top and E starts wandering. “Don't show tutorial” in the guide or Settings → Experience is saved on this device; “Read the village guide” opens it again regardless of that preference. Manual-guide Back returns to Settings. Escape/Backspace or the visible Back control leaves a menu; native fields and key capture keep their normal keys. [Starter document](GETTING_STARTED.md) · [Checks and limits](../../VILLAGE_BUILD.md#2026-10-05--short-welcome-guide-and-keyboard-back-navigation).

## Japanese language and chat — 2026-10-05 local

Choose English or 日本語 in the starter screen’s Language menu or in Settings → Experience → Language. Fresh Japanese-language browsers start in Japanese; an explicit saved choice takes priority, including saved English. Resident and animal dialogue, farms, orchard/owls, horse names, racing, harvest basket and current shared-world refusals use Japanese. The chat room translates its controls, self label, hourly clearing notice and cooldown, formatting times in the selected language and device time zone. Messages from visitors remain as written. Japanese text uses system fonts, strict line breaking and increased reading space; keyboard shortcut keycaps remain unchanged.

While entering Japanese, Enter confirms the IME composition and Escape stays with the input. After confirmation, Enter sends normally, retaining the shared three-second cooldown and 180-character limit. Closing and reopening chat clears its composition state so a draft cannot become stuck. [Checks and remaining limits](../../VILLAGE_BUILD.md#2026-10-05--japanese-language-and-chat-support-local).

## iPad and tablet controls — 2026-10-05 local

Supported devices are iPads, tablets, laptops and PCs; phones cannot mount the scene. iPadOS desktop-style Safari identity and Android tablet identities are accepted. Touch capability selects controls independently of window width. Left Move gives camera-relative analog walking (forward/back and steering on an accepted horse); dragging the scene with the other thumb turns/tilts the camera. Release centers the movement stick and stops camera dragging. Run toggles faster movement; Jump is a separate tap. Horseback uses Canter and a short Brake action. Seated and activity views retain camera look and their existing contextual actions. Swing pumping/braking retains its labeled touch buttons. Map/Settings/loading, backgrounding, pointer cancellation, resizing and unmounting clear held controls.

The movement thumbstick and action buttons stay in safe-area-aware bottom corners, with interaction panels above them; tablet chat starts collapsed. Small desktop windows retain keyboard controls without showing thumbsticks based on width alone. [Local checks and remaining limits](../../VILLAGE_BUILD.md#2026-10-05--tablet-controls-local).


## Luma offering shortcuts — 2026-10-05 local

Luma’s available offerings now show square shortcut keycaps: 1 carrot, 2 radish, 3 mint, C sunflower and B daisy; E drinks prepared mint tea. Click and keyboard use the existing activity dispatch and Worker validation, and saved keybindings update both shortcuts and keycaps. Unavailable inventory stays hidden. Gift keycaps use dark green text on the crop-colored buttons. Local build/types/export privacy and 23 focused offering-control checks pass; shared tea-flow, native Firefox and live verification remain open. No publication. [Checks and limits](../../VILLAGE_BUILD.md#2026-10-05--luma-offering-shortcuts-local).

## Farmers and horse caretaker — 2026-10-05 local

Rusk, Poppy and Cress stay near the carrot, radish and mint farms on editable shared routes, with individual bilingual dialogue and clothing. Rowan approaches available stable horses and alternates a short shared hay meal and petting, roughly six seconds apart. Worker clocks own the horse holds/meals; visitor-owned horses and meals take priority. Talking holds the resident for that visitor and observers see the same speech.

All four use the existing projected dialogue with Chat F; workers do not offer Walk with me. Rowan's accepted conversation exposes Race together C. The Worker requires the inviter's nearby conversation, a free real horse and a clear course; a rejection grants neither a mount nor a race. Acceptance seats the visitor and Rowan, broadcasts the original countdown and suppresses the standing Rowan. Rowan returns after his lap, cancellation or abandonment. No idle rider or bottom-right NPC start action remains. F cancels an active owned race; horse dismount controls remain. F chatting takes priority over a nearby horse's F hay action while an eligible villager dialogue is visible. [Checks and preview limits](../../VILLAGE_BUILD.md#2026-10-05--farmers-and-horse-caretaker-local).

## Personal settings and keybindings — 2026-10-04 local

Settings now groups Experience, Sound and Controls in a compact forest-green panel. Preferences save on this device, including graphics choice, mouse sensitivity and custom keys. Sound keeps the requested 15%/54%/75% defaults, a scoped reset and optional river/wind sliders. Changing weather leaves the sound mix intact. Graphics still defaults to Gentle on battery when no preference exists.

Controls lets visitors replace or explicitly swap twenty-nine bindings across movement, contextual interactions/presets, dogs and menus. One key can have only one assignment; malformed or duplicate saved bindings fall back to defaults. Escape cancels capture first; Reset keys restores only bindings. Arrow keys remain navigation/movement alternatives, and Escape/Tab/Enter keep their browser/navigation roles. Ctrl/Meta/Alt combinations and browser function keys are not assignable. Contextual reuse (for example interact/pet/sit or jump/brake/pause) is one action slot. Keycaps, accessible shortcuts, native resident controls, horse/swing input and map directions follow the saved assignment. Native button Enter/Space activation and journal Ctrl/Meta+Enter stay standard. Worker ownership and accepted interaction clocks are unchanged.


## Map travel and named farms (2026-10-04, local)

The full-screen atlas uses its own cream-and-green cursor, compact forest-green edge controls and a reduced-motion-aware fade. M/the personal map key toggles it; Escape or the close button closes it. The atlas is zoomed in 18%. Destination names stay above their actual anchored buttons in readable horizontal labels; crowded names reveal on hover or keyboard selection. Little postbox uses its saved object location. Player motion follows display frames without rebuilding the landscape, and hidden 3D draws stop while the atlas is open. A gold compass diamond marks you; larger blue circles identify other players with their names directly above their actual position, without character callout lines. NPCs and dogs are omitted from both maps. Private-focus visitors are omitted. Hover/focus highlights a destination. [Current local atlas checks](../../VILLAGE_BUILD.md#2026-10-05--readable-atlas-labels-and-player-markers-local).

Map destinations include one Meadow Swings option, the grazing field, circuit, three farms and owl grove. Click, Tab/Enter/Space and the existing directional map navigation use the same destination buttons. The Worker derives travel points from editable placements and chooses clear, unoccupied ground within four metres; unknown, disconnected or blocked requests cannot teleport locally. Accepted travel releases seats, private focus and current shared engagements, dismounts a ridden horse safely, and publishes one shared visitor position. Travel does not reserve or start the destination activity. Opening the map pauses movement; that inactive pose must not reject an otherwise valid travel request. The map offers seven outdoor choices while both physical swing sets retain their shared server IDs. [Main-preview checks](../../VILLAGE_BUILD.md#2026-10-04--map-destinations-active-on-the-main-preview-local) and [verified Firefox reconnection](../../VILLAGE_BUILD.md#2026-10-04--local-connection-build-isolation) distinguish current behavior from earlier isolated previews.

The three named farms are crop-specific (carrot/radish/mint), including accepted planting, fresh rows, restored growing rows and map labels. Existing harvest inventory and growth clocks are preserved. Generic garden beds retain crop selection. [Verification and current preview limits](../../VILLAGE_BUILD.md#2026-10-04--map-travel-and-named-farm-crops-local-side-change).

## Horse meals and interface copy — 2026-10-04 local

Native horses lower their neck/head and chew using the accepted shared hay clock. Feeding continues if its visitor disconnects and ends at the original deadline; reduced motion shows a still feeding pose. Controls use concise names, status and timers without decorative helper paragraphs or narrator success toasts. Animal/NPC speech and personal notes remain. [Checks and preview limits](../../VILLAGE_BUILD.md#2026-10-04--horse-eating-and-decorative-helper-text-removal-local).

## 2026-10-04 town revision (local)

Patrol endpoints use the same collision/water rules as movement. Blocked authored endpoints resolve to nearby clear ground; a layout hash change discards obsolete saved actor poses, and an arrived waypoint no longer issues another step toward its old target. The Worker owns NPC/dog/animal routes, .72 m/s pasture motion, 1.2 m/s hedgehog foraging and held pet/meal positions. Shared rendered animal gait follows distance traveled, with accepted timestamp interpolation and eased pet/heading transitions.

The circuit starts at the stable-side southern ribbon, not across the limestone lane. Its accepted three-second countdown and 90-second race deadline appear at the top center, along with elapsed time, eight ordered gates, Rowan’s progress and distance to the highlighted next gate. Gates allow 6.2 m approach tolerance; horses step over shallow paving edges and slide along legal collision edges while still refusing water, solids and steep ground. Bottom-right controls are minor options; farm actions sit lower center, with nearby top-center progress and world-space row growth timers.

I opens one private browser basket for kitchen and farm crops, apples, mushrooms, flowers and mint tea. Accepted shared harvesting/picking/gifts add items only to that basket; feeding/gifting consumes them in the Worker. Apple trees have a shared 30-second regrowth clock, including hedgehog reservations. The browser stores a resume token and accepted counters; it never sends resource counts. Existing public beds, food availability and clocks remain shared. See [current verification](../../VILLAGE_BUILD.md#2026-10-04--town-interaction-and-layout-revision-local).


## Path and water planting — 2026-10-04 local

Every visible original or drawn river also has smaller pale limestone stones along both rendered banks, sampled after saved transforms and terrain conformity. Paving crossings and joined water remain open; the decoration adds no collision or shared interaction state. The local editor regenerates this edging as the river changes and offers a reusable **Small riverbank stone** on its Nature shelf. Original presets and saved layout data remain compatible. [Local scene/editor checks and preview status](../../VILLAGE_BUILD.md#2026-10-05--automatic-riverbank-stones-local).

Land grass/flowers/shrubs now clear actual transformed paving, all bridge decks and water with their full geometry/wind footprint. The marker survives architecture batching; the editor uses the same mask and restores source instances after path moves/undo. Shore plants avoid stone while retaining water-edge planting. Fourteen lilies grow in three near-bank colonies; the centre/eastern dock stays open. Eight trunks/two shrubs moved onto clear verges, with regenerated matching Worker physics. Pond planting follows the saved transform in both runtime and editor. [Verification and limits](../../VILLAGE_BUILD.md#2026-10-04--path-and-water-planting-polish-local).

## Town farms, pasture, owls and horse circuit — 2026-10-04 local

The town routes link fourteen homes, three five-row farms, an enlarged pond/owl grove, a raised cow/sheep/lamb meadow and the stable/circuit through curved paths and brook crossings. The original kitchen garden retains its own tending and adds a pettable hedgehog. Every outdoor task and animal uses accepted Worker state. E pets a nearby cow/sheep/lamb/hedgehog for six seconds; nuzzles, reaching gestures, hearts and species calls use the shared clock. Empty farm rows offer E carrots, 2 radishes or 3 mint, followed by E watering and E harvest after three minutes. Harvest enters the visitor's private basket; public totals retain historical harvest counts. Row-end interaction uses the whole sixteen-metre footprint.

At the owl roost E takes treats, then E feeds the three owls; they leave their woodland loops, peck together and return over a twelve-second shared meal. F at a nearby stable horse offers twelve seconds of hay and prevents mounting or restarting the occupied meal. Ride Juniper/Willow with the existing W/S/A/D, Shift canter and Space brake controls. Talk to Rowan beside the stable with F, then choose Race together C in his dialogue to automatically mount both racers for a three-second countdown and one clockwise lap through eight ordered gates. F cancels the race while retaining the ride; E/Escape dismounts safely. Claims release on leaving, distance, inactivity, disconnection and presence expiry. Panels use compact translucent green/cream buttons, square shortcut keycaps and press feedback. [Local verification and limits](../../VILLAGE_BUILD.md#2026-10-04--town-interaction-and-layout-revision-local); no publication is claimed.

The garden hedgehog follows clear routes from its grassy mushroom patch to the apple tree and mushroom patch, picks up for 1.4 seconds, carries one item home and waits for a visitor. E receives the offered gift; 2 pets it while preserving that gift. Accepted inventory is private and resumes through the browser's saved token after disconnect/reload. F feeds a nearby Highland cow one accepted apple; 3 feeds one mushroom. The cow faces its feeder and enjoys an exclusive eight-second munch with hearts and a Moo emote. Gift, pet and meal cameras try both sides and diagonal views against actual solids and the orchard canopy, keeping the creature and its carried prop/emote visible. Pond families swim forward on shared world time; quiet head dips/wing stretches and staggered supper hearts respect reduced motion. Continuous meadow planting clears river/pond water, paving, bridge approaches, farm soil and the race tread while retaining green aisles and infield.

Updated: 2026-10-01. Production specification and remaining acceptance for `MOVE-01`, `WIND-01`, and movement-linked `AUDIO-02`. Read the [canonical handoff](../../VILLAGE_HANDOFF.md) and [sound specification](MUSIC_AND_SOUND.md).

## Minimap and keyboard controls — 2026-10-01 published

[Release and live checks](../../VILLAGE_BUILD.md#2026-10-01--map-and-kind-note-release-published) confirm publication; local evidence below covers the broader three-client suite.

The top right contains a persistent north-up minimap and Settings. It follows the spirit's position and heading with an uncapped requestAnimationFrame loop by updating only the SVG viewport and player glyph. The landscape stays mounted between frames; stationary/hidden states avoid redundant map writes. M or clicking the map opens the full-screen illustrated atlas; WASD/arrows choose destinations spatially, Enter travels and Escape closes. The map reads built-world path spines, cottage/spire sizes and rotations, tree and bench positions, authored fencing and rotated swing placements. Pond, river, bridge, dock, garden beds and clearing use their shared game constants. Bounds include the northern spire and Sunrise meadow swings. The full-screen view is 18% closer; destination icons retain geographic anchors and crowded labels reveal on hover/focus without guide lines, while blue player markers and their names stay at their actual coordinates. Inside the private cottage the marker stays at its outdoor entrance.

Entering an activity, bench, swing or dog-trick menu preserves mouse capture. Captured movement orbits activities. Esc leaves the current activity/seat/trick menu and releases capture, including browsers which consume the key while unlocking; E can stand up or get off while retaining capture. Tab/Shift Tab cycle visible controls without release, and Enter/Space activate the selected control. Focus/breathing use Space to start/pause, R to reset and 1–3 for presets. Focus uses B for the available break action; notes use E/K, feeding uses F and special mint tea uses E. Ctrl/Command Enter saves a journal entry; typing remains isolated from movement. Activities have a top-right X, benches a nearby X and occupied swings an X inside their panel. U toggles activity controls. M, O and comma open map, Sound and Settings; menus and chat release the cursor for pointer use. Esc in the chat field closes chat and restores canvas focus, preserving the activity. All controls retain press feedback and reduced-motion highlights.

This supersedes earlier automatic activity-release and dog-toggle-focus descriptions below. Local verification and remaining limits are recorded in [the build ledger](../../VILLAGE_BUILD.md#2026-10-01--minimap-and-keyboard-interactions-local).

## Meadow swings — 2026-09-30 local

The former Sunrise meadow bench at `(59, 2.397839, 28)`, facing 90 degrees, is replaced by two independent pendulums. E mounts the nearest seat, while the buttons choose left/right. W/S or up/down arrows apply forward/backward torque; pumping in the direction of travel gains height. Space dissipates energy; E/Escape/Get off selects clear ground beyond the arc and restores walking. Menus pause and clear input, blur/hiding clear held input, and travel/R recovery release the seat. Button holds have pointer capture and cancellation; Enter activates a short pump/brake pulse. Typing stays isolated. The 120 Hz solver uses 9.81 m/s² gravity, a 2.65 m default chain, damping and an energy ceiling corresponding to 78 degrees; the seat can rise roughly 2.10 m. Seat carriers remain level and the camera frames the entire arc from a stable diagonal. Reduced motion disables decorative body bob/roll/lean; deliberate swinging stays usable.

The 320 px lower-right panel and its buttons are translucent, following the strong 13-inch laptop/world-space requirement in `AGENTS.md`. The editor saves/applys position, facing and uniform scale, and length scaling changes the physical period. The shared protocol transmits the swing ID, seat, angle and angular velocity, including occupied seats in arrival snapshots. Remote pendulums interpolate with at most 0.24 seconds of prediction, and the visitor position is derived from the same visible seat transform with the player’s 0.62 m body offset. The Worker reserves seats in socket attachments, rejects simultaneous conflicting claims and releases them on exit/disconnect. Occupied seat buttons are disabled for other visitors. [The shared-interaction release](../../VILLAGE_BUILD.md#2026-09-30-shared-interaction-release-published) records matching Worker/client publication and live verification. [Local evidence and remaining limits](../../VILLAGE_BUILD.md#2026-09-30-meadow-swings-and-13-inch-scene-space-local).

## Dialogue and animal action keycaps — 2026-09-30 local

Nearby NPC dialogue buttons, including Wren's crumb action, display their actual F/C/B/E keys in clear square keycaps inside the bordered buttons. Puppy Pet, Walk with and Send home show E/P/H the same way. These keycaps remain visible in touch layouts, where the buttons are at least 44 px tall; tapping and keyboard shortcuts invoke the same actions. The corresponding rule is in the local `AGENTS.md`. See [checks and limits](../../VILLAGE_BUILD.md#2026-09-30-dialogue-and-animal-action-keycaps-local).

Animal responses use the original flock’s cream rounded bubble, projected near native/legacy heads. One nearby active response takes priority over idle calls; offscreen/distant responses disappear. Cow/sheep/lamb/Bramble/owl/pond/dog/horse replies follow accepted outdoor clocks; the cottage cat is private. English/Japanese and reduced motion are supported. [Local checks](evidence/animal-dialogue-20261004/README.md).

## Bench side selection — 2026-09-29 local

Within the existing bench interaction distance, clicking or tapping either half of the visible bench seats the spirit on that side. The engine checks a rotated bench-sized hit box, so gaps between timber slats are still tappable. A drag starting on the bench continues camera look without seating. With pointer lock active, the center aim selects the side under it. E and the nearby Sit button retain automatic seat choice; when the chosen side is occupied and the other is free, the free side takes priority. Stand up and shared-visitor collision resolution continue to use the existing paths. See [local checks](../../VILLAGE_BUILD.md#2026-09-29-bench-side-selection-local).

At the birdwatching bench, **F** and the matching button scatter sourdough crumbs from the cloth pouch beside the seat. The first use gives the visitor the existing reusable pouch before feeding; E still stands up. Wren auto-feeds only when no other blob (local/shared visitors or residents) is within 7 m of the clearing. Unfed birds become sad after six seconds with **Coo coo :(**, eased head/wing droop and a still reduced-motion pose. A meal restores their hearts and thanks. See [local checks and limits](../../VILLAGE_BUILD.md#2026-09-30-seated-bird-feeding-redo-local).

## Luma's mint cue — 2026-09-29 local

Picking mint in the walkable garden puts one leaf in the existing basket. While mint remains, Luma shows an animated red exclamation above her head when visible, and her nearby conversation keeps the **Share your harvest over tea** action open and highlighted after greeting text expires. Click/tap or E beside Luma enters the tea activity when the action is visible, where the existing mint gift makes special tea. Giving away the last mint clears both cues; reduced motion makes the exclamation still. NPC action keys C, B and E appear in the same boxed style as Chat's F. E prioritizes visible nearby Luma's tea action over another nearby world interaction. See [local verification](../../VILLAGE_BUILD.md#2026-09-29-luma-mint-interaction-cue-local).

## Puppy patrols, petting and pack walks — 2026-09-30 local

Six saved puppy placements feed `PuppyPack`: corgi, Shiba, beagle, Samoyed, Border Collie and German Shepherd. Position, yaw, scale and name remain editor-compatible, with independent skeletons and all ten clips per placed dog. Local patrols and pack routes use `VillageNavigation` and the same collision/water rules as the player. Existing home placements and protected presets are preserved; Fern and Atlas have new entrance-area placements.

P adds a nearby dog without replacing the current walkers, or releases that dog if already invited. Approach each additional dog and invite it individually; there is no summon-all button, L shortcut or bulk invitation API. H dismisses all walking dogs. Paired rows follow the player's traveled path with fixed slots; blocked lateral clearance switches to single file, and 0.8 seconds of open ground restores pairs. Speed eases near the target and through turns; avoidance and a 0.68 m minimum body-center separation keep dogs from piling up. They route around world obstacles, wait nearby during a pet and pause while exploration is blocked. Distant and obstructed dogs cannot be invited. Dog invitations last for the current visit and remain local to this client; remote visitors do not receive synchronized dog companions. Dogs stay out of the private focus room.

The nearby dog panel groups its name, breed/walking status, E Pet, P Walk / Home, T Tricks and response in one 320 px translucent forest-green surface. Six tricks use two columns of bordered buttons. Choosing or finishing a trick keeps the list open and retains button focus. The selected nearby dog pauses its patrol/follow movement while the trick list is open, without pausing its trick or pet approach; walking away beyond 2.65 m or leaving the interaction releases the hold. The selected dog takes priority over another passing dog so the list stays stable. T toggles the list; Escape closes it, and either keyboard close returns focus to the canvas. Opening retains canvas focus and capture; Tab reaches the commands; Enter/Space activate buttons. Z Sit, X Dance, V Spin, Q Bow, J Wave and K Roll over also work while the list is closed. E/P/H remain available from focused dog buttons, and M expands the village map. The disclosure resets on dog/context changes and ignores typing, unrelated buttons and blocked menus. P replaces the duplicate visible H action for a single nearby walker; H still sends the whole pack home. Buttons have square keycaps and at least 44 px targets. Smaller computer windows lift the dock clear of walking hints; short windows scroll it. Phone browser identities are refused before scene mounting with a request to use an iPad, tablet, laptop or PC; viewport width alone does not refuse computer entry. [Local keyboard, laptop viewport and device-entry checks](../../VILLAGE_BUILD.md#2026-09-30-translucent-dog-controls-and-laptop-only-entry-local) are recorded separately from deployed behavior.

E requests a nearby pet on unobstructed ground. The dog first reaches its stance 1.14 m from the player and faces them; only then does its three-second happy clip and yip begin. The blob turns to share the dog's forward direction, lowers beside its head and pats the near cheek with an original tiny fin. Both body motion and release ease over 0.65 seconds; the small fin keeps its original scale and rotates gently. The stance checks both sides for a clear approach, rejecting the pet if neither side is walkable. The head's animated position sets the contact height, so the blob lowers farther for smaller dogs. A front diagonal camera shows both faces. The other walkers wait nearby. Walking, jumping or entering an activity cancels petting. Reduced motion holds a still dog/body/hand pose, without hearts or automatic pet/trick camera framing. Player, residents and remote visitor blobs share the original small-arm artwork; nearby resident hand-holding also uses those fins. The walking camera keeps the player as its anchor: nearby collected dogs can shift the horizontal target by at most 1.2 m, and automatic pack pullback adds at most 2.8 m to the chosen zoom. A lower look target keeps the rear row in frame; while moving with multiple dogs, camera position and look direction respond at 14/s rather than 7/s. This limits straggler-driven pullback and catches up sooner during turns. [Local camera evidence and limits](../../VILLAGE_BUILD.md#2026-09-30-player-focused-dog-pack-camera-local) cover laptop viewports and 30/60/120 FPS simulations. [Local behavior and evidence](../../VILLAGE_BUILD.md#2026-09-30-small-blob-arms-and-collecting-dogs-local).

The Worker broadcasts validated dog ID, trick, position, facing and authoritative start time. All clients apply the accepted command without rebroadcasting it. The active clip snapshot survives Worker hibernation and is supplied to joining/reconnecting visitors until its authored duration expires. Clients seek the clip to its elapsed time; invalid, distant and excessively frequent requests are rejected. Patrols, petting and follower invitations remain per visitor. [Shared interaction and panel checks](../../VILLAGE_BUILD.md#2026-09-30-shared-swings-dog-tricks-and-unified-dog-panel-local) distinguish local verification from publication.

## Playable world layout — 2026-09-29

The local game loads `public/village/world-layout.json` before building the scene. Its authored walkable ellipses extend the spirit's former fixed exploration bounds; the eastern Sunrise meadow overlaps the old boundary so the route is continuous. The same loaded layout supplies limestone path surfaces, terrain-following oak fence lines and movement collision, trees, grass and planting clearings, new oak benches, fully transformed crumb pouches, existing cottage/spire positions and optional resident waypoint/pause circuits. `VillageNavigation` expands its lazy grid to cover walkable areas, uses the player's `clear` and `canWalkTo` rules for obstacles/water, and gives stone paths a small cost preference. The studio checks waypoint reachability with those rules before Apply. The current local file applies the saved **My village** copy while retaining six newer lanterns; [the latest ledger entry](../../VILLAGE_BUILD.md#2026-09-29-saved-my-village-layout-and-studio-editing-local) records verification.

Existing cottage and spire collision follows saved positions; bridge colliders, activity positions, garden behavior and cameras remain in their game modules. The Apply action rejects unsupported object-transform changes. Walkable areas do not sculpt terrain; larger new regions need authored terrain, runtime anchor integration and performance review before release.

## Nearby recovery — 2026-09-29

R, or Unstuck in the touch controls, moves a stuck spirit to nearby clear ground during exploration. G now toggles quick glide. Recovery searches outward up to 12 m using the walking controller's collision and walkability checks, excludes the bridge deck, dock and water edges, and checks room and terrain around the landing point. It settles velocity and jumping, releases mouse capture and held input, and moves the walking camera immediately. If no nearby spot passes, it uses the clear village entrance; an unavailable destination is reported. It is disabled in menus and activities. The bridge regression exercises both approaches and the middle; the local build ledger records verification limits.

The current local bridge has identical 1.8 m bank-side openings at all four corners. Parapets, terminal posts and coping mirror across the deck; projecting end abutments are removed. `BRIDGE_BARRIERS` supplies continuous rounded movement footprints around the stonework with 8 cm extra clearance, blocking jumps and permitting rail sliding. `VillageMovement` separates an overlapping spirit onto the nearest clear deck/bank point within 1 m using the river/obstacle rules for walking; R/touch recovery remains available if no correction is clear. The deck-height profile is unchanged. The local studio uses the same generated mesh under the existing asset ID; saved layouts are unchanged. [Bridge, full-world keyboard and editor checks](../../VILLAGE_BUILD.md#2026-09-30-symmetric-bridge-and-corner-collision-local) passed locally; physical-device input, Safari, live shared visitors and deployment remain unverified.

## Mouse sensitivity — 2026-09-29

Settings saves mouse sensitivity from 25% to 200% in the existing browser-local village preferences. At 100%, camera rotation keeps its previous speed. The multiplier applies to captured desktop mouse movement, fallback mouse dragging, and mouse dragging during settled activities. Touch dragging keeps its existing speed. See the [local implementation and verification](../../VILLAGE_BUILD.md#2026-09-29-mouse-sensitivity).

## Current camera input — 2026-09-28

The desktop scene captures the mouse after a click and uses mouse movement to look without holding a button. Escape, menus, blur and disposal release it; activities retain it. If browser capture is unavailable, dragging the scene looks around instead. Touch uses drag-to-look and movement buttons. Ground clicks and taps do not move the spirit. Verify with `scripts/village/tests/camera.cjs` against the local QA harness.

## 2026-09-27 settled camera dragging

While settled at any of the seven activities, hold and drag the scene to orbit the authored look target. Mouse and touch use pointer capture; activity controls remain directly clickable. The orbit has independent yaw/pitch, terrain/obstruction clearance outdoors and interior bounds in the cottage. Release, cancellation, menus and blur stop dragging. Each visit starts at its authored view; exiting restores the walking orientation. See [focused checks and native UI verification](../../VILLAGE_BUILD.md#2026-09-27-happy-ducks-and-settled-cameras).

## 2026-09-27 garden and companions

C or a nearby resident's button toggles following; Friends supports any subset or all four. `navigation.ts` builds a lazy 0.75 m grid from the same `VillageMovement.clear` / `canWalkTo` rules as the player, including the bridge, larger pond and ramped feeding dock. Smoothed A* paths replan as the player moves; dismissal routes each resident back to its nearest authored waypoint. Roaming encounters are suspended for companions. Direct activity travel carries companions to authored positions; leaving restores them to clear outdoor ground. Invitations are per visit, with no costs or obligations.

E interacts with nearby vegetable beds, flowers, mint, tea or duck feeding; B asks nearby Maple for his reusable pouch. Menus/simple view expose the same actions. After planting and one watering, radishes grow over 2 minutes, mint over 3 and carrots over 5. Wall-clock watering timestamps survive reloads; ripe plants never expire. Mint uses the same full cycle in its own bed. Luma accepts each harvest at tea, gives a compliment and animated thanks, and exchanges mint for a saved cup with an explicit drink action. Reduced motion disables plant sway, jumps and decorative particles. Tea stages the player on the garden-facing bench and Luma by the table regardless of companion selection. A four-second entry pan stops when the user drags; reduced motion uses the final view immediately. All seven places retain a visible exit. See [the growth and tea checks](../../VILLAGE_BUILD.md#2026-09-27-gentle-growth-and-lumas-tea) and [initial feature checks and UI evidence](../../VILLAGE_BUILD.md#2026-09-27-garden-pond-and-companions).

## 2026-09-26 unlimited dashing

The user removed energy from the product. The controller no longer tracks stamina, exhaustion, draining, recovery or cooldowns; the energy meter and its English/Japanese labels/styles are removed. Holding dash keeps the existing 6 m/s speed continuously. Normal glide, quick glide, jumping and collision behavior are unchanged. Earlier energy requirements are superseded.

## 2026-09-26 neighbourhood roaming

`life.ts` now gives every resident a multi-point circuit across a wider area: cottage/entrance (Pip), bridge/pond approach/cottages (Maple), northern lane/riverside verge (Moss), and tea garden/centre/garden perimeter (Luma). Intermediate waypoints guide continuous movement, with two 4.5-second rests per circuit. Luma is no longer stationary. Existing proximity approach, personal space, conversation and return rules are preserved. The new loaded-world checks cover every route segment and four-minute circulation at 30/60/120 FPS; see [the local milestone](../../VILLAGE_BUILD.md#2026-09-26-roaming-and-clear-streets). The road-side hearth bench now sits north of the same shared hearth anchor; the original southern activity seat remains.

## 2026-09-26 mouse camera controls

Ground clicks and taps no longer move the spirit; the destination ring and automatic target movement are removed. Click the canvas once to capture a desktop mouse, then move it to look without holding a button. Escape releases the cursor and clears held movement. Menus, window blur, hiding the page, WebGL interruption and disposal release capture; activities retain it. Closing a menu leaves the cursor free until another click; keyboard activity entry and controls preserve capture, while Esc also releases it. Pending capture requests are canceled logically so they cannot grab the cursor after a menu opens.

The browser requires a user gesture for capture; merely hovering the canvas cannot acquire pointer lock. A rejected or unavailable capture uses drag-to-look with an explanatory hint. Touch retains drag-to-look and directional buttons, with no tap-to-move. The English/Japanese Controls guide and canvas description reflect these controls. This section supersedes historical click-to-glide and mouse-drag descriptions below. Verify with `scripts/village/tests/camera.cjs` against the local QA harness; see the latest build-ledger entry for evidence.

## 2026-09-26 player update

The player is now a floating white spirit. The existing speeds, bridge/deck collision, water boundaries, jumping and direct travel are preserved. UI language describes gliding and dashing. Hover, directional lean, retained movement heading while idle, fin flutter and landing squash are runtime transforms; no humanoid clips are required. Residents now reuse the spirit form with pastel materials and original accessories. Their wider authored routes preserve proximity visits, collisions, personal space and conversation timing. Player footstep audio is suppressed; takeoff/landing events remain. This is ground-constrained hovering, not unrestricted vertical flight. Reduced motion disables decorative bob, roll, lean and fin flutter for player and residents. Desktop mouse capture and touch dragging control the camera; ground clicks/taps have no movement target.


## Activity staging and exit contract

`activityScene.ts` defines `ACTIVITY_STAGES` for all six places, pairing the spirit's position/heading with camera and look-target coordinates. `ActivityMoment` in `environment.ts` carries focus progress, music state, breathing phase, mood, writing and postbox events from `Activities.tsx` through `Village.tsx` to `VillageEngine.setActivityMoment`. Props react without replacing DOM controls or local persistence. Portrait cameras leave the actor above the bottom sheet; hiding controls keeps the activity mounted. Reduced motion freezes decorative animation.

An activity's authored pose is temporary: exiting restores the prior movement heading, clear arrival position, walking camera and canvas focus. Do not reintroduce camera-facing idle rotation. [Current staging/reduced-motion checks](evidence/living-living-checks.json) and [all six exit checks](evidence/living-activity-exits.json) pass; the [published-release smoke check](../../VILLAGE_BUILD.md#2026-09-26-main-release) also verifies the tea-garden exit and subsequent Luma conversation.

## Implemented contracts

Shared movement carries actual world-space Y with X/Z and heading, and sends updates when height alone changes. Remote spirits interpolate that height through takeoff and landing; legacy clients without Y keep the ground/bench inference. The Worker validates and bounds height and preserves it for arriving visitors. Three stationary jumps were visible between two local clients; [jump evidence and publication limits](../../VILLAGE_BUILD.md#2026-09-30-shared-jump-height-local) record the checks. [The published release](../../VILLAGE_BUILD.md#2026-09-30-shared-interaction-release-published) includes the matching Worker and client; jump-specific live checks were not repeated.

`environment.ts` is the shared source of truth. `WorldContact` contains `kind` (footstep/takeoff/landing), position, surface, achieved speed, impact and foot. `MovementStatus` contains gait and run-toggle state; the shell receives changes at most 10 Hz. `EnvironmentFrame` carries listener position, camera-forward vector, gust strength, weather and shelter at about 12.5 Hz. The listener follows the traveler outdoors and the settled look target in an activity; simple view explicitly sets the destination's sound position.

`VillageMovement` runs at 120 Hz with at most 100 ms catch-up. The starting tuning values below are now implemented. It resolves a radius-0.32 m, height-1.8 m proxy against authored boxes, respects water/parapets, handles bridge height from the shared `BRIDGE` definition, low-prop tops and overhead boxes. Stone bridges use continuous oriented rails and tangent sliding, with a 1.6 m cubic-sine arch and flatter approaches; their saved vertical scale applies to the rise. Rendered rail boxes remain for camera/navigation bounds and do not duplicate walking collision. This is a small authored-world controller, not general rigid-body physics. It emits foot contacts at gait phase 0/0.5 based on achieved travel. `VillageEngine` presents those controller states through spirit hover, lean and jump/landing squash; no humanoid animation mixer is used. [Water/bridge checks](../../VILLAGE_BUILD.md#2026-10-07--animated-water-and-smoother-arched-bridges-local).

The archived, no-longer-loaded candidate `traveller.glb` is skinned with 21 bones and clips `Idle`, `Walk`, `Run`, `Sprint`, `JumpStart`, `AirLoop`, `LandSoft`, `LandMoving`. Original editable source and export script are linked in the handoff. In-place strides are 1.65/2.8/3.5 m for walk/run/sprint. These humanoid clips and anatomy are historical, superseded by the current spirit direction.

Shared gusts now affect grass, bushes, tree canopies, willow leaves, water normals and wind gain. Foliage shadow shaders share the deformation; shadow refresh is bounded. Reduced motion disables secondary wind motion. No physical cloth solver, full acoustic occlusion, device acceptance or finished-art claim.

The runtime groups meadow grass and the distant forest into spatial render cells so cells outside the camera view can be skipped. The editor retains its existing placeable assets. Fixed-view local captures match pixel for pixel; the extra draw calls and target-device performance remain open for measurement. See [the build ledger](../../VILLAGE_BUILD.md#2026-09-29-spatial-vegetation-culling-local).

Keyboard: WASD/arrows, G toggle quick glide, Shift hold dash, Space jump, R recover to safe ground, E interact with a place, F chat with a nearby visible villager. Touch has explicit quick-glide/dash/jump/Unstuck buttons alongside the direction pad and a Chat button on speech bubbles. Input clears on blur, canceled/lost pointers, dialogs and travel. See the evidence ledger for contract tests and recordings; the acceptance list at the bottom remains open.

The subsequent activity-exit fix gives all six activities a visible **Back to village** button on desktop and mobile. Button, wordmark and Escape share the exit path, restore the walking camera and return keyboard focus. Pond and writing-nook arrivals moved to clear ground at `(−19, −7)` and `(−19.5, 8)`. The existing [activity-exit evidence](evidence/activity-exits.json) records four-direction movement after every exit, input clearing, grounded state and restored camera distance; browser/device limits are recorded in the [build ledger](../../VILLAGE_BUILD.md#2026-09-25-activity-exit-fix).

## Camera, bridge and ambient life: feedback fixes

- `VillageEngine.ts`: drag pitch spans −0.85 to 1.35 radians; wheel distance spans 2.2–12 m. The spherical orbit lifts its target when looking up and clamps the camera above the shared terrain floor. Upward and overhead captures verify the expanded range; exhaustive roof/wall occlusion and physical-touch comfort remain open.
- `environment.ts` / `bridge.ts`: `BRIDGE` defines a 12 m crossing with 3.3 m clear width at `z = 3`. The deck height is `0.08 + sin(πt)² × 1.1`, where `t` runs from 0 to 1 across the span. Solid masonry sits beneath upward-facing paving; the north parapet has a bank-side opening at its east end and the other rails and end posts have matching collision boxes. Approaches connect both banks, with no flat path beneath the water crossing and no planting through the deck.
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


## Watchtower lookout — 2026-10-05 local

At the watchtower door, E or Go up to the lookout requests shared gallery admission. Only an accepted reply moves the visitor upstairs. The first-person camera follows the visitor at 1.35 m eye height. WASD/arrows walk and strafe relative to the horizontal camera heading; Shift walks faster. Mouse look keeps unrestricted yaw, steep downward/upward pitch, pointer-lock/drag fallback and personal sensitivity. Home/End turn and Page Up/Page Down tilt for keyboard-only look, leaving inventory/menu shortcuts available. Movement clamps to a 3.05 m circle inside the railings; the Worker applies the same bound and floor height to shared poses and sends corrections to the mover. Eight admission claims remain shared; they are no longer fixed standing positions. Esc, E, R or Come down returns to the door, and disconnect/revoked claims restore outdoor walking. Editor tower position/height/rotation remain the source for the gallery bounds and entry points. [Local checks and remaining limits](../../VILLAGE_BUILD.md#2026-10-05--walking-in-the-watchtower-local).

Other visitors see normal coloured spirits on the gallery while each occupant uses a first-person camera. Admission changes snap the observed spirit to its accepted floor/door position; ordinary walking remains smoothed. Initial welcome snapshots carry current XYZ and gallery claims, so late joiners receive the same tower occupancy. Eight claims limit admission, rather than assigning permanent standing positions. Body collision between visitors is not enabled, and crowded names can overlap. The existing 2D map shows horizontal position without indicating gallery height. [Multiplayer review](evidence/tower-lookout-20261005/README.md).
