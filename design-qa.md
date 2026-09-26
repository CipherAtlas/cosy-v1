# Cosy Village design QA

final result: blocked

This verdict concerns the approved art and full-experience acceptance. Publishing the current candidate does not close those findings.

## 2026-09-26 water, fire and activity UI

The striped water and flat flame cards are replaced by flowing surface detail and layered fire with embers/smoke. The spirit now inhabits each activity: desk/hourglass, hearth seat, breathing dock, tea table, writing desk and postbox. State changes animate those props. Warm paper controls keep the action visible, with compact mobile framing and a hide-controls toggle. Initial sign occlusion, a water/fire transparency artifact and a cropped mobile spirit were found and corrected.

All six activities were inspected across native Firefox and Chromium, including the cottage timer, local note saving, playback, Japanese controls and 390×844 framing. Renderer checks, exits and dialogue regressions pass; see [the milestone](VILLAGE_BUILD.md#2026-09-26-water-fire-and-inhabited-activities) and [motion evidence](docs/village/evidence/living-activity-motion.webm). The overall verdict above still concerns complete reference/AAA and target-device acceptance, not whether this requested pass is implemented.

## 2026-09-26 navigation, shadow and soundtrack polish

The player now retains its movement heading when idle. The entrance has a readable six-place directory; junction and destination posts guide exploration, with English/Japanese labels and correct reverse-side arrows. Sign placement was visually corrected to clear the lamp, cottage facade and activity return camera. The weighted shadow filter and continuous detailed-tier updates address grainy edges and stepped motion. See [current entrance](docs/village/evidence/polish-entrance.png), [post detail](docs/village/evidence/polish-cottage-post.png) and [shadows](docs/village/evidence/polish-soft-shadows.png).

Four complete recordings now follow location/scenery, with crossfades and manual selection; rain/fire/river beds are recorded too. All 28 new audio lifecycle checks pass, including a missing-track test. The generated-score direction is superseded. Desktop/390×844 music controls and Japanese labels were checked, but no subjective long-session listening or physical-phone certification is claimed. [Current evidence](VILLAGE_BUILD.md#2026-09-26-orientation-shadows-wayfinding-and-recorded-soundtrack) records the checkpoint release and subsequent local changes separately. The overall art/device acceptance verdict above remains open.

## 2026-09-26 fantasy village pass

The revised user brief extends the Genshin-inspired fantasy language to architecture, distant materials and NPCs. The local implementation now has swept colorful roofs, limestone arches, reflective glazing, flower boxes, rounded tree crowns, softer mountain colors, organic meadow patches and two floating skyline gardens. All four named residents are pastel spirits with distinct accessories; their approach and dialogue checks pass.

Inspected [cottage details](docs/village/evidence/fantasy-cottage-exterior.png), [valley layers](docs/village/evidence/fantasy-valley-wide.png), [all five spirits together](docs/village/evidence/fantasy-spirit-villagers.png) and individual portraits. The group portrait uses QA staging; NPCs normally follow their retained routes. The previous photo-material/card-tree/humanoid mismatch is replaced with a consistent stylized kit. Foliage still uses rounded geometric clusters, house variants share a kit, and device/thermal acceptance remains open. The broader blocked verdict above is an AAA-quality gate, not a claim that these requested changes are unimplemented.

## 2026-09-26 colorful spirit pass

The latest user instruction replaces the muted realistic-human target with an Arkenfall/Genshin-inspired colorful village and an original cute white flying spirit. Judge the palette and player against that direction; retain the earlier concept as a composition/craft reference.

Inspected the new [entrance](docs/village/evidence/art-entrance.png), [spirit face](docs/village/evidence/art-spirit-front.png), [cottage](docs/village/evidence/art-cottage-exterior.png), [interior](docs/village/evidence/art-cottage.png), bridge/hearth and golden/dusk/rain captures. The new smile, white silhouette, blue sky, greener meadow, roof color, water and cottage details are visible in the running engine. Player movement and existing villager/activity behavior have current verification in [the build ledger](VILLAGE_BUILD.md#2026-09-26-colorful-art-pass-and-spirit-player).

Verdict: **the new player and palette are implemented; overall AAA art acceptance remains open.** Repeated building forms, sparse-looking near canopy in some views, discrete tree LOD changes and the simple interior are still apparent. The screenshots do not establish parity with Genshin or the earlier concept. No heavy postprocess blur or orange screen filter masks the remaining geometry/material work.

## 2026-09-26 villager interaction follow-up

All four residents have distinct English/Japanese voices, overhead speech and click/F chat. The [dialogue suite](docs/village/evidence/villager-dialogue.json) passes 28 checks; desktop and 390×844 portrait bubbles, all four conversations and production language/menu behavior were inspected. The [approach suite](docs/village/evidence/villager-approach.json) passes 20 checks covering frame-rate agreement, personal space, blocked paths, returns and invitation suppression. [Integrated samples](docs/village/evidence/villager-approach-runtime.json) show animated Pip walking over, greeting at about 2.42 m and returning. These checks do not establish new performance numbers, physical-touch behavior or Firefox coverage for NPC interactions. See the [build ledger](VILLAGE_BUILD.md#2026-09-26-villager-approaches) for reproduction and limits.

## 2026-09-25 activity-exit follow-up

The existing [activity-exit ledger](VILLAGE_BUILD.md#2026-09-25-activity-exit-fix) records clear pond/nook arrivals, immediate walking-camera restoration and visible **Back to village** controls for every activity. [Firefox collision evidence](docs/village/evidence/activity-exits.json) passes for all six exits. The ledger also records desktop, 390×844 and simple-view button/focus checks. These results were reviewed during the documentation update, not rerun. Physical touch and the wider art/listening/performance acceptance remain open. The frame profile below predates this follow-up.

## 2026-09-25 user-feedback review

Addressed: Firefox's missing listener AudioParams now take the compatible method path; upward/overhead orbit is usable; clouds and textured scenery surround the village; four animated residents and twelve birds are present; the hearth is off the road with three inward-facing benches. Firefox output measurement and nine audio lifecycle assertions pass. New visual evidence is linked in the latest build-ledger section.

The bridge was subsequently rebuilt after the user identified its broken appearance: the old deck was wound downward, leaving a ground-level path visible beneath it. The new solid arch has upward-facing paving, bank-connected approaches and continuous parapets. Three dedicated geometry/movement checks pass, and the rendered crossing is recorded in both directions.

The final 120.03-second 1280×720 high-tier sample reports mean 22.00 ms (about 45 fps), p95 33.4 ms. The last renderer sample reports 4.55M triangles including shadow passes. The added scene does not establish sustained 60 fps; performance remains open alongside art quality. See [the final profile](docs/village/evidence/profile.json); the earlier systems profile below is historical.

Current evidence: [bridge profile](docs/village/evidence/bridge-side.png), [walkable deck](docs/village/evidence/bridge.png), [hearth seats](docs/village/evidence/hearth.png), [upward camera](docs/village/evidence/camera-up.png), [overhead camera](docs/village/evidence/camera-down.png), [rear scenery](docs/village/evidence/camera-rear.png), [recorded traversal](docs/village/evidence/motion.webm), [Firefox output](docs/village/evidence/audio-output.json) and [scene audit](docs/village/evidence/scene-audit.json). The [evidence index](docs/village/evidence/README.md) records browser, resolution and capture limitations.

Production build/type checks, ten controller/composition checks and three bridge checks passed after the feedback fixes. The fresh production UI loaded the village and switched sound on/off without captured console errors or warnings. These checks are distinct from the earlier full activity/persistence regression pass below; that entire suite was not repeated for the feedback fixes.

The P1 craft findings below remain open. This pass corrects reported behavior and visible omissions; it does not turn procedural buildings, terrain ridges, foliage and character anatomy into finished reference-quality assets. Mountains remain stylized and the new residents reuse the candidate rig. Subjective sound quality and physical-device tests are still open.

## Earlier 2026-09-25 systems milestone review

This earlier review records the systems milestone before the feedback fixes above. Its numerical results are historical; its unresolved craft and listening findings remain relevant. The final result remains **blocked** against the approved art and full-experience acceptance, for these concrete reasons:

- **P1 — Hero art and light still fall short.** Roof courses, bracing/masonry, ivy, willows, bridge shape and indoor furniture add detail, but architecture remains repetitive, planting reads as simple triangles/leaves, the path has obvious material boundaries, the skyline/terrain remain artificial, and sunlight lacks the reference's depth and richness. New assets remain candidates.
- **P1 — Traveler craft remains unfinished.** The new 21-bone skinned model has distinct clips and better articulated limbs, but anatomy, hair, coat silhouette, cloth folds and foot planting still need authored art/animation work. The new recording is evidence of implemented states, not finished gait quality.
- **P1 — Listening acceptance is open.** Three 125-second offline previews demonstrate the new arrangements and level measurements. No 15-minute headphone/speaker listening session was performed. Recorded traversal output still needs sound-design review and contact synchronization assessment.
- **P2 — Camera/physics and physical touch need broader coverage.** Contract tests cover frame-rate independence, bridge/water, walls, low props and ceilings. Portrait jump is visible and controls fit at 390×844, but physical multi-touch/cancellation and exhaustive camera occlusion are unverified. The bridge recording brings the camera close to the traveler near buildings.
- **P2 — Device/load budgets remain open.** A local two-minute high-tier 1280×720 sample on Mac16,12 (arm64, 16 GiB) reports mean 9.29 ms and p95 16.7 ms. The reported final view contains 2.36M triangles, above the proposed typical-view budget. This is not 1920×1080 or physical-phone proof, and counts vary on bounded shadow-refresh frames. No cold-network/thermal/GPU-residency measurement.

Evidence: [entrance](docs/village/evidence/entrance.png), [cottage](docs/village/evidence/cottage.png), [motion](docs/village/evidence/motion.webm), [earlier profile](docs/village/evidence/profile-systems.json), [audio measurements](docs/village/evidence/audio-measurements.json), [audio lifecycle checks](docs/village/evidence/audio-lifecycle.json). Captures, motion and lifecycle evidence have since been refreshed by the feedback pass. Scene captures use the isolated production-engine harness at a 1280×720 canvas; browser UI was separately inspected at 1536×1024 and 390×844. These do not constitute a pixel-matched paired comparison with the 1536×1024 concept.

Verified regression behavior: six destination controls remain available; focus deadline survives reload and the test session was paused afterward; old note count and kept-note state remain; breathing begins; mood returns a suggested destination; sound starts only explicitly and stops; simple view works; named portrait controls and Japanese labels fit. Final build/type checks and ten controller/composition contract checks pass. Eight Web Audio lifecycle assertions pass after fixing repeated disposal. Existing Next workspace-root, Browserslist and unrelated RoomScene image warnings remain.

Arkenfall reference: visited `https://www.arkenfall.site/` on 2026-09-25; continued the existing save without resetting it. At the 474×683 viewport, observed the playable waterside scene, low follow camera, swaying planting/cloth, reflective water and layered mountain silhouettes, and a short forward movement. Audio was not listened to or recorded. These are observations, not assertions about its implementation technology.

## Historical prototype review

Evidence from the preceding implementation session, 2026-09-25. The documentation pass preserves this verdict and the original findings; it does not constitute a new rendered-scene or listening test. Continue from [VILLAGE_HANDOFF.md](VILLAGE_HANDOFF.md), with production details in [the art specification](docs/village/ART_AND_ASSETS.md).

The playable prototype is not a visual match for the selected concept. The remaining art and lighting work is material, not minor polish. Build success and working activities do not change this result.

## Comparison evidence

- Source visual truth: [user-approved concept](docs/village/references/approved-village.png).
- Implementation: `http://127.0.0.1:3000/`, exported production build.
- Implementation screenshot: [unfinished entrance](docs/village/references/prototype-village.jpg). Original source paths and byte hashes are retained in [the reference manifest](docs/village/references/manifest.json).
- Both comparison images: 1536 × 1024 pixels. Implementation CSS viewport 1536 × 1024, device scale factor 1. No resizing or browser chrome in the comparison.
- State: desktop village entrance, golden-hour setting, arrival overlay dismissed. The concept's nearby cottage prompt is not expected at the prototype's starting coordinate.
- Full views were opened together in one comparison tool call. The central traveller, right cottage, left stream/bridge, and distant skyline were reviewed within that paired input. Separate crops were unnecessary to establish the large, clearly visible P1 asset and composition differences; microtypography is not being declared an exact match.
- Mobile evidence: [simple activity view](docs/village/references/prototype-simple.jpg); 390 × 844 CSS viewport.

## Findings

- **P1 — Environment assets are below the target art quality.** `features/village/world.ts`. The source has irregular stonework, layered roof tiles, mature trees, varied foliage, and textured architectural details. The current village has repeated procedural houses, planar roofs, sparse trees, obvious grass triangles, and uniform flower bands. Replace the prototype architecture and vegetation with authored, textured assets, create silhouette and material variations, and use LODs and baked lighting to keep them affordable.
- **P1 — Traveller is a prototype model.** `scripts/village/create_traveller.py`. The target has natural anatomy, cloth folds, textured hair, and convincing gait. The current traveller is assembled from simple volumes. Replace it with a properly modeled, textured and rigged character while preserving movement and interaction contracts.
- **P1 — Composition and light do not convey the selected atmosphere.** `world.ts`, `VillageEngine.ts`. The source has warm sunlight, leafy foreground framing, a natural path, layered haze, and a distant castle ridge. The implementation has a flat horizon strip, oversized smooth mountains, a repetitive path, and cooler/flatter illumination. Rebuild the entrance composition around the reference, author terrain variation and forest layers, and bake warm indirect lighting with controlled exposure.
- **P1 — Cottage interior remains a blockout.** `VillageEngine.buildInterior`. The timer works, and the terrain obstruction was fixed, but furniture, windows, fabrics, and fire surround are not at the concept's quality. Finish one representative interior to the selected standard before expanding scene dressing.
- **P2 — Performance needs broader validation.** Local frame measurements are informative, not proof of performance on phones or integrated GPUs. Establish frame-time and memory budgets on real devices, add model LODs, compress models/textures, and test cold loading on a constrained connection. Current assets total approximately 26 MB, with music loaded on demand.
- **P3 — UI differs from the concept.** The prototype adds navigation icons, a settings control and a location label. The source uses a simpler header and larger movement hints. Review those differences after the scene art is settled.

## Required fidelity surfaces

- **Fonts / typography:** Georgia display text and Outfit controls have the intended calm hierarchy, but are not an exact source-font match. Readability was inspected on desktop and at 390 × 844. No claim of pixel-perfect typography.
- **Spacing / layout:** The full-screen scene and corner controls are consistent with the direction. The entrance's camera, terrain, architecture spacing and framing differ substantially (P1). Mobile activity and settings layouts fit the viewport.
- **Colors / tokens:** Cream text and dark green panels are appropriate. Warm window emission, softer fire and water adjustments improved the scene, but the source's golden light, depth and material richness are still absent (P1).
- **Image / asset quality:** Fails against the selected source. Real 3D geometry is used; no concept image is presented as an explorable 3D scene. Current procedural assets do not meet the required visual quality.
- **Copy / content:** Six requested activity categories are present. Reader/PDF/manga/book search is absent from village navigation. Older routes remain in the repository and export; they were not part of this implementation.

## Iterations and fixes

1. Initial development captures exposed blown-out water/bloom, overly dark surfaces, sparse damaged tree leaves and a mismatched temporary character. Removed bloom, corrected lighting/material handling, rebuilt leaf simplification, added a custom traveller and layered planting. The later paired capture still shows P1 asset and lighting gaps.
2. Cottage testing exposed exterior terrain covering the furniture. Hide the outdoor world in the interior and snap the camera across interior transitions. Post-fix browser capture showed the desk, floor and fireplace correctly; the interior still needs art production.
3. Mobile testing at 390 × 844 exposed icon buttons losing their accessible names when text was hidden. Added explicit labels and 44-pixel targets, and adjusted the compact header.
4. Runtime warnings identified deprecated Three.js HDR and shadow APIs. Switched to HDRLoader and PCFShadowMap. Fresh production-tab logs were empty.
5. Performance inspection showed approximately 36–40 fps at 1280 × 720 before per-tree culling. Added per-instance tree visibility, shared transforms for bark/leaves, merged traveller meshes, reduced pixel ratio tiers and cached static shadows. See VILLAGE_BUILD.md for final measurements and limitations.

## Functional verification

- Production build and TypeScript checks pass. Existing non-village image lint warning and workspace-root/Browserslist warnings remain.
- Direct travel to all six activities works.
- Focus start/pause/resume, live countdown outside the cottage, reload restoration, a real one-minute completion, and a five-minute break were tested.
- A gratitude QA note was saved and remained after a full reload. One clearly named test note remains in this localhost browser's storage.
- Breathing starts and advances phases; mood selection routes to the matching activity; another kind note and Keep work.
- Sampled-music startup reaches the playing state and stops from the UI. Listening quality and cross-browser audio behavior are not certified by these checks.
- Tap-to-walk visibly moves the traveller, and pressing E at the cottage opens its activity. Exhaustive boundary/camera collision and touch-device input testing remain outstanding.
- Japanese settings, narrow-screen activity controls and the simple activity view were inspected. Final mobile checks confirmed named Places/Sound buttons, named direction buttons, and visible rainy weather.
- Final performance sample at 1536 × 1024 in the background in-app browser: approximately 26 fps, 50 draw calls, 2.17M reported triangles at rest. The performance acceptance target remains open.
- Final production console check: no errors or warnings observed in the fresh test tab.

## Implementation checklist

1. Produce a detailed entrance scene and a finished traveller matching the accepted reference.
2. Finish the focus interior and one outdoor activity composition to the same standard.
3. Add LODs, asset compression and measured device/network budgets.
4. Test all movement boundaries, camera occlusion, touch input, audio, and WebGL recovery.
5. Repeat paired visual QA. Do not label the result finished or matched while P1/P2 items remain.

## Additional required acceptance

The latest user request expands the acceptance work beyond the historical visual findings: recorded music that follows the scenery, Genshin-inspired run/sprint animations and energy, real jumping/landing, shared wind, Arkenfall-like world sound, richer assets and more alive lighting. These are required open features, not claims about what the above screenshots prove. Follow [movement and world acceptance](docs/village/MOVEMENT_AND_WORLD.md#acceptance), [music and listening acceptance](docs/village/MUSIC_AND_SOUND.md#verification-and-acceptance), and the [canonical gap register](VILLAGE_HANDOFF.md#required-work-in-order).
