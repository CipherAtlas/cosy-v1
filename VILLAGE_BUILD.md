# Cosy Village — implementation and evidence ledger

Updated: 2026-09-26. Read [VILLAGE_HANDOFF.md](VILLAGE_HANDOFF.md) for the canonical direction and future work. This file records implementation evidence and limits. The latest section below supersedes historical prototype descriptions; older results are retained under their original headings.

## 2026-09-26 main release

The user authorized committing, pushing to `main` and deploying the combined polish and inhabited-activity passes. This release includes all source, licensed recordings, credits and verification evidence from the two sections below. Publication uses the unchanged [GitHub Pages workflow](https://github.com/CipherAtlas/cosy-v1/actions/workflows/deploy-pages.yml); the live destination is [Cosy Village](https://cipheratlas.github.io/cosy-v1/). The release task records the exact commit, workflow result and live browser verification. Earlier statements that work was local/uncommitted describe the original implementation boundary.

## 2026-09-26 water, fire and inhabited activities

This local pass builds on the preceding uncommitted polish. No new commit, push or deployment was requested or performed.

- `water.ts` replaces repeated sine highlights with advected world-space noise, small intersecting waves, corrected view-space ripple normals, depth colors and sparse edge foam. River and pond use different flow speeds and subdivided surfaces. Water is opaque to prevent transparent river triangles from cutting through the fire. This is stylized surface shading, not fluid simulation or screen-space reflections.
- `flame.ts` uses seven curved flame ribbons with moving silhouettes, soft tips, warm cores, drifting embers and subtle smoke. Indoor and outdoor fires share it; charred logs, scattered indoor coals and gently varying lights replace the flat indoor ember block.
- `activityScene.ts` keeps the spirit visible at six authored stations. The focus hourglass follows timer progress; music adds a small sway and drifting lights; breathing drives eased pond rings and a gentle spirit expansion; mood selection lifts the tea; typing moves a quill and saving lifts a page; postbox notes unfold and react to Keep. The engine restores the prior movement heading and physical arrival position on exit. Reduced motion freezes decorative movement. Static desk/book/hourglass furniture is merged by material while animated parts retain their own transforms.
- React activity state reaches the scene through `ActivityMoment`. Timers, local notes, existing storage keys, direct travel, recorded audio activation, English/Japanese and simple mode remain. Cream paper panels, green actions, icon cards, progressive mixer/settings controls, a breathing countdown and the Enjoy the view toggle replace the former overlay presentation. Desktop cameras leave room beside the panel; portrait framing keeps the spirit above a scrollable bottom sheet. Simple view centers the activity without a canvas.

Verification: production export and TypeScript checks pass with only the existing workspace-root, Browserslist and unrelated RoomScene image warnings. Ten controller/archived-composition checks, three bridge checks, [six activity exits](docs/village/evidence/living-activity-exits.json), [20 resident checks](docs/village/evidence/living-villager-approach.json) and [28 dialogue checks](docs/village/evidence/living-villager-dialogue.json) pass. [Scene checks](docs/village/evidence/living-living-checks.json) confirm all six visible spirit positions, reduced motion, restored exit framing and no captured renderer errors.

Inspected the production export in native Firefox (arrival, cottage, timer start/pause/reset), and Chromium at desktop and 390×844 (breathing, tea, notes/save, postbox Keep, music, panel hiding, Japanese and simple mode). Note writes used a separate local origin, not the user's Firefox storage. Phone framing and sign occlusion were corrected after inspection. [21-second motion evidence](docs/village/evidence/living-activity-motion.webm) shows all six stages without DOM overlays or audio; it is a renderer capture, not a user-input recording. See [the evidence index](docs/village/evidence/README.md) for stills and performance results.

Final [two-minute traversal sample](docs/village/evidence/living-profile.json): 120.03 seconds, 8,999 frames, mean 13.34 ms (75.0 fps), p95 20.4 ms, 1280×720 detailed quality at DPR 1. Endpoint: 222 draws, 141 geometries. The [pre-batching sample](docs/village/evidence/living-profile-before-batching.json) averaged 15.05 ms with 236 endpoint draws. Both runs used a single active village renderer after the build completed; this is a local comparison, not a physical-device or sustained thermal guarantee.

The rebuilt static export is served at `http://127.0.0.1:3020/` and reopened in Firefox at the hearth. Temporary QA servers/tabs are closed. Reproduce scene evidence with `python3 scripts/village/preview_qa.py --port 3024 --evidence-prefix living-`, then Load village, Review living activities, Record water fire and activities, and the regression/profile buttons. Physical touch/thermal testing, long-session listening and complete AAA art acceptance remain open.

## 2026-09-26 orientation, shadows, wayfinding and recorded soundtrack

The existing art work was committed and pushed **before new edits**, as requested: [`7642527`](https://github.com/CipherAtlas/cosy-v1/commit/764252724fc26c5036fc02d483a5fac998a95b4d) on `main`. The subpath build passed before the push. The existing Pages workflow initially failed in the Google-font download loader; retrying the same failed run succeeded without configuration changes. [Successful workflow](https://github.com/CipherAtlas/cosy-v1/actions/runs/36230332415). Verified the deployed checkpoint's arrival, loaded scene, tea-garden exit and Luma chat. The following polish work is local and has not been committed or deployed.

### Delivered

- `VillageEngine.ts` removes the player’s idle turn toward the camera. The spirit starts facing into the village and retains its last movement heading when stopped; residents keep their separate greeting behavior.
- `shadows.ts` replaces Three r186's randomized five-sample directional PCF with a fixed weighted 16-sample filter while preserving material shader hooks. Detailed shadows update each frame; low quality caps updates at roughly 30 Hz. The shadow anchor moves at texel scale instead of two-meter jumps.
- `wayfinding.ts` adds nine physical posts: an arrival directory, two junction posts and six destination labels. Warm wood, pale painted panels, colored arrows and gold finials fit the village. Labels share English/Japanese place names; reverse-side arrows change direction. Shared furniture is batched by material, reducing the inspected scene from 251 to 173 draw calls. Labels remain separate for translation. Directory/cottage placement was adjusted after visual inspection to avoid lamp/wall occlusion and return-camera collisions.
- `soundtrack.ts` and `audio.ts` replace the generated score with four full, locally hosted Holizna recordings (13.4 minutes total). Location/scenery selects the music with boundary hysteresis and four-second crossfades. Manual choices remain available in Sound and at the hearth. Two streaming decks bound music memory; failed changes keep the previous recording playing. Rain, river and fire now use recordings too. Wind, sparse birds and responsive interaction effects remain synthesized; hovering still suppresses footsteps.
- New recordings are credited in the shipped `CREDITS.txt` and [provenance manifest](public/village/audio/recordings.json); all seven sizes/hashes were verified. The four music pieces are CC0; stream ambience is CC BY 3.0 and rain/fire are CC0. Source details and current audio behavior are in [the revised specification](docs/village/MUSIC_AND_SOUND.md). Earlier composition code and piano samples remain archived and are no longer imported/loaded by the village runtime.

### Verification

- Production build and TypeScript passed, with only the existing workspace-root, Browserslist and unrelated room-image warnings. Ten existing controller/composition checks and three bridge checks pass; the composition assertion describes archived code, not the new runtime soundtrack.
- [Orientation/wayfinding inspection](docs/village/evidence/polish-polish-checks.json) passes with nine posts and no captured renderer errors. Inspected [entrance](docs/village/evidence/polish-entrance.png), [directory](docs/village/evidence/polish-arrival-directory.png), [Japanese directory](docs/village/evidence/polish-arrival-directory-ja.png), [junction](docs/village/evidence/polish-junction-post.png), [cottage post](docs/village/evidence/polish-cottage-post.png) and [shadow edges](docs/village/evidence/polish-soft-shadows.png).
- [All six activity exits](docs/village/evidence/polish-activity-exits.json) retain four-direction movement and a 3.8 m camera distance. The test now rejects unexpected camera compression at these fixed exit points. [20 resident approach checks](docs/village/evidence/polish-villager-approach.json) and [28 dialogue checks](docs/village/evidence/polish-villager-dialogue.json) pass.
- [28 recorded-audio lifecycle checks](docs/village/evidence/polish-audio-lifecycle.json) pass in Chromium 153: nature decode, master-zero start, streaming playhead progress, non-silent output, each context, at most two decks, old-deck pause, manual override, failed-track preservation/reporting, music/master mute and resume, world-only unmute, listener reset, effect cap, stop/suspend and partial nature failure. The missing-track 404 is intentional test injection. Peak master sample: 0.06736.
- [56-second soundscape capture](docs/village/evidence/polish-soundscape.webm) visits village, water, hearth and cottage contexts. Captured from the master bus before the output compressor: −26.7 LUFS integrated, −12.1 dBTP maximum, 4.1 LU loudness range via FFmpeg `ebur128`. These measurements establish signal/headroom, not subjective speaker/headphone quality.
- [Final two-minute traversal profile](docs/village/evidence/polish-profile.json): local Chromium 153, high tier, 1280×720, DPR 1; 10,324 frames, mean 11.63 ms (86 fps), p95 17.1 ms. Endpoint: 182 calls, 2.18M triangles, 94 geometries, 32 textures. The [first sample](docs/village/evidence/polish-profile-before-batching.json) averaged 19.12 ms before batching and while another village tab was rendering. That second tab was closed for the final run, so the frame-rate change cannot be attributed to batching alone. Neither run is a physical-phone, thermal, 1080p or sustained 60 fps guarantee.
- Production Sound controls were inspected at desktop and 390×844: recorded playback starts, the manual waterside choice is selectable, automatic selection can be restored and stop works. Japanese labels were checked; English, automatic selection, sound off and the normal viewport were restored. The final rebuilt production scene loaded with no captured console warnings/errors. Physical-touch, Firefox streaming and long-session listening remain unverified.

Reproduce with `python3 scripts/village/preview_qa.py --port 3024 --evidence-prefix polish-`, then the named navigation, exit, dialogue, lifecycle, recording and profile buttons. The temporary QA server was stopped after verification. The rebuilt local production preview uses `http://127.0.0.1:3020/`. This pass changes no dependencies, deployment configuration, storage schema or authentication.

## 2026-09-26 fantasy cottages, distant scenery and blob residents

The user extended the colorful spirit direction to houses, far-away materials and NPCs. This is a local art implementation, preserving the previous uncommitted work. No dependencies, storage, deployment configuration or Git history changed.

### Delivered

- `architecture.ts`: an original cottage kit with curved teal/coral/lilac shingle roofs, warm trim, limestone door arches, reflective arched glazing, painted shutters, flower boxes and turret/chimney variants. All nine houses retain their prior placement and collision footprint. The village tower uses the same roof/trim vocabulary.
- `paintedTextures.ts`: seven deterministic 512×512 painted surface maps for wood, roof, plaster, stone, meadow, path and window reflections. House/path photography and their high-frequency normal maps are no longer fetched. Existing cottage furniture inherits the painted wood/stone palette.
- `fantasyTrees.ts` / `world.ts`: solid rounded crowns in matching near/far forms replace birch photography/cards. There are 360 distant trees; canopy self-shadow artifacts are avoided with baked vertex shading while the crowns still cast ground shadows. Willows have fuller crowns and independent bark materials. Mountain colors depend on slope, and meadow variation uses organic patches instead of repeating stripes. Two suspended gardens are distant scenery beyond the playable boundary.
- `life.ts` / `VillageEngine.ts`: residents clone the original spirit mesh with independent pastel materials and accessories. Pip is sky blue with a scarf and pouch; Maple is peach with a baker hat and bow; Moss is mint with a sprout; Luma is lavender with a crescent and star collar. They hover, lean and flutter their fins, respecting reduced motion. The human model/mixers are no longer loaded. Routes, encounter states, colliders, personal space and dialogue remain; Pip's sock remark was adjusted for his new form.
- Sources and credits for the earlier models/textures are retained. This pass adds no external assets or paid generation. The base spirit remains the original Blender asset from the preceding milestone.

### Verification

- Production build, TypeScript and whitespace checks passed; only the existing workspace-root, Browserslist and unrelated `RoomScene` image warnings remain.
- Ten controller/composition checks and three bridge geometry/traversal checks passed. The resident fixture was updated for the new constructor without changing its behavioral assertions.
- [20 approach checks](docs/village/evidence/fantasy-villager-approach.json), [28 dialogue checks](docs/village/evidence/fantasy-villager-dialogue.json) and [all six activity exits](docs/village/evidence/fantasy-activity-exits.json) passed with the updated world.
- [Art inspection](docs/village/evidence/fantasy-fantasy-checks.json) and [weather inspection](docs/village/evidence/fantasy-art-checks.json) report no captured renderer/console errors. Inspected the [entrance](docs/village/evidence/fantasy-entrance.png), [cottage](docs/village/evidence/fantasy-cottage-exterior.png), [valley](docs/village/evidence/fantasy-valley-wide.png), [floating garden](docs/village/evidence/fantasy-distant-gardens.png), [four resident portraits](docs/village/evidence/README.md) and [spirit family](docs/village/evidence/fantasy-spirit-villagers.png). Family positioning is an explicit QA pose; ordinary residents retain their original routes.
- [Movement recording](docs/village/evidence/fantasy-motion.webm) and [checks](docs/village/evidence/fantasy-movement-checks.json) pass: walk/run/sprint/air/idle reporting, two takeoffs/two landings, energy down to 46, and no footstep events for the hovering spirit.
- [Two-minute profile](docs/village/evidence/fantasy-profile.json): local Chromium 153, detailed quality, DPR 1, 1280×720 drawing buffer; 14,402 frames, mean 8.33 ms (120 fps), p95 9.30 ms. Endpoint: 92 calls, 1.62M triangles, 86 geometries and 12 textures. This preceded the tea-garden return-camera adjustment; it is not a controlled before/after, 1080p, physical-phone or thermal benchmark.
- The final production export at `http://127.0.0.1:3020/` was inspected on desktop and at 390×844. Arrival, Places, tea-garden return and explicit Luma chat worked; both spirit faces, speech, activity prompt and movement controls are visible. Activity exits now use clear default camera angles, with a slight side view toward Luma at the tea garden. All six exit and 28 dialogue checks were repeated after that adjustment. No captured production warning/error logs; the temporary viewport override was reset. Responsive browser inspection does not establish physical touch/device acceptance.

The exported preview remains on port 3020; the temporary QA server was stopped after verification. Nothing from this art pass was committed, pushed or deployed.

Reproduce with `python3 scripts/village/preview_qa.py --port 3024 --evidence-prefix fantasy-`, then **Load village**, **Review art pass**, **Review fantasy village**, and the named regression/profile buttons. Captures are 1280×720 renderer views without DOM overlays. Physical phone/thermal acceptance, a continuous long-session listening review and full AAA art acceptance remain open.

## 2026-09-26 colorful art pass and spirit player

Latest user direction supersedes the older realistic player brief: **Arkenfall atmosphere, vivid Genshin-inspired colors, and a cute white floating blob with a smile**. This is a local implementation; nothing was committed, pushed or deployed.

### Delivered

- Original white spirit with an integrated cartoon face, peach cheeks and small fins. It hovers, tilts while gliding, turns to face the camera after idling, and squashes on landing. Existing walking/run/sprint controller states now present as glide/quick glide/dash; collision, stamina, jumping and direct travel remain unchanged. Human residents retain their rig, personality, dialogue and approach behavior.
- Blender 5.2.1 editable source at `assets/village/spirit.blend`, repeatable `scripts/village/create_spirit.py`, runtime GLB and [measured manifest](docs/village/spirit-manifest.json). 437,768 bytes, 22,464 triangles, three materials, zero texture images. SHA-256 verified against the manifest. Blender MCP was disconnected; an isolated background process generated the asset.
- Clear blue sky, green meadow and foliage, turquoise water, blue-slate/terracotta roofs and cream plaster. Rain coordinates material wetness, sky, sun, fill, haze and water; dusk strengthens practical windows against cooler shadows. Lighting changes interpolate instead of switching instantly.
- Moss/soil path shoulders, PBR path relief, curved grass clumps, smaller shrub leaves, colorful flowers, cottage attic glazing/window boxes/corner masonry and surface variation. The focus room has warmer oak, a terracotta rug and softer window emission.
- The sun/shadow coverage follows the player; nearby trees use detailed geometry and trees beyond 32 m (22 m on low) use the existing shared crossed-card rendering. This is a discrete LOD with visible transition risk, not a complete production LOD pipeline.
- Condensed exploration hints, a Controls guide on desktop and in Settings, glide/dash labels and a visible click destination ring. A click remains straight-line travel; it does not navigate around obstacles.

### Verification

- `npm run typecheck` and `npm run build` passed. Existing workspace-root, Browserslist and unrelated `RoomScene` image warnings remain.
- Ten controller/composition checks and three bridge checks passed against compiled current modules.
- [20 resident approach checks](docs/village/evidence/art-villager-approach.json), [28 dialogue checks](docs/village/evidence/art-villager-dialogue.json), and [all six activity exits](docs/village/evidence/art-activity-exits.json) passed in Chromium 153.
- [Spirit movement checks](docs/village/evidence/art-movement-checks.json) passed: walk/run/sprint/air/idle states reported, energy fell from 100 to 46, two takeoffs/two landings, zero footstep events. The first recording exposed a lost HUD status callback during the player replacement; that callback was restored before the passing recording.
- [Two-minute performance sample](docs/village/evidence/art-profile.json): Apple M4, Mac16,12, 16 GB memory; Chromium 153, high tier, DPR 1, 1280×720 drawing buffer. Mean 8.44 ms (118.5 fps), p95 9.30 ms; sample endpoint reports 84 calls and 1.91M triangles. This preceded the final path-junction UV/mask correction; the renderer/LOD settings are unchanged. It is not a 1080p, physical-phone or thermal result, and is not a controlled before/after benchmark against the historical 45 fps sample.
- [Final art inspection](docs/village/evidence/art-art-checks.json) recorded no renderer/console errors. An earlier reserved GLSL identifier broke the meadow shader; it was fixed and the final terrain captures were checked again. Historical screenshots were preserved; `art-` files contain this pass.
- Production export inspected at 1280×800 and 390×844: arrival, Controls guide, Settings access, English/Japanese guide layout, direct cottage entry and return all worked. The phone check exposed an activity prompt covering Dash/Jump; its position and the energy meter were moved above the movement controls, rebuilt and visually checked again. Dash and Jump each measure 66×46 pixels and remain unobstructed near the cottage. No captured production console warnings/errors. This is responsive browser coverage, not physical touch testing. English was restored and the temporary viewport override removed.
- [Entrance](docs/village/evidence/art-entrance.png), [spirit face](docs/village/evidence/art-spirit-front.png), [spirit back](docs/village/evidence/art-spirit-back.png), [cottage exterior](docs/village/evidence/art-cottage-exterior.png), [interior](docs/village/evidence/art-cottage.png), [bridge](docs/village/evidence/art-bridge.png), [bridge profile](docs/village/evidence/art-bridge-side.png), [hearth](docs/village/evidence/art-hearth.png), [rain](docs/village/evidence/art-rain.png), [dusk](docs/village/evidence/art-dusk.png), and [movement with production audio](docs/village/evidence/art-motion.webm). Renderer-only captures use a 1280×720 drawing buffer.

Reproduce the captures/checks with `python3 scripts/village/preview_qa.py --port 3023 --evidence-prefix art-`, then **Load village**, **Review art pass**, **Record movement**, and the named regression buttons. The evidence prefix preserves earlier milestone files.

The final exported app is available locally at `http://127.0.0.1:3020/`, served from `out`. The temporary renderer QA server was stopped after verification. Check listener ownership before reusing either port in a later task.

### Limits

This delivers the revised palette and spirit direction; it does not certify AAA fidelity. Architecture, near planting and the interior remain procedural and need further authored art to reach that bar. No baked GI, general texture compression, physical phone/thermal validation, or new long-session listening certification was added. Hovering follows the existing terrain/bridge controller; there is no free vertical flight. Local build/test success is not deployment proof.

## 2026-09-26 release preparation

The user authorized updating the relevant docs, committing/pushing the integrated village to `main`, and deploying it to GitHub Pages. This includes the previously uncommitted village foundation, runtime assets, editable source and QA evidence alongside the new resident interactions. The README, handoff, movement spec, design QA and evidence/reference indexes now describe the four personalities, speech/chat controls, proximity visits and current release process. Original Cosy v1 baseline captures remain historical references as the live URL advances to the village.

Pre-push verification: `npm run typecheck`, `NEXT_PUBLIC_BASE_PATH=/cosy-v1 npm run build`, ten controller/composition checks and three bridge checks passed. The first subpath build hit a Google-font loader error; inspecting the current font responses and retrying the unchanged build succeeded. No font, dependency or workflow change was needed. The NPC milestone retains 20 passing approach checks, 28 passing dialogue checks and the integrated approach/greet/return observation linked below. Documentation file links and heading anchors were checked. Existing workspace-root, Browserslist, legacy image and CommonJS test warnings remain.

The existing [Pages workflow](https://github.com/CipherAtlas/cosy-v1/actions/workflows/deploy-pages.yml) installs the lockfile, builds for `/cosy-v1`, uploads `out` and deploys on a `main` push. Its run for the pushed commit and the [live site](https://cipheratlas.github.io/cosy-v1/) are the deployment evidence; local checks here are preparation evidence. See [release verification](README.md#github-pages-releases). The quality-acceptance gaps in the handoff remain open after publication.

## 2026-09-26 villager approaches

- `life.ts`: while exploring, a resident within 6 m with a clear walkable path notices the player and walks over. Only one approach/visit runs at a time. Pip is the quickest; Maple, Moss and Luma have calmer walking paces. Residents stop around 2.2–2.5 m away, face the player and greet them, then return along recorded approach points to their original routine. Luma can leave and return to her tea-garden spot.
- Encounters end when the player moves away, the route becomes blocked, an activity/menu opens, or the short visit ends. Approaches have an 8 m leash and a 10-second limit; visits last about eight seconds unless explicit chat is active. A 15-second cooldown and leaving beyond 9 m prevent repeated summons while standing nearby.
- `movement.ts` exposes `canWalkTo`, sampling the same collision footprint, bridge, water and floor rules used by walking. This is a short direct approach, not general pathfinding around buildings. `VillageEngine.ts` disables invitations during arrival, menus and activities. `dialogue.ts` waits until 2.5 m for automatic greetings so speech does not stop the approach prematurely; click/F chat still works within 4.5 m.
- Verification: TypeScript and production export passed, along with 20 resident checks at 30/60/120 fps, 28 dialogue checks and the existing 13 movement/composition/bridge checks. Browser observation and timed runtime samples show the real animated Pip approaching, stopping with a greeting and returning; physical-device and Firefox testing were not repeated for this change. See [resident checks](docs/village/evidence/villager-approach.json) and [runtime samples](docs/village/evidence/villager-approach-runtime.json).
- Reproduce with `python3 scripts/village/preview_qa.py --port 3013`: **Check villager approaches** for deterministic checks; **Load village**, then **Watch Pip approach** for the integrated observation. These controls are local QA only. No dependency, asset, storage, deployment or Git changes.

## 2026-09-25 villager dialogue

- Added MMO-style overhead speech bubbles for all four existing residents: **Pip**, an eager collector of tiny treasures; **Maple**, an affectionate baker; **Moss**, a shy, devoted gardener; and **Luma**, a dreamy tea enthusiast. Each has an approach greeting, four ambient lines, five chat lines, and rain/dusk remarks, in English and Japanese (48 authored lines per language).
- `dialogue.ts` owns the authored voices, timed speech and DOM overlay. Bubbles track the characters every frame without React renders, hide behind world colliders/offscreen, stay within horizontal margins and suppress overlapping bubbles. At most two appear together. Nearby residents pause and face the player during greetings/chat, then return to their existing routes.
- Click **Chat** or press **F** near a visible villager to advance their conversation. F also works while the chat button has focus. Explicit chat clears movement input; automatic speech does not steal focus or make live-region announcements. Controls are 44 pixels high; only requested chat is announced politely. There is no typewriter animation. Menus, activities, initial arrival and simple view suppress the overlay; disposal removes it.
- Production shell changes are limited to `Village.tsx`, `VillageEngine.ts`, `life.ts`, `village.css`, and the new `dialogue.ts`. No dependencies, storage formats, art assets, Git writes or deployment changed.
- Verification: TypeScript and production export passed; ten movement/composition checks and three bridge checks passed. The local browser suite in `scripts/village/tests/dialogue.js` passes 28 checks, including projection, wall occlusion, overlap suppression, chat cycling, translations, portrait bounds, disposal and activity transitions. Results: [villager-dialogue.json](docs/village/evidence/villager-dialogue.json). Reproduce with `python3 scripts/village/preview_qa.py --port 3013`, **Load village**, then **Check villager dialogue**.
- Browser inspection: clicked through all four residents, used F from the canvas and a focused chat button, inspected desktop and 390 × 844 portrait bubbles, and verified the normal production tea-garden exit, chat, settings suppression and Japanese dialogue. English was restored. The harness's **Meet** controls position the player for repeatable visual checks; they are local QA only. Physical touch and Firefox coverage were not rerun for this feature; this does not close the broader art/performance acceptance gates.

## 2026-09-25 activity-exit fix

- The pond arrival at `(-20, -8)` overlapped its bench collider; the writing-nook arrival at `(-20, 8)` also overlapped the cottage wall by the player radius. Moved these arrival points to clear ground at `(-19, -7)` and `(-19.5, 8)` respectively in `places.ts`.
- `VillageEngine.ts` now restores the collision-aware walking camera immediately when leaving any activity. `Village.tsx` shares one exit path for the button, wordmark and Escape, restoring keyboard focus to the canvas (or wordmark in simple view).
- Every activity has an explicit, bordered **Back to village** button. Removed the mobile rule that hid it, reserved a separate header row on small screens, and kept the 48-pixel target outside the scrolling activity content.
- Firefox: reproduced both old trapped positions using the real world colliders, then verified four-direction walking, input clearing, grounded state and a 3.8-metre camera distance after all six exits. Reproduce with `python3 scripts/village/preview_qa.py --port 3012`, **Load village**, then **Test activity exits**. Results: [activity-exits.json](docs/village/evidence/activity-exits.json).
- Rebuilt `localhost:3000` and visually checked the pond's running breathing activity and return to the normal third-person camera in Firefox. In the in-app browser, all six exit buttons worked at desktop size and 390 × 844, all six also returned correctly in simple view, and Escape returned correctly. Mobile buttons were visible, in bounds and 48 pixels tall; canvas focus returned after each 3D exit. No captured in-app browser errors/warnings. Physical-touch testing remains open.
- `npm run typecheck`, `npm run build`, ten existing movement/composition checks, three bridge checks and whitespace review passed. Existing Next workspace-root, Browserslist, legacy image and CommonJS Three.js test warnings remain. No dependencies, deployment or Git writes changed.

## 2026-09-25 user-feedback fixes

The Firefox screenshots exposed concrete problems in the integrated candidate. This pass addresses the reported camera restriction, silent audio, empty sky/distance, static population, misplaced hearth and broken bridge.

- `VillageEngine.ts`: pitch now spans −0.85 to 1.35 radians, uses a spherical orbit, lifts the look target for skyward views, and clamps the camera above the terrain. Zoom spans 2.2–12 metres. Camera collision remains active.
- `audio.ts` / `Village.tsx`: feature-detect listener AudioParams and use `setPosition`/`setOrientation` where required. The old code threw on Firefox's missing listener properties. Failed starts now stop the graph and restore the off state. [MDN's compatibility note](https://developer.mozilla.org/en-US/docs/Web/API/AudioListener) explains this browser difference.
- `atmosphere.ts`, `world.ts`: animated cloud sky with separate golden/dusk/rain treatment; 650-metre textured terrain, surrounding mountain bands and 640 distant birch instances. Their transparent four-triangle LOD is baked once from the existing licensed birch at runtime, instead of adding hundreds of full models. Sun, sky fill and haze are coordinated; the HDR now supplies indirect illumination only.
- `life.ts`: four palette-varied rigged residents, three following authored routes and one lingering in the tea garden. Residents pause at destinations and for the player. Twelve birds circle with animated wings. These are ambient inhabitants, not dialogue/quest NPCs.
- `bridge.ts`, `environment.ts`, `world.ts`: replaced the downward-facing invisible deck and flat path underneath it with a solid 12-metre masonry arch, upward-facing paving, continuous parapets, coping stones and bank abutments. Removed obstructing riverbank rocks and planting, and split the approach paths so no ground-level path crosses the water. Geometry and locomotion use one deck profile.
- `environment.ts`, `places.ts`, `world.ts`, `audio.ts`: one shared hearth position at (−5.8, −19), beside the main path. Removed the overlapping shelter/bench arrangement; three benches face the fire around a paved clearing. Fire visuals, emitter, practical light, collision, travel camera and stone footsteps use the new position.

### Verification

- The final five-second scene audit found four residents (two moving in that sample, with residents pausing at destinations or for the player), twelve birds, clear bridge planting and a clear main path past the relocated hearth.
- Firefox 156 on this Mac decoded all 14 samples and produced a non-silent master-bus signal through its legacy listener API: peak 0.04446, RMS 0.00707. [Output evidence](docs/village/evidence/audio-output.json). This proves graph output; it is not a subjective speaker/headphone review.
- Nine audio lifecycle checks pass in Firefox, including the legacy listener branch. The test now waits for the asynchronous resume state, rather than assuming it completes within 80 ms.
- Scene captures verify [upward camera range](docs/village/evidence/camera-up.png), [overhead view](docs/village/evidence/camera-down.png), [rear scenery](docs/village/evidence/camera-rear.png) and [hearth arrangement](docs/village/evidence/hearth.png). They were inspected in Firefox and refreshed in the in-app browser after the final bridge changes. Capture and profile provenance is in [the evidence index](docs/village/evidence/README.md).
- Ten controller/composition checks and three bridge-specific checks pass. Raycasts cover 147 positions over the actual rendered paving, verify upward-facing normals and deck height, and confirm the solid arched underside above the water. Movement tests cross bank-to-bank in both directions and test both parapets. Production build and TypeScript checks pass. The final 16.78-second VP9/Opus recording shows both crossings, 43 footsteps, two takeoffs and two landings.
- Final 120.03-second high-tier profile at 1280×720, DPR 1: mean frame interval 22.00 ms (about 45 fps), p95 33.4 ms; final renderer counts 145 calls, 4,552,368 triangles, 67 geometries and 65 textures. This does not meet a sustained 60 fps target. Desktop activity/background conditions were uncontrolled; physical-phone, thermal and GPU residency testing remain open. The earlier systems profile is preserved separately as `profile-systems.json`.
- Fresh production preview at `http://127.0.0.1:3000/`: village arrival and the sound on/off UI passed, with no captured console errors or warnings. Sound was left off. The temporary QA server was stopped; the existing production-preview server remains available.

The architecture, traveler and near foliage still need higher-quality authored art to match the approved reference. These fixes do not certify Arkenfall-level rendering, long-session musical quality, physical-phone performance or complete camera occlusion coverage. No dependencies, package files, Git state or deployment were changed by this feedback pass.

## 2026-09-25 integrated implementation milestone

Implemented the existing handoff, without restarting discovery. No new dependencies, package-manager changes, Git writes, deployment or paid asset generation. Existing working-tree changes were preserved.

The measurements below describe that earlier milestone. Current captures, motion and lifecycle files have been refreshed by the feedback pass above; the earlier frame profile is retained in [profile-systems.json](docs/village/evidence/profile-systems.json).

- `environment.ts` / `movement.ts`: metre-scale shared bridge, floor/surface/collider queries, 120 Hz simulation with bounded catch-up; 2.6/4.5/6 m/s walk/run/sprint; 5 m/s jump with 12 m/s² gravity; 120 ms input buffer and 100 ms coyote time; 100 energy, 18/s drain, 24/s recovery after 0.8 s, 30-point exhaustion recovery threshold. Achieved displacement drives gait and contact events.
- `VillageEngine.ts` / `Village.tsx` / CSS: R run toggle, Shift sprint, Space jump, touch buttons, native energy meter, camera/transition integration and throttled engine events. Activity controls stay in DOM. Input is cleared on blur, cancellation, dialogs and travel.
- `create_traveller_rig.py`, `assets/village/traveller.blend`, `public/village/models/traveller.glb`: original candidate skinned traveler with 21 bones, 21,288 source triangles and all eight agreed clips. Source/export metadata is in [traveller-manifest.json](docs/village/traveller-manifest.json). No third-party character was copied.
- `world.ts` / interior: roof courses, timbers/masonry, ivy, shared curved bridge deck, willows, background layers, hearth shelter/benches and cottage chair, rug, curtains, pottery and lights. Furniture is batched. Grass reduced from 90k to 30k, flowers from 1,800 to 620; low tier reduces repeated planting further. No asset LOD/compression system is claimed.
- Shared gusts deform rooted vegetation and scarf and alter water/audio. Shadow updates are bounded to 10 Hz detailed / about 5.6 Hz low; reduced motion suppresses secondary wind deformation.
- `composition.ts` / `audio.ts`: seeded 40-bar opening/answer/contrast/return/resolution form; constrained harmony/register, motif development, rests and voice-leading. Piano 66 bpm; lo-fi 76 with bass, kick, brushed snare and hats; jazz 84 with bass and lighter swung comping/brushes. Preset/context changes affect new bars without restarting the score.
- Spatial river/fire, wind, rain and shelter filtering; six non-repeating synthesized variations per stone/wood/soil/grass surface; motion contacts, birds and door/paper/fire detail. Music has a 32-voice budget, transient effects 16. Stop fades and suspends the audio context; hidden tabs mute world/effects while selected music may continue. Overdue musical events are discarded on resume.
- Preserved all storage keys. Optional `ambience` and `effects` mixer values default safely for old preferences. Explicit activation, loading feedback and a reported sample fallback remain mandatory.

### Verification and evidence

- Production build and TypeScript checks passed; ten deterministic checks in [contracts.cjs](scripts/village/tests/contracts.cjs) passed. Checks exercise 30/60/120 fps agreement, wall blocking, energy exhaustion/recovery, activity resets, bridge/water/ceiling boundaries, bounded catch-up, deterministic score evolution and distinct orchestration across 340 bars per style.
- Browser recording exercised walk/run/sprint/air/idle. Playback review found missing bench collisions; those were added, with collider-top landing support. The final 13.78-second VP9/Opus recording contains 35 footsteps, two takeoffs and three landings (including a height transition), with minimum energy 46. Its stereo audio track is non-silent; perceptual synchronization remains unreviewed.
- Real production UI: focus start/pause and deadline restoration across reload, all six activity panels, preserved existing note/kept-note state, expanded mixer, explicit audio activation/stop, simple view, breathing startup and mood suggestion verified. Japanese controls and 390×844 portrait controls were inspected; keyboard-triggered jump worked in that layout. This does not prove physical touch. English was restored. The final production preview has no captured console errors or warnings.
- [Evidence files and provenance](docs/village/evidence/README.md): five 1280×720 scene captures, final movement recording, two-minute frame profile, three 125-second music previews, audio measurements and eight passing browser audio-lifecycle assertions. Repeated audio disposal is safe after a browser-discovered fix.
- Profile: Mac16,12, arm64, 16 GiB; high tier, 1280×720 drawing buffer, DPR 1; 120.024 seconds, mean frame interval 9.29 ms and p95 16.7 ms. End-of-profile renderer counts: 47 calls, 2,355,526 triangles, 46 geometries, 29 textures. This is an in-app-browser desktop measurement before the minor collision/lifecycle fixes, not 1080p or phone acceptance. Triangle count still exceeds the initial budget.
- Music previews use distinct seeds and actual production instruments without normalization. Their sample peaks are −19.05/−20.66/−21.09 dBFS; RMS levels are −40.81/−40.97/−41.15 dBFS for piano/lo-fi/jazz. These measurements guided preset balance; they do not establish musical quality or long-session comfort.
- `npm run typecheck`, `npm run build` and `git diff --check` passed after the last runtime fix. Existing build warnings concern workspace lockfile discovery, outdated Browserslist data and an unrelated room image. No dependency updates were made. The existing local production server at `http://127.0.0.1:3000/` was verified serving the new export.
- Visual art remains below the approved reference. A skinned procedural character, new roof geometry and extra dressing do not close VIS-01/02 or PLACE-01. Current final QA remains blocked on art, listening, physical touch and declared target-device budgets.

### Reproduce the checks

```bash
npm run typecheck
npm run build
node_modules/.bin/tsc features/village/bridge.ts features/village/environment.ts features/village/movement.ts features/village/composition.ts features/village/places.ts --outDir /tmp/cosy-village-test --module commonjs --target ES2022 --skipLibCheck
node scripts/village/tests/contracts.cjs /tmp/cosy-village-test
NODE_PATH="$PWD/node_modules" node scripts/village/tests/bridge.cjs /tmp/cosy-village-test
python3 scripts/village/preview_qa.py --port 3011
```

The local QA harness compiles production modules into a temporary directory and serves only those modules, public assets and Three.js. Its buttons save captures, motion, profile and offline audio previews in `docs/village/evidence`. It is not a shipped application route. It deliberately accesses engine internals for repeatable test positioning. Its music renders test the production composition/instruments offline, not live listening or end-to-end traversal audio.

### Next implementation work

Continue from the [current handoff priorities](VILLAGE_HANDOFF.md#next-work). Refine the representative slice against the approved image while preserving the rebuilt bridge and open hearth layout. Profile the added scenery, shadow passes and resident rigs before further increasing detail. Review foot planting/camera occlusion and listen to the supplied samples/traversal, then record a continuous 15-minute session. Do not expand remaining places or mark P1 acceptance closed before that slice passes. Physical-phone touch/thermal tests and constrained-network cold loading remain outstanding.

## Historical prototype evidence

The sections below are a retained snapshot from before the integrated systems and feedback fixes. Their present-tense statements and older measurements describe that prototype only; use the latest sections above for current behavior and evidence.

### Accepted scope
- Visual target: [the user-approved village image](docs/village/references/approved-village.png).
- Only functional baseline: https://cipheratlas.github.io/cosy-v1/ . Ignore prior local design experiments.
- Third-person, walkable, small village with strong atmosphere, lighting, audio, and browser performance.
- Arkenfall is a heavy experiential reference. The latest requirements add a substantial procedural music redesign, real jumping, distinct run/sprint animations and energy inspired by Genshin Impact, coordinated wind, world sound, better assets and lighting approaching AAA craft within browser constraints. These requirements are still open.
- Six activities: focus cottage, music hearth, breathing pond, mood tea garden, gratitude writing nook, compliment postbox.
- PDF, manga, books/search excluded from the new experience.
- The preceding task authorized the prototype implementation. The latest task requested documentation of state, gaps and future work; no deployment or Git mutation was requested. Future work follows its own applicable task authorization.

### Implementation decisions
- The published site defines the functional baseline; the selected village image defines the art target. Prior local design experiments were not used as the visual reference. Existing unrelated working-tree changes are preserved.
- Render actual 3D geometry with standard HTML activity controls.
- Use CC0 source assets, locally served textures/models, instancing and quality tiers.
- Keep direct travel and an accessible activity view available; no activity depends on navigating 3D.
- Persist user notes and preferences locally. Never start audio without user interaction.

### Historical implementation
- Root page uses `features/village/Village.tsx`; existing routes remain available but are not linked from the village.
- `VillageEngine.ts` owns rendering, third-person movement, collision checks, camera, weather and scene transitions.
- `world.ts` builds and batches the village; `flame.ts` provides animated flame surfaces.
- `Activities.tsx` and `useSession.ts` provide six activities and persistent timestamp-based focus sessions.
- `audio.ts` uses locally served Salamander piano samples with simple repeating chord/pattern generation and filtered-noise ambience. Audio requires a click. This is not yet the requested music quality.
- `public/village/CREDITS.txt` records source assets and licenses. `scripts/village` regenerates/fetches assets using an isolated Blender process.
- Dependencies added: Three.js and its types, Radix Dialog, Phosphor icons. React Three Fiber/Drei/Rapier were tried and removed; the final renderer uses Three.js directly.

### Verified in the preceding implementation session
- `npm run typecheck`: passed.
- `npm run build`: passed, static export generated.
- Browser flows: all six places, focus persistence/completion/breaks, gratitude persistence, breathing, mood routing, music controls, Japanese settings, simple view, 390 × 844 layout, tap-to-walk.
- Final background in-app browser sample at 1536 × 1024: about 26 fps, 50 draw calls and 2.17M reported triangles at rest. An earlier sample at 1280 × 720 showed approximately 36–40 fps, 85 calls and 5.87M triangles before the final culling/shadow changes. Viewports and conditions differ; these are not controlled before/after frame-rate measurements. Frame-rate acceptance is still open; this is not a real-device benchmark.
- Mobile navigation labels, 44-pixel movement targets, rainy weather, and proximity `E` interaction were verified after the final fixes.
- Fresh production browser console: no errors or warnings after switching deprecated Three.js APIs.
- `git diff --check`: passed. No Git writes, deployment, or PR performed.

### Historical open work
This is a functional first pass, not the completed requested revamp. [Design QA](design-qa.md) is blocked on significant visual mismatches: architecture, traveller, terrain/planting, golden-hour atmosphere, and cottage detail. Exact reference fidelity is not established. Device performance, audio listening, complete collision coverage, constrained-network loading, and automatic WebGL fallback still need broader verification.

The source audit confirms additional gaps: Shift changes speed while reusing the walk clip; Space does not jump; no stamina or landing state exists; wind is limited to basic grass sway; music repeats four fixed chords with small preset differences; world audio lacks spatial emitters, footsteps and interaction effects. Track required work by gap ID in [the canonical backlog](VILLAGE_HANDOFF.md#required-work-in-order).

Current runtime assets total approximately 26 MB on disk (roughly 17 MB textures, 7.6 MB models, 1.2 MB audio, rounded). These are historical disk totals, not compressed transfer size, GPU residency or a loading benchmark. The documentation references are separate and not shipped from `public/`.

### Evidence and next action at that time

- [Bundled reference index](docs/village/references/README.md) and [provenance manifest](docs/village/references/manifest.json).
- [Unfinished village](docs/village/references/prototype-village.jpg), [cottage](docs/village/references/prototype-cottage.jpg), [mobile](docs/village/references/prototype-mobile.jpg), [simple view](docs/village/references/prototype-simple.jpg).
- Next implementation milestone: establish asset/animation/event contracts and finish one representative entrance/cottage/bridge/hearth slice against the approved reference. Coordinate movement, sound and lighting using the canonical work packages.
- No deployment, Git commit, PR, finished-art certification or audio-quality certification is recorded here.

## Local preview
The feedback pass verified the rebuilt export at `http://127.0.0.1:3000/`, using the existing Python HTTP server. The temporary QA server on port 3011 was stopped afterward. Server state can change between tasks; check listener ownership and HTTP response before starting another process. Rebuild with `npm run build`, then serve `out` locally as described in [README.md](README.md). Nothing was deployed by these tasks.

## Earlier documentation handoff verification

The 2026-09-25 documentation pass checked local document/source links and heading anchors, reference-file hashes against all 12 original image files, and Markdown whitespace. A before/after SHA-256 comparison of 166 existing runtime/source files found no changes from this documentation work. `git diff --check` passed. No build, device benchmark, gameplay or listening check was rerun for these documentation-only changes; the implementation evidence above remains historical.

## 2026-09-25 documentation reconciliation after feedback

Updated the README, canonical handoff, this ledger, design QA, all three production specifications, and the evidence/reference indexes. Current behavior and evidence now cover the bridge, camera range, clouds/scenery, residents/birds, hearth, Firefox audio and the separately recorded activity-exit follow-up. Historical images/profiles are labeled, current evidence is linked, and remaining art, listening, touch and performance work stays open.

Checked local file links, Markdown heading anchors and whitespace. This documentation request made no application edits and ran no new runtime tests. A comparison against 173 initial implementation/asset/package hashes detected concurrent changes in `life.ts`, `village.css`, `VillageEngine.ts` and `Village.tsx`; those edits were preserved. Earlier build/browser/test results above retain their original scope and date and do not certify concurrent implementation work.
