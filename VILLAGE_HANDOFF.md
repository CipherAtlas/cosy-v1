# Cosy Village — canonical handoff

Updated: 2026-09-26. **Status: controls/layout/dialogue release published; full art, movement, listening and device acceptance remain open.** Implementation history is in [VILLAGE_BUILD.md](VILLAGE_BUILD.md); current contracts below supersede earlier milestone descriptions.

Published application: [`738e408`](https://github.com/CipherAtlas/cosy-v1/commit/738e4085de1c88a3fbe5f1d26ef48f0b5b68f57b) through successful [Pages run 36245251354](https://github.com/CipherAtlas/cosy-v1/actions/runs/36245251354). Includes wider resident circuits, three timber fingerposts, clear hearth seating, adjusted tea-garden seating, unlimited dashing without an energy bar, desktop mouse-look, and restyled dialogue. Local and live verification are recorded in [the release ledger](VILLAGE_BUILD.md#2026-09-26-village-controls-and-layout-release).

Current movement: WASD/arrows glide, R toggles quick glide, Shift dashes continuously, and Space jumps. Click the desktop canvas to capture the mouse; Escape, menus, activities, blur and disposal release it. Touch retains dragging and direction buttons. Ground clicks/taps do not move the player. No stamina, exhaustion, recovery or energy UI remains. Preserve the [movement/input contracts](docs/village/MOVEMENT_AND_WORLD.md).

Current village: all four residents roam wider multi-point circuits, including Luma leaving the tea garden. Three bilingual timber fingerposts replace the older nine-sign layout. The hearth's road-facing east side is open; full sign/bench footprints are verified outside the streets. Dialogue retains both languages and the existing personalities with dark green panels, cream serif text and visible keyboard hints.

The prior performance release caps drawing-buffer pixels at 1080p/720p/540p by tier, preserves automatic downgrades and adds an opt-in performance report. Read [the investigation](VILLAGE_BUILD.md#2026-09-26-performance-investigation) before renderer changes. The friend's Windows GPU path, native-current Safari/Firefox performance and physical-device acceptance remain unverified.

## Current art direction — 2026-09-26

The user has superseded the earlier realistic traveler brief: use **Arkenfall atmosphere plus a strongly Genshin-inspired, colorful stylized palette**, with **a cute floating white spirit and a cartoon smile** as the player. Keep all artwork original. The approved village image still guides composition, scale and environmental craft, but its muted palette and human player are no longer requirements. Preserve the named villagers and their conversations.

The latest user update extends the fantasy direction to houses, distant scenery and all four residents. The cottages now have swept colorful roofs, arched glazing, turrets, shutters and flower boxes. Original painted surfaces replace the photographic house/path materials. Rounded opaque tree crowns and vertex-painted mountain layers replace distant birch cards and repeated stone texture; two suspended gardens add fantasy landmarks. Pip, Maple, Moss and Luma reuse the spirit mesh with pastel colors, distinct accessories and hovering animation. The human traveler and birch remain archived assets and are no longer loaded by the village. Preserve the controller, six activities, weather, resident encounters and Controls guide. Current evidence is in the newest build/QA milestone.

The earlier polish removed the player’s automatic idle turn toward the camera and softened shadows. Its nine-sign layout is superseded by the current three timber fingerposts. Music now uses four complete licensed recordings selected by location/scenery; stream, fire and rain are recordings too. The prior art state was committed/pushed first at `7642527`; the following polish is bundled with the water/activity release. Read [the current milestone](VILLAGE_BUILD.md#2026-09-26-orientation-shadows-wayfinding-and-recorded-soundtrack) and [recorded audio specification](docs/village/MUSIC_AND_SOUND.md) before changing these systems.

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
| Latest user requirements | Natural flowing water and lively fireplaces; visible, animated activities that belong in the world; warmer, clearer UI; recorded music matched to scenery and location; player retains heading when idle; smooth shadows; three restrained roadside fingerposts; clear roads and hearth seating; wider NPC roaming; jumping; unlimited gliding/dashing without energy; desktop mouse-look; wind and world sound; richer art/light; useful vertical camera range, clouds and distant scenery, residents/birds, working Firefox sound, sensible hearth seating and a traversable bridge; MMO-style overhead dialogue, distinct cute personalities and nearby villagers approaching to greet the player. |
| [Approved village image](docs/village/references/approved-village.png) | Composition and craft reference: detailed cottages, stream/bridge, planting, mountains and restrained UI. The latest colorful stylized palette and white spirit replace its palette/player brief. |
| Original Cosy v1, preserved in [baseline captures](docs/village/references/README.md) | **Only functional baseline.** The [live Pages URL](https://cipheratlas.github.io/cosy-v1/) now tracks the village on `main`. Ignore earlier local redesign experiments as product/design references. The six activities remain the product. |
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

The root page uses raw Three.js inside the existing accessible React shell. The six activities, storage keys, direct travel and simple view remain intact. Current implementation:

| Area | Implemented now | Still required |
| --- | --- | --- |
| Movement | 120 Hz fixed simulation; walk/run/sprint; acceleration; jump/air/landing; buffered jump; unlimited dashing; desktop mouse-look; keyboard and touch controls | Motion polish, exhaustive collision/camera checks and physical-touch proof. |
| Ambient life | Four named residents on wider multi-point circuits who approach nearby players, with overhead dialogue, click/F chat and weather remarks; twelve animated birds | Richer expressions and behavior; all four now use decorated pastel spirit forms. |
| Player / residents | Original white spirit plus four pastel blob residents; hover, lean, fin flutter and character accessories; reproducible base Blender source | More expressive faces and motion refinement; no free vertical flight. |
| Scene | Colorful swept-roof cottages, painted materials, stone bridge, rounded tree crowns, mountain layers/floating gardens, three roadside timber fingerposts, flowing water and layered indoor/outdoor fire | More authored variation, terrain/material blending and composition refinement. |
| Activities / UI | Visible spirit at all six stations; state-driven hourglass, breathing rings, tea, quill and letters; warm paper panels, portrait bottom sheet, Enjoy the view toggle | Further environmental craft and physical-touch/long-session usability review. |
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
