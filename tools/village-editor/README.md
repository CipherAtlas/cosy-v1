# Cosy Layout Studio

The Detailed rendering budget pass preserves the studio's full authored geometry and saved transforms. Runtime culling/detail changes apply only to the playable renderer. The shared native town catalog now reads the lossless `farm-props.glb` subset for non-replaced props after native animals load, retaining all fifteen town asset IDs and previews. Regenerate/check it with `python3 scripts/village/split_farm_props.py` / `--check` after changing the original farm kit. [Current measurements and limits](../../VILLAGE_BUILD.md#2026-10-04--detailed-rendering-budgets-local).


**Animals** contains seventeen skinned models from the [2026-10-04 animal art set](../../docs/village/ANIMAL_ART.md): bay/grey horses, copper/flower Highland cows, six dogs, sheep/lamb, cat, swan, owl and duck/duckling. Each has a rendered preview and supports placement, full rotation/scale, duplication and named save/reload. IDs use `animal-*`; these decorative placements have no shared actions or collision. Existing **Puppies**, riding-horse, town-animal, cottage-cat and pond-bird entries now share the new skins while retaining their gameplay identities. Skeleton-aware cloning preserves independent bones; batching excludes skinned meshes. Restart the local editor after source changes; its routes/save API remain excluded from the static site.

The 2026-10-04 working-layout revision moves both swing sets and lamps off paving, puts Bramble beside the grassy mushroom patch, repairs owl/cottage/stable approaches and moves the original race stripe to the stable-side southern gate. Original defaults, named designs and browser recovery drafts remain preserved. Runtime/editor pond banks now conform below the original river where they overlap, including transform/undo/save reload. The game map uses these authored placements. After a physical change, regenerate matching Worker physics and restart/rebuild local previews; [current checks](../../VILLAGE_BUILD.md#2026-10-04--town-interaction-and-layout-revision-local) distinguish them from deployed results.

The [2026-10-01 village release](../../VILLAGE_BUILD.md#2026-10-01--integrated-village-release-published) publishes the four-dog layout, revised bird bowl and cottage assets. This editor and its server/save APIs remain local-only; its source is committed alongside the game. Forty cottage-asset and five bowl-editor checks passed with temporary saves and unchanged protected presets.

A private map editor using the village’s actual Three.js artwork. It runs outside Next.js, binds to your computer’s loopback address, and is excluded from the public static export. It uses the project’s existing TypeScript and Three.js installation plus Python 3; no new dependencies are required. Saved scenery, buildings, props, water, paths, fences, planting, seats, animals and resident routes feed the playable scene through `public/village/world-layout.json`.

```bash
npm run dev:editor
```

Open **http://127.0.0.1:3040**. To choose another port:

```bash
npm run dev:editor -- --port 3042
```

Keep the process running while editing. Restart it after source changes; ordinary layout saves do not require a restart. Existing village previews can keep running on their own ports.

After applying changes to the playable layout or collision geometry, regenerate the shared Worker's `worker/world-physics.json` from a freshly compiled QA engine. Run `python3 scripts/village/preview_qa.py --port 3067`, then `QA_URL=http://127.0.0.1:3067 node scripts/village/tests/shared-physics.cjs --write` with `PLAYWRIGHT_PATH` pointing to an existing Playwright installation if needed. Run the same check without `--write` to verify exact collision/bench/layout parity, followed by `node scripts/village/tests/shared-world-worker.cjs`. Publishing a changed layout requires matching Worker physics; the editor and its save/Apply API remain local-only.


## Your defaults and working copies

- **Current village:** the updated village, including the garden, harvest basket, bird-clearing approach/terrace/bench/flowers/feeding dish, twelve white doves and all five residents. The 252-object layout is saved in `presets/current-village.json`.
- **Riverside retreat:** four cottages gathered along the river.
- **Open meadow:** the valley scenery, ready for a new composition.
- **Original snapshot:** the earlier 231-object layout, retained in `presets/original-village.json`.

The studio opens a working copy of **Playable village**, the local game's current **Willowbank town** design. It has 595 objects, fourteen homes, connected lanes, a winding brook, an enlarged pond, three five-row farms, a raised grazing meadow, an owl roost and the horse circuit with its hay stable. The 640 m ground remains open for traversal. The saved **Flat open village** and all other named designs and protected presets remain preserved. A recovery draft takes precedence on startup; choose **Playable village** in Layouts to open the current town. Protected defaults always open as new working copies. JSON files preserve layout transforms and reference the shared asset kit. The town includes 49 paired meadow grass/wildflower zones, a flower-haired Highland cow, an apple tree and mushroom patch. Redundant broad planting erasers remain editable but hidden so the race infield and farm aisles stay green.

**Save layout** writes a named JSON file under `tools/village-editor/layouts/`. A browser recovery draft is kept after each edit. **Save current as a new copy** creates another file. **Export JSON** downloads a portable copy; **Import JSON** validates a file before replacing the working view. Saved layouts and their previous versions are ignored by Git.

Writes are atomic. Previous file contents are retained under `layouts/.history/`; restore one by importing it, then saving a copy. Revision checks reject stale saves from another tab instead of silently overwriting them. A failed save leaves the open design available for export. Browser drafts are local to the browser origin and shared across tabs on that origin; named files are the durable source of truth. Changing the port changes the browser-draft origin, but all ports use the same local layout directory by default.

## Editing

**River (U)** works like Path: drag a segment or click bend points, then use Enter / Finish river. Select it to edit width (0.3–20 m), length, yellow control points or continue drawing. The Landscape shelf also offers **Flowing river curve** with a rendered preview. Rivers follow elevation, use the village flowing-water material, clear grass beneath them and survive undo, named save/reload, import/export and Apply. Both runtime and Worker movement treat their width as water; rebuild matching shared physics before shared play. They are terrain-following streams, without a fluid simulation or automatic excavation.

**Play preview** spawns the village spirit on clear ground near the current view in the unsaved working copy. WASD / arrows move, Shift runs, Space jumps and mouse drag orbits the following camera. Scene solids, river/pond water, slopes and the world edge constrain movement. Escape / Back to editor restores the editing camera and leaves the layout unchanged. Preview is a local play test: it does not join the shared village or run its conversations, tasks, animal ownership or private focus timer.

**Elevation (T)** in the toolbar opens a compact, temporary brush panel and reshapes the actual valley ground. Choose **Raise**, **Lower**, **Level** or **Smooth**, set the 3-40 m brush radius and strength, then drag on the ground. Escape, the close button or another tool closes the panel. Level uses the numeric height; Alt-click the ground samples a height and selects Level. Each stroke is one undo step. Elevation survives recovery drafts, named saves, export/import and Apply. Paths and planting follow the ground; supported unlocked buildings, trees, benches, swings and animals keep their existing ground offset when a stroke ends. Use Level for foundations and Smooth for traversable approaches.

The sculptable valley is 640 m across, bounded by X/Z -320 to 320 m, using a 2 m grid, 0-35 m edited heights and at most 25,000 edited vertices. The original river, pond, bridge approaches and fixed activity foundations are protected. Drawn rivers follow subsequent land edits. Unedited terrain retains its saved base height. **Flatten entire map** switches to a flat base, removes mountain and floating scenery, keeps the river and pond, and enables **Explore entire map**. This opens all solid ground within the finite 640 m perimeter. Older layouts can still use **Walkable meadow area** ellipses. Ground tiles and hills also appear in the local game after Apply.

**Bay riding horse** and **Dapple-grey riding horse** are in Animals, with rendered previews and saved placement, rotation and scale. Apply accepts upright horses with uniform scale. Juniper and Willow start at the racetrack hay stable in the playable town; protected presets and existing named copies are unchanged. Horses use shared ownership in the game: E mounts/dismounts, W/S moves, A/D steers, Shift canters, Space brakes, and Escape dismounts. At the stable F offers hay; at the east start ribbon F races Rowan. Other visitors see the same ride; disconnects release it. Horse sounds follow the normal Sound and Effects settings.

After Apply, follow the shared-physics regeneration commands above and restart the local Worker from the changed source before reloading the shared village. Rebuild static client previews too; development previews recompile the imported layout. Apply does not rebuild a running Worker or publish changes. A client reload alone cannot update the server's collision data. This also applies to moved trees, structures, seats and newly added horses.

**Kind note and envelope** is under Furnishings with a rendered open-note preview. Place it in a working copy, then move, rotate on all axes or scale it; named save/reload preserves the transform. Apply can place this decorative prop outdoors; the activity reading pose still follows its reader. [Local checks and limits](../../VILLAGE_BUILD.md#2026-10-01--kind-note-reading-pose-local).

The shelf includes **Cream & caramel cottage cat** under Animals, **Sage linen couch**, **Pleated reading lamp**, **Framed botanical print** and **Cat’s woven nap cushion** under Furnishings, and **Fern in ceramic pot** under Nature. Each has a rendered preview and supports selection, position, rotation, scale, named save and reload. Cat behavior runs only in the private focus cottage; the editor displays a still model. Apply can place decorative copies outdoors. The private focus room remains a separate activity interior. Protected layouts are unchanged.

The cottage window-wall refresh adds **Cushioned oak writing chair**, **Clothbound cottage books**, **Hand-thrown glazed pottery**, **Oak cottage book shelf** and **Oak cottage pottery shelf** under Furnishings. Both shelves include their displayed contents; books and pottery are also available separately. **Bridge-view cottage window** stays under Buildings with its existing asset ID, a larger pane and no curtains. Its existing saved transforms remain compatible. [Local verification](../../VILLAGE_BUILD.md#2026-09-30--focus-cottage-window-wall-and-comfy-chair-local) uses temporary layout storage and preserves the playable layout and protected presets.

Choose an asset from the rendered shelf, then click the ground. The asset stays active so each further click places another copy; use `[` and `]` to turn the placement preview. Escape or choosing another tool stops placement.

Click an object, or use **Scene** to search and select it. Shift-click adds individual objects; Shift-drag adds every visible, unlocked object whose bounds overlap the selection rectangle. Right-click an object for Cut, Copy, Duplicate, Focus or Remove; right-click empty ground to Paste here. The same menu offers Undo/Redo, while right-drag still pans. Use Cut/Copy/Paste or Cmd/Ctrl+X/C/V on a group. Keyboard and inspector paste places it at the centre of the current view; context-menu paste uses the clicked ground point. Relative positions, rotations and scales are preserved. Repeated pastes are offset by 2 m; the studio clipboard survives reload and stays separate from the system text clipboard. Cuts and pastes are undoable. The move, rotate and scale handles work in world or local coordinates; the inspector also accepts precise X/Y/Z values, uniform scaling and quick yaw turns. Use **Focus** to frame a selection, **Set on ground** to restore terrain elevation, and Duplicate/Remove with undo/redo. Locked scenery remains selectable in the Scene list and can be unlocked in the inspector. Hide large scenery layers there when working underneath them.

**Paths** in the asset library includes ready-made **Straight limestone path** and **Curved limestone path** pieces. Place one, then set its length and width in the inspector, switch between straight segments and a smooth curve, or **Extend by 5 m** along its last segment. **Continue on map** lets you click more points onto the same path; Finish/Enter accepts and Escape cancels. The toolbar's **Path** draws a new path with one drag or a curve through multiple clicks. Select a path and drag its yellow points to reshape it or its blue handle to change width. Paths follow the terrain and placed ground surfaces, and their points and width survive saving and reloading. A playable path uses upright rotation and even horizontal scaling; use the path controls for length and width.

**Fence** in the toolbar or **Oak fence line** in Furnishings uses the same drag or click-points workflow. Select a fence to move its yellow corner points, set a precise length (up to 300 m) or height (0.3–3 m), extend by 5 m, or continue it on the map. The fence follows the terrain and blocks movement in the local game after Apply. Its points and height survive saving and reloading. A playable fence uses upright rotation, even horizontal scaling and 1× vertical scale; use Height to resize it vertically.

**Nature** includes a grass tuft, a 6 m meadow patch and a 14 m wide patch using the village's wind-animated grass. Patches follow the ground and now fade at their circular edges. Use the **Grass** toolbar brush to paint them with a drag; choose Fine, Medium or Wide under Placement. Grass is cleared beneath editable paths and solid props in the authoring view, and returns when those objects move away. The playable world also clears painted grass from paths and colliders.

Use **Erase** in the toolbar to clear meadow grass and decorative lane wildflowers at the cursor, including plants under a footpath. Choose Fine, Medium or Wide under **Erase size**, then click or drag. The path and grass patch objects stay in place; Erase saves a small clearing area instead of deleting either object. A drag is one undo step. Saved clearing rings stay hidden during normal editing; selecting a clearing in **Scene** reveals its ring so it can be adjusted or removed. The Erase cursor still shows the brush size. Save the working copy to keep the clearing, or **Apply to local game** to use it in a local playable preview. Erase does not change the interactive kitchen garden, its flower beds or other props.

**Walkable meadow area** in Landscape expands where the spirit and residents can travel; its X/Z scale and yaw shape an ellipse. It marks movement space over the existing valley terrain. Its teal oval is an editor guide and is unnecessary when **Explore entire map** is enabled; Preview hides it. The active eastern area connects to the old boundary. **Oak meadow bench** in Furnishings is a reusable playable seat with collision and scaled seat height. Trees, grass, paths, this bench and the walkable area use their saved transforms in the local game.

**Sourdough crumb pouch** in Furnishings is the small cloth drawstring bag beside the birdwatching bench. It has a rendered shelf preview and supports placement, position, full XYZ rotation, nonuniform scale, duplication and visibility. Save/reload preserves these values; **Apply to local game** carries them into the playable scene. Its placement is visual; the seated F action stays attached to the birdwatching bench. Protected presets and existing named working copies remain unchanged.

**Resident routes** in the right panel lets you choose Pip, Maple, Moss, Luma or Wren, add waypoints on the map, set a pause at each point, remove points, and check reachability using the playable movement rules. The route line appears while adding points. Roads receive a modest travel preference; residents can still cross clear meadow. Save or Apply to keep authored routes.

**Puppies** contains Mochi the corgi, Kiko the Shiba Inu, Biscuit the beagle, Cloud the Samoyed, Fern the Border Collie and Atlas the German Shepherd. Their rendered shelf previews use the same Blender skins as the game. Place additional dogs or select any of the four current instances to move, rotate, scale, rename or hide; save/reload keeps the edit, and **Apply to local game** carries it into the playable layout. `puppy-collie` and `puppy-shepherd` join the original four compatible asset IDs. Every instance gets an independent 26-bone skeleton and all ten clips in the game; the studio shows a still standing pose. Residents use the restored original blob artwork with small movable fins, matching the game’s v3 model. The model replacement preserves existing resident asset IDs and placement controls. [Pack and editor checks](../../VILLAGE_BUILD.md#2026-09-30-six-dogs-pack-walks-and-articulated-blob-hands-local) cover previews, placement, saved transforms and isolated Apply with protected presets unchanged. The playable copy uses four widely spaced dogs: Mochi in Sunrise meadow, Kiko by the tea-garden lanes, Biscuit on the western pond approach and Cloud on the northern lane. Their 31–55 m patrols remain relative to their placement and facing; moving or rotating a dog moves or turns its whole circuit. Additional collies and shepherds remain available from the shelf. Place dogs on clear, walkable ground and check the longer circuit after moving them. Protected presets and named copies are unchanged. Pack invitations and petting run in the game; approach and invite dogs individually. [Small-arm correction and local checks](../../VILLAGE_BUILD.md#2026-09-30-small-blob-arms-and-collecting-dogs-local).

**Landscape** includes 20 m and 40 m meadow ground tiles, a gentle grassy hill, the round meadow platform and floating gardens. Place a tile, then use its **Expand ground** north/east/south/west buttons to add matching pieces edge-to-edge. Scale X/Z independently for custom dimensions. These pieces can extend beyond the original terrain, within the studio's 1,500 m placement range. **Set on ground**, new object placement and camera height recognize the added surfaces.

**Avoid solid overlaps** is on by default. Placing or transforming a solid into another solid is rejected without losing the working layout, and invalid placement previews turn red. Buildings, bridges, benches, fences, lanterns, tree trunks, rocks and selected solid furnishings use rotation-aware bounds. Existing intersections can be moved apart. Ground pieces, paths and planting can overlap; turn the checkbox off for other intentional layering. The camera uses swept collision against solid bounds and stays above supporting terrain, including added ground. These are editor collision volumes, not full mesh physics or playable-map integration.

The existing kitchen garden and pond life are editable assemblies. Individual flowers, plants, animals, a raised bed and the basket are also available as placeable assets. Residents and doves are posed objects in the authoring view. The editor does not read or modify saved player notes, timers, garden progress or preferences.

**Meadow swing set · two seats** is a reusable Furnishings asset with a rendered preview. The active Sunrise meadow swings replace the former far-right bench; protected presets and named saved copies keep their original bench placements. Select, move, rotate around Y, uniformly scale, save and reload the set. **Apply to local game** carries visible/hidden instances and their position/facing/scale into runtime geometry, support collision and independent swing physics. Apply rejects X/Z tilt and nonuniform scaling; leave equal X/Y/Z scales so the chain's physical length and period remain coherent. The studio displays a still pose; E, W/S, Space and exit controls run in the game. Leave the full 3.3 m arc clear of obstacles. [Local engine/editor checks and limits](../../VILLAGE_BUILD.md#2026-09-30-meadow-swings-and-13-inch-scene-space-local). Shared swing occupancy requires an accepted seat claim and motion is rendered for other visitors; a busy seat cannot be taken. The [local ownership audit](../../VILLAGE_BUILD.md#2026-09-30-shared-world-ownership-audit-local) records the matching Worker/client checks and release limits.

**Low stone lantern** is a reusable Furnishings asset with a lit night preview. The six garden and pond instances can be selected, moved, rotated, scaled, saved and reloaded in a working copy. Their saved position, rotation, scale and visibility now control their playable geometry and collision after **Apply to local game**.

| Control | Action |
| --- | --- |
| Drag / right-drag / scroll | Orbit / pan / zoom |
| Right-click | Object actions or Paste here on empty ground |
| WASD / Shift + WASD | Move camera / move faster |
| Page Up / Page Down | Raise / lower camera |
| Shift + drag | Add objects in an area to selection |
| Cmd or Ctrl + X / C / V | Cut / copy / paste selection |
| V / G / E / R | Select / move / rotate / scale |
| F / Home | Frame selection / frame village |
| Arrow keys / Shift + arrows | Nudge / larger nudge |
| Cmd or Ctrl + D | Duplicate |
| Cmd or Ctrl + Z / Shift + Z | Undo / redo |
| Cmd or Ctrl + S | Save |
| P / B / Enter / Escape | Draw path / fence / finish / cancel |

Scroll zoom is faster and follows the cursor. Camera movement and panning stay at least 1.5 m above supporting ground; typing in fields does not move the camera. Camera collision remains active when intentional object layering is enabled. Existing saved layouts and protected presets are loaded without rearranging their objects.

Perspective, top-down view, a ground grid, position/rotation snapping, four lighting previews (including Starlit night) and an uncluttered Preview mode are available. Preview always has a visible **Back to editor** button; Escape also returns. The editor's night preview shows every fixture light for placement; the playable renderer limits real-time ground lighting to the two fixtures nearest its visitor while retaining every lantern's lit glass and halo.

**Moonlit path lamppost** is a reusable Furnishings asset with a rendered shelf preview. Place it in a working copy, then select, move, rotate or scale it like other props; those transforms are stored in the layout JSON. The playable scene also has four new lamps near the bridge, tea garden, bird clearing and pond. Protected presets remain unchanged and do not gain those positions automatically.

## Integration boundary

**Sourdough feeding dish** retains its existing Furnishings asset ID and now previews the larger shallow wooden bowl, stone rim and full crumb serving. Position, rotation and scale remain editable and survive working-copy save/reload; protected presets are preserved. Feeding-dish transforms remain visual working-copy changes under the existing Apply boundary below. The live meal animation controls serving visibility and depletion; its flight patterns and feeding rules remain runtime behavior. [Local bird-clearing verification](../../VILLAGE_BUILD.md#2026-09-30-larger-bird-bowl-and-varied-sky-circuits-local).

**Save layout** keeps an editable local working file. **Apply to local game** writes `public/village/world-layout.json` after a reachability check, revision check, server validation and backup under `layouts/.history/`. Reload a local game preview to see the result. The original presets and saved working copies are not rewritten by Apply. Path, fence, planting, eraser clearing, tree, bench, swing, walkability, crumb pouches, puppy placement, cottage/spire position and route data then drive the local runtime; a normal build and release would be required before any visitor sees it.

The game reads saved scenery visibility and transforms, including cottages, trees, bridges, furniture, fences, water, horses and the town kit. Duplicated placeable assets use their saved IDs and placement. Ground tiles and hills provide supporting surfaces; Elevation edits the continuous terrain. Apply rejects unsupported transforms with guidance: shared seats, walkable surfaces and interactive town assets must remain upright, and horses and swings need uniform scale. Inspect fence runs, tree trunks, seats, resident routes and bridge approaches in the local game before a release. The Apply endpoint accepts only same-origin loopback requests and does not ship in the static site.

The code-authored stone bridge has matching open approaches at all four bank-side corners and symmetric parapets, coping and posts. **Stone arch bridge** in Bridges uses the revised mesh and a freshly rendered preview. Selection, placement, rotation, scale and working-copy save/reload were checked in an isolated editor. Playable collision has continuous stone/post clearance and nearby overlap correction; it stays authored in the game. Saved bridge transforms now control the playable geometry, parapet barriers and support floor; keep it upright. [Local checks and images](../../VILLAGE_BUILD.md#2026-09-30-symmetric-bridge-and-corner-collision-local) record the scope; protected presets and the active layout were unchanged.

## Adding artwork

Follow the repository `AGENTS.md`: new village assets must also be exposed to the editor. `world.ts` has an optional `WorldLayoutCapture` callback; the public build still uses its original merged rendering path. Give each logical prop a stable ID, readable name, category and sensible pivot. The studio captures the unmerged props, merges within each editable asset and builds thumbnails. Near trees, willows and shrubs retain individually editable instances. GLB kit registrations live in `model.ts`; shared supplemental prop factories live in `features/village/placeableAssets.ts`. Register runtime placement alongside the editor asset.

Keep saved asset IDs compatible. Do not regenerate protected presets as a side effect of launching the studio. Refreshing the default is an explicit source change; preserve previous designs and verify save/reload compatibility.

## Verification

```bash
npm run typecheck
python3 tools/village-editor/tests/server_test.py
```

Browser verification uses an existing Playwright installation and writes only to a temporary layout directory:

```bash
python3 tools/village-editor/server.py --port 3041 --layouts-dir /tmp/cosy-studio-qa-layouts
PLAYWRIGHT_PATH=/path/to/playwright STUDIO_URL=http://127.0.0.1:3041 node tools/village-editor/tests/browser.cjs
```

The default browser-test evidence directory is `/tmp/cosy-studio-evidence`; set `STUDIO_EVIDENCE` to change it. The test uses Chrome, actual pointer/keyboard controls and a downloaded JSON file. It checks transforms, selection, duplication, locks, paths, history, local saving, reload, presets, malformed imports, text injection and desktop/tablet/phone layouts. The read-only `window.cosyStudio` inspection surface is confined to this local tool. Server tests also cover Apply revision conflicts, backups, supported world layers and rejection of unsupported object edits, alongside the save and origin/host checks.

Focused grass/path/ground/collision smoke check (the same temporary server setup):

```bash
PLAYWRIGHT_PATH=/path/to/playwright STUDIO_URL=http://127.0.0.1:3041 node tools/village-editor/tests/landscape.cjs
```

This checks ground extension, elevated placement, path editing/continuation, erasing planting under a path with one-stroke undo/redo, overlap protection, intentional layering, JSON save/reload and a swept camera collision against a thin rotated wall. It does not run the comprehensive application suite.

Focused editor-action check (use an isolated server and playable file):

```bash
PLAYWRIGHT_PATH=/path/to/playwright STUDIO_URL=http://127.0.0.1:3041 node tools/village-editor/tests/editor-actions.cjs
```

This checks repeated shelf placement, fence drawing/height and playable projection, right-click paste/remove/undo, and local save/reload.

Focused crumb-pouch verification requires an isolated playable file as well as a temporary save directory:

```bash
cp public/village/world-layout.json /tmp/cosy-pouch-playable.json
python3 tools/village-editor/server.py --port 3058 --layouts-dir /tmp/cosy-pouch-layouts --playable-file /tmp/cosy-pouch-playable.json
PLAYWRIGHT_PATH=/path/to/playwright EDITOR_URL=http://127.0.0.1:3058 node tools/village-editor/tests/crumb-pouch.cjs
```

It checks the rendered library preview, transforms, named save/reload, Apply, runtime projection and the protected preset hash.

For the focused swing checks, start `scripts/village/preview_qa.py --port 3091`, then run `PLAYWRIGHT_PATH=/path/to/playwright node scripts/village/tests/swings.cjs`. Start an editor on port 3092 with temporary `--playable-file` and `--layouts-dir` paths, then run `PLAYWRIGHT_PATH=/path/to/playwright EDITOR_URL=http://127.0.0.1:3092 node tools/village-editor/tests/swings.cjs`. Test the static export with `scripts/village/tests/swings-ui.cjs`, setting `VILLAGE_URL` to the local export server. Outputs default to `/tmp/cosy-swings`; set `SWING_EVIDENCE` to retain them elsewhere. Restart previews after source changes.

The public runtime uses per-breed puppy files to avoid loading unused breeds at entry. The editor continues to preview and place all six breeds from the complete original kit; its asset IDs, saved transforms and playable-layout format remain unchanged. Regenerate the runtime subsets with `python3 scripts/village/split_puppies.py` whenever the original puppy model changes. Landscape construction now lives in `features/village/worldLandscape.ts`; its capture hook remains the editor's source for foliage and distant scenery.

## Flat, open maps and complete scenery controls

The active **Flat open village** is a separate named copy. The 360 distant forest trees have been removed from this copy, keeping 42 nearby trees and two willows. Distant trees remain individually placeable, with the first variant on the Nature shelf; old forests become Scene entries named **Distant tree 1…360**. Select a tree in the canvas or Scene list, then move, rotate, scale, hide or remove it; undo and save/reload retain the change. Old grouped forests expand only in working copies, preserving the files behind protected presets and named designs.

**Flatten entire map** resets land elevations to a saved flat base, removes mountain ridges, floating landscape and added hills, grounds vegetation/horses, lowers furniture with the terrain, removes obsolete walkable-area guides, and opens the full 640 m map. The river and pond stay. The action has normal undo/redo. **Explore entire map** separately toggles the village/painted-area movement restriction; the actual ground perimeter, water and solid objects still constrain movement. Earlier sculpted layouts retain their original terrain base.

Captured scenery and supplemental shelf props now use the same pivots/templates in the studio and runtime. Apply supports scenery deletion and duplication as well as transforms; static colliders and shared seats move with their objects. Doves use saved placements, and named resident movement follows saved routes. Moving a resident placement transforms their route; each named resident has one shared identity. Walkable surfaces remain upright. Dynamic sky/weather, visitor avatars and action effects remain runtime systems. The focus interior stays private.

The previous Firefox recovery draft and all existing named designs remain intact. To flatten a recovered draft, use the new whole-map button, then save a new copy. Local Apply writes a backup and requires matching regenerated Worker physics, Worker restart and static rebuild before shared play. No public editor routes or deployment are added. See [verification and limits](../../VILLAGE_BUILD.md#2026-10-03--flat-map-and-editor-owned-scenery-local).

Focused river/tool/play-preview verification (isolated layout and playable file):

```bash
PLAYWRIGHT_PATH=/path/to/playwright STUDIO_URL=http://127.0.0.1:3048 node tools/village-editor/tests/play-tools.cjs
```

This checks readable placement colours, contextual elevation and tool switching, river drawing/continuation/width/undo/save/reload/Apply, rendered runtime geometry and water/navigation refusal, preview collisions, walking/jumping/landing, camera restoration and two laptop viewport sizes. Test Apply only writes the isolated playable file.

The 2026-10-04 local tool/play checks passed at 1280×800 and 1024×700, including 10.82:1 finish-button contrast, actual river geometry/water refusal and untouched layout/camera restoration on preview exit. See the [build ledger](../../VILLAGE_BUILD.md#2026-10-04--editor-tools-and-blob-play-preview-local) for the partial broader multiplayer run and remaining limits.

## Mountain horizon

The editor and **Play preview** share the village sky backdrop: three distant mountain layers in the village’s painted fantasy style, with broad shaded faces, sage foothills, blue/lilac ridges, smaller rocky gullies, fine strata, irregular cream snow and weather-aware colours. These are sky scenery, outside the layout and playable area. Flattening ground or removing old mountain meshes does not remove the horizon. There are no mountain colliders or placeable map objects for this backdrop; it does not change Apply data. Play preview now starts with a lower view across the village, and dragging still adjusts the camera.


## Town farms, horse circuit and woodland animals

Grass, wildflowers and shrubs conform to the actual visible paving/water triangles, including the original captured paths and transformed courtyards. Their whole blade/leaf silhouettes plus wind stay clear; source instances return when a path moves, hides or is undone. Pond-bank reeds/irises/daisies avoid paving while aquatic lilies remain in three near-bank clusters. Both follow saved pond position, rotation and scale at their natural size. The flower border leaves terrace approaches open. A read-only regression uses `PLAYWRIGHT_PATH=/path/to/playwright STUDIO_URL=http://127.0.0.1:3040 node tools/village-editor/tests/planting.cjs`; it makes no Save/Apply requests. [Local visual evidence](../../VILLAGE_BUILD.md#2026-10-04--path-and-water-planting-polish-local).

The **Town** shelf contains the Willow horse circuit, the open two-bay feeding stable, 16 m farm planting rows and the owl roost with its low feeding tray. **Animals** includes the original Blender Highland cow, sheep, smaller lamb, garden hedgehog and tawny owl; **Furnishings** includes a tied hay bale. The garden kit's koi fish is also available as a searchable placeable object. Each asset has a rendered shelf preview and normal selection, placement and scale controls; saving and reloading retains those transforms. Interactive town objects turn with Y rotation and refuse X/Z tilt with clear upright guidance, keeping their shared actions available. Decorative hay and fish retain full rotation. Lamb proportions stay inside its editable pivot. Stable walls and circuit rails use separate collision pieces so their doorways, gates and the racing lane stay open in Play preview.

The working town copy places three large farms with five editable rows each, two Highland cows, two sheep and two lambs on the elevated grazing field, one hedgehog near the existing kitchen garden, and three owls on the woodland roost. Existing layouts and protected presets remain separate. The editor shows still authoring poses; public crop growth, racing, hay feeding, owl meals and animal petting use accepted Worker state in the playable village. Additional animal shelf objects become shared actors when the working layout is applied with matching local Worker physics.

The **Animals** shelf also includes the flower-adorned Highland cow. **Nature** contains the original tiny Blender apple and chestnut mushroom, a matching fruitful apple tree and a small mossy mushroom patch. Fruit and mushrooms retain their native quarter-metre size inside the editable pivot; the scenery batches repeated props into two render draws each. The apple tree has a narrow trunk collider and an open collection point at local `[0,1.8]`; the mushroom patch has no solid collider and a collection point at `[0,.8]`. Apply preserves both new scenery IDs and the girl-cow variant alongside the existing cow.

Original animal/roost source is `assets/village/farm-animals.blend`, generated by `scripts/village/create_farm_animals.py`; mesh dimensions, joints and hashes are recorded in `docs/village/farm-animals-manifest.json`. Static circuit/stable/farm-row/hay source is `assets/village/town-kit.blend`. Local asset portraits are under `docs/village/evidence/*-blender.png`; runtime and multiple-client verification is recorded in the [village build ledger](../../VILLAGE_BUILD.md). These are local changes; publication and physical laptop/Safari/Firefox review remain separate.

Focused town asset verification uses an isolated editor with temporary `--layouts-dir` and `--playable-file` paths:

```bash
PLAYWRIGHT_PATH=/path/to/playwright EDITOR_URL=http://127.0.0.1:3049 OUTPUT_DIR=/tmp/cosy-town-editor node tools/village-editor/tests/town.cjs
```

The check covers the town assets, five forage/girl-cow additions and koi fish: live previews, pointer placement, Scene selection, position/Y rotation/scale, upright guidance, actual GLTF roots and lamb proportions, named save/reload, asset Apply and 1280×800/1024×700 shelf layouts. Set `FORAGE_ONLY=1` to run only the five forage/girl-cow shelf additions plus shared model and save/Apply checks. Its temporary working copy omits resident routes so reusable asset validation can run independently of route verification. It checks hashes of existing named designs, protected presets and the active source layout; Apply only writes the isolated playable file.

Local Chrome verification on 2026-10-04 passed 102 focused assertions across the shelf/save, asset Apply and viewport stages, plus all 12 existing editor-server tests. [Detailed evidence](../../docs/village/evidence/town-expansion-20261004/editor-checks.json) records the reused passing asset checks and the initial full-route Apply refusal at Pip waypoint 10; the layout agent corrected that route separately. Five named designs and both protected presets remained byte-identical. The asset-only Apply wrote a temporary playable file on port 3049; the user's port 3040 was untouched. This asset check does not verify canonical route Apply, shared Worker behavior, physical laptop performance or Safari/Firefox.

The subsequent five-asset forage/girl-cow pass completed 53 focused Chrome assertions and all 12 existing editor-server tests. [Forage editor evidence](../../docs/village/evidence/town-expansion-20261004/forage-assets/editor/editor-checks.json) records native Blender roots, prop dimensions, rendered thumbnails, transforms, save/reload and isolated Apply. All seven protected saved designs/presets and the active source layout remained byte-identical; the temporary asset-only fixture omitted routes and the separately authored meadow zones.

The final canonical 591-object town also passed 13 isolated Chrome checks: all five resident Check route controls, complete import/named save/reload, real Apply200, exact semantic applied contents and backup history. [Canonical evidence](../../docs/village/evidence/town-expansion-20261004/canonical-layout-apply-final/canonical-apply-checks.json) records final layout hash `f131740a97644d7f9285700194b01a55271352e41d0ee4239faf73921590fd84`. Source/export/Worker physics match 1,887 colliders/eight benches; 338 strict route, terrain, water, meadow coverage and preservation checks pass. The user's port 3040 draft and all seven protected designs/presets are preserved. Native 48 m meadow grass/wildflower zones can be selected/transformed/saved like other plants; water/path/soil/race masks are shared with the game.

The **Meadow wildflowers** shelf thumbnail shows a close cloned 24-flower cluster so cream/pastel heads and stems remain recognizable at laptop sizes. Placement still uses the full native 48 m zone; both 120-instance meshes and their matrices/colors/bounds remain unchanged. `MEADOW_THUMBNAIL_ONLY=1` runs a read-only mode of `tests/town.cjs`: [eight Chrome checks](../../docs/village/evidence/town-expansion-20261004/meadow-thumbnail-review/editor-checks.json) cover the preview, exact native data, 1280×800/1024×700 framing, no API writes and protected-file preservation. Fresh typecheck passed. The normal local editor on 3040 was restarted with this final source; restart it after future source edits.
