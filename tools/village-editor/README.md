# Cosy Layout Studio

A private map editor using the village’s actual Three.js artwork. It runs outside Next.js, binds to your computer’s loopback address, and is excluded from the public static export. It uses the project’s existing TypeScript and Three.js installation plus Python 3; no new dependencies are required. Paths, oak fence lines, meadow grass, trees, walkable areas, oak meadow benches, crumb pouches, existing cottage/spire positions and resident routes feed the playable scene through `public/village/world-layout.json`.

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

The studio opens a working copy of **Playable village**, the local game's current 356-object layout: the saved **My village** design plus six newer low stone lanterns, four neighbourhood dogs and the bench-side crumb pouch. It includes the eastern Sunrise meadow and four moonlit lampposts. All six dog breeds remain in the asset library. The named My village copy remains unchanged. Every protected preset still opens as a new working copy. Choosing another layout is undoable, and the browser cannot write to presets. The current default was refreshed at the user’s request after the new garden and bird work; the earlier snapshot was retained. These JSON files preserve layout transforms and reference the shared asset kit, so future artwork updates can change an asset’s appearance while its placement stays preserved.

**Save layout** writes a named JSON file under `tools/village-editor/layouts/`. A browser recovery draft is kept after each edit. **Save current as a new copy** creates another file. **Export JSON** downloads a portable copy; **Import JSON** validates a file before replacing the working view. Saved layouts and their previous versions are ignored by Git.

Writes are atomic. Previous file contents are retained under `layouts/.history/`; restore one by importing it, then saving a copy. Revision checks reject stale saves from another tab instead of silently overwriting them. A failed save leaves the open design available for export. Browser drafts are local to the browser origin and shared across tabs on that origin; named files are the durable source of truth. Changing the port changes the browser-draft origin, but all ports use the same local layout directory by default.

## Editing

The shelf includes **Cream & caramel cottage cat** under Animals, **Sage linen couch**, **Pleated reading lamp**, **Framed botanical print** and **Cat’s woven nap cushion** under Furnishings, and **Fern in ceramic pot** under Nature. Each has a rendered preview and supports selection, position, rotation, scale, named save and reload. Cat behavior runs only in the private focus cottage; the editor displays a still model. These assets can be kept in editor working copies, but Apply cannot move/add the private code-authored room assembly. Protected layouts are unchanged.

The cottage window-wall refresh adds **Cushioned oak writing chair**, **Clothbound cottage books**, **Hand-thrown glazed pottery**, **Oak cottage book shelf** and **Oak cottage pottery shelf** under Furnishings. Both shelves include their displayed contents; books and pottery are also available separately. **Bridge-view cottage window** stays under Buildings with its existing asset ID, a larger pane and no curtains. Its existing saved transforms remain compatible. [Local verification](../../VILLAGE_BUILD.md#2026-09-30--focus-cottage-window-wall-and-comfy-chair-local) uses temporary layout storage and preserves the playable layout and protected presets.

Choose an asset from the rendered shelf, then click the ground. The asset stays active so each further click places another copy; use `[` and `]` to turn the placement preview. Escape or choosing another tool stops placement.

Click an object, or use **Scene** to search and select it. Shift-click adds individual objects; Shift-drag adds every visible, unlocked object whose bounds overlap the selection rectangle. Right-click an object for Cut, Copy, Duplicate, Focus or Remove; right-click empty ground to Paste here. The same menu offers Undo/Redo, while right-drag still pans. Use Cut/Copy/Paste or Cmd/Ctrl+X/C/V on a group. Keyboard and inspector paste places it at the centre of the current view; context-menu paste uses the clicked ground point. Relative positions, rotations and scales are preserved. Repeated pastes are offset by 2 m; the studio clipboard survives reload and stays separate from the system text clipboard. Cuts and pastes are undoable. The move, rotate and scale handles work in world or local coordinates; the inspector also accepts precise X/Y/Z values, uniform scaling and quick yaw turns. Use **Focus** to frame a selection, **Set on ground** to restore terrain elevation, and Duplicate/Remove with undo/redo. Locked scenery remains selectable in the Scene list and can be unlocked in the inspector. Hide large scenery layers there when working underneath them.

**Paths** in the asset library includes ready-made **Straight limestone path** and **Curved limestone path** pieces. Place one, then set its length and width in the inspector, switch between straight segments and a smooth curve, or **Extend by 5 m** along its last segment. **Continue on map** lets you click more points onto the same path; Finish/Enter accepts and Escape cancels. The toolbar's **Path** draws a new path with one drag or a curve through multiple clicks. Select a path and drag its yellow points to reshape it or its blue handle to change width. Paths follow the terrain and placed ground surfaces, and their points and width survive saving and reloading. A playable path uses upright rotation and even horizontal scaling; use the path controls for length and width.

**Fence** in the toolbar or **Oak fence line** in Furnishings uses the same drag or click-points workflow. Select a fence to move its yellow corner points, set a precise length (up to 300 m) or height (0.3–3 m), extend by 5 m, or continue it on the map. The fence follows the terrain and blocks movement in the local game after Apply. Its points and height survive saving and reloading. A playable fence uses upright rotation, even horizontal scaling and 1× vertical scale; use Height to resize it vertically.

**Nature** includes a grass tuft, a 6 m meadow patch and a 14 m wide patch using the village's wind-animated grass. Patches follow the ground and now fade at their circular edges. Use the **Grass** toolbar brush to paint them with a drag; choose Fine, Medium or Wide under Placement. Grass is cleared beneath editable paths and solid props in the authoring view, and returns when those objects move away. The playable world also clears painted grass from paths and colliders.

Use **Erase** in the toolbar to clear meadow grass and decorative lane wildflowers at the cursor, including plants under a footpath. Choose Fine, Medium or Wide under **Erase size**, then click or drag. The path and grass patch objects stay in place; Erase saves a small clearing area instead of deleting either object. A drag is one undo step. Saved clearing rings stay hidden during normal editing; selecting a clearing in **Scene** reveals its ring so it can be adjusted or removed. The Erase cursor still shows the brush size. Save the working copy to keep the clearing, or **Apply to local game** to use it in a local playable preview. Erase does not change the interactive kitchen garden, its flower beds or other props.

**Walkable meadow area** in Landscape expands where the spirit and residents can travel; its X/Z scale and yaw shape an ellipse. It marks movement space over the existing valley terrain rather than creating new terrain geometry. The active eastern area connects to the old boundary. **Oak meadow bench** in Furnishings is a reusable playable seat with collision and scaled seat height. Trees, grass, paths, this bench and the walkable area use their saved transforms in the local game.

**Sourdough crumb pouch** in Furnishings is the small cloth drawstring bag beside the birdwatching bench. It has a rendered shelf preview and supports placement, position, full XYZ rotation, nonuniform scale, duplication and visibility. Save/reload preserves these values; **Apply to local game** carries them into the playable scene. Its placement is visual; the seated F action stays attached to the birdwatching bench. Protected presets and existing named working copies remain unchanged.

**Resident routes** in the right panel lets you choose Pip, Maple, Moss, Luma or Wren, add waypoints on the map, set a pause at each point, remove points, and check reachability using the playable movement rules. The route line appears while adding points. Roads receive a modest travel preference; residents can still cross clear meadow. Save or Apply to keep authored routes.

**Puppies** contains Mochi the corgi, Kiko the Shiba Inu, Biscuit the beagle, Cloud the Samoyed, Fern the Border Collie and Atlas the German Shepherd. Their rendered shelf previews use the same Blender skins as the game. Place additional dogs or select any of the four current instances to move, rotate, scale, rename or hide; save/reload keeps the edit, and **Apply to local game** carries it into the playable layout. `puppy-collie` and `puppy-shepherd` join the original four compatible asset IDs. Every instance gets an independent 26-bone skeleton and all ten clips in the game; the studio shows a still standing pose. Residents use the restored original blob artwork with small movable fins, matching the game’s v3 model. The model replacement preserves existing resident asset IDs and placement controls. [Pack and editor checks](../../VILLAGE_BUILD.md#2026-09-30-six-dogs-pack-walks-and-articulated-blob-hands-local) cover previews, placement, saved transforms and isolated Apply with protected presets unchanged. The playable copy uses four widely spaced dogs: Mochi in Sunrise meadow, Kiko by the tea-garden lanes, Biscuit on the western pond approach and Cloud on the northern lane. Their 31–55 m patrols remain relative to their placement and facing; moving or rotating a dog moves or turns its whole circuit. Additional collies and shepherds remain available from the shelf. Place dogs on clear, walkable ground and check the longer circuit after moving them. Protected presets and named copies are unchanged. Pack invitations and petting run in the game; approach and invite dogs individually. [Small-arm correction and local checks](../../VILLAGE_BUILD.md#2026-09-30-small-blob-arms-and-collecting-dogs-local).

**Landscape** includes 20 m and 40 m meadow ground tiles, a gentle grassy hill, the round meadow platform and floating gardens. Place a tile, then use its **Expand ground** north/east/south/west buttons to add matching pieces edge-to-edge. Scale X/Z independently for custom dimensions. These pieces can extend beyond the original terrain, within the studio's 1,500 m placement range. **Set on ground**, new object placement and camera height recognize the added surfaces.

**Avoid solid overlaps** is on by default. Placing or transforming a solid into another solid is rejected without losing the working layout, and invalid placement previews turn red. Buildings, bridges, benches, fences, lanterns, tree trunks, rocks and selected solid furnishings use rotation-aware bounds. Existing intersections can be moved apart. Ground pieces, paths and planting can overlap; turn the checkbox off for other intentional layering. The camera uses swept collision against solid bounds and stays above supporting terrain, including added ground. These are editor collision volumes, not full mesh physics or playable-map integration.

The existing kitchen garden and pond life are a locked assembly by default. Individual flowers, plants, animals, a raised bed and the basket are also available as placeable assets. Residents and doves are posed objects in the authoring view. The editor does not read or modify saved player notes, timers, garden progress or preferences.

**Meadow swing set · two seats** is a reusable Furnishings asset with a rendered preview. The active Sunrise meadow swings replace the former far-right bench; protected presets and named saved copies keep their original bench placements. Select, move, rotate around Y, uniformly scale, save and reload the set. **Apply to local game** carries visible/hidden instances and their position/facing/scale into runtime geometry, support collision and independent swing physics. Apply rejects X/Z tilt and nonuniform scaling; leave equal X/Y/Z scales so the chain's physical length and period remain coherent. The studio displays a still pose; E, W/S, Space and exit controls run in the game. Leave the full 3.3 m arc clear of obstacles. [Local engine/editor checks and limits](../../VILLAGE_BUILD.md#2026-09-30-meadow-swings-and-13-inch-scene-space-local). Shared swing occupancy requires an accepted seat claim and motion is rendered for other visitors; a busy seat cannot be taken. The [local ownership audit](../../VILLAGE_BUILD.md#2026-09-30-shared-world-ownership-audit-local) records the matching Worker/client checks and release limits.

**Low stone lantern** is a reusable Furnishings asset with a lit night preview. The six garden and pond instances can be selected, moved, rotated, scaled, saved and reloaded in a working copy. Their playable positions are still authored in `world.ts`, so **Apply to local game** rejects changes to these instances until prop transforms become a supported runtime layer. Keep edited placements in a named working copy.

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

The game now reads position and facing for its seven existing cottages and the village spire, plus new authored fence lines. It still owns their artwork, legacy roadside fence pieces, bridges, activity anchors, garden interactions, cameras and most legacy scenery in code. Apply rejects unsupported transforms instead of silently ignoring them: existing cottages/spire must stay visible at 1× scale, and arbitrary new buildings or edited legacy props remain working-copy only. New editor ground tiles and hills are visual authoring surfaces only; playable terrain sculpting and general prop integration remain future engine work. Editor collision uses oriented bounds; inspect paths, fence runs, tree trunks, seats and bridge approaches in the local game before a release. The Apply endpoint accepts only same-origin loopback requests and does not ship in the static site.

The code-authored stone bridge has matching open approaches at all four bank-side corners and symmetric parapets, coping and posts. **Stone arch bridge** in Bridges uses the revised mesh and a freshly rendered preview. Selection, placement, rotation, scale and working-copy save/reload were checked in an isolated editor. Playable collision has continuous stone/post clearance and nearby overlap correction; it stays authored in the game. Working-copy bridge transforms remain unsupported by Apply. [Local checks and images](../../VILLAGE_BUILD.md#2026-09-30-symmetric-bridge-and-corner-collision-local) record the scope; protected presets and the active layout were unchanged.

## Adding artwork

Follow the repository `AGENTS.md`: new village assets must also be exposed to the editor. `world.ts` has an optional `WorldLayoutCapture` callback; the public build still uses its original merged rendering path. Give each logical prop a stable ID, readable name, category and sensible pivot. The studio captures the unmerged props, merges within each editable asset and builds thumbnails. Near trees, willows and shrubs retain individually editable instances. GLB kit registrations and additional editor primitives live in `model.ts`.

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
