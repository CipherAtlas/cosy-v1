# Cosy Layout Studio

A private map editor using the village’s actual Three.js artwork. It runs outside Next.js, binds to your computer’s loopback address, and is excluded from the public static export. It uses the project’s existing TypeScript and Three.js installation plus Python 3; no new dependencies are required. Paths, oak fence lines, meadow grass, trees, walkable areas, oak meadow benches, existing cottage/spire positions and resident routes feed the playable scene through `public/village/world-layout.json`.

```bash
npm run dev:editor
```

Open **http://127.0.0.1:3040**. To choose another port:

```bash
npm run dev:editor -- --port 3042
```

Keep the process running while editing. Restart it after source changes; ordinary layout saves do not require a restart. Existing village previews can keep running on their own ports.

## Your defaults and working copies

- **Current village:** the updated village, including the garden, harvest basket, bird-clearing approach/terrace/bench/flowers/feeding dish, twelve white doves and all five residents. The 252-object layout is saved in `presets/current-village.json`.
- **Riverside retreat:** four cottages gathered along the river.
- **Open meadow:** the valley scenery, ready for a new composition.
- **Original snapshot:** the earlier 231-object layout, retained in `presets/original-village.json`.

The studio opens a working copy of **Playable village**, the local game's current 351-object layout: the saved **My village** design plus six newer low stone lanterns around the kitchen garden and willow pond. It includes the eastern Sunrise meadow and four moonlit lampposts. The named My village copy remains unchanged. Every protected preset still opens as a new working copy. Choosing another layout is undoable, and the browser cannot write to presets. The current default was refreshed at the user’s request after the new garden and bird work; the earlier snapshot was retained. These JSON files preserve layout transforms and reference the shared asset kit, so future artwork updates can change an asset’s appearance while its placement stays preserved.

**Save layout** writes a named JSON file under `tools/village-editor/layouts/`. A browser recovery draft is kept after each edit. **Save current as a new copy** creates another file. **Export JSON** downloads a portable copy; **Import JSON** validates a file before replacing the working view. Saved layouts and their previous versions are ignored by Git.

Writes are atomic. Previous file contents are retained under `layouts/.history/`; restore one by importing it, then saving a copy. Revision checks reject stale saves from another tab instead of silently overwriting them. A failed save leaves the open design available for export. Browser drafts are local to the browser origin and shared across tabs on that origin; named files are the durable source of truth. Changing the port changes the browser-draft origin, but all ports use the same local layout directory by default.

## Editing

Choose an asset from the rendered shelf, then click the ground. The asset stays active so each further click places another copy; use `[` and `]` to turn the placement preview. Escape or choosing another tool stops placement.

Click an object, or use **Scene** to search and select it. Shift-click adds individual objects; Shift-drag adds every visible, unlocked object whose bounds overlap the selection rectangle. Right-click an object for Cut, Copy, Duplicate, Focus or Remove; right-click empty ground to Paste here. The same menu offers Undo/Redo, while right-drag still pans. Use Cut/Copy/Paste or Cmd/Ctrl+X/C/V on a group. Keyboard and inspector paste places it at the centre of the current view; context-menu paste uses the clicked ground point. Relative positions, rotations and scales are preserved. Repeated pastes are offset by 2 m; the studio clipboard survives reload and stays separate from the system text clipboard. Cuts and pastes are undoable. The move, rotate and scale handles work in world or local coordinates; the inspector also accepts precise X/Y/Z values, uniform scaling and quick yaw turns. Use **Focus** to frame a selection, **Set on ground** to restore terrain elevation, and Duplicate/Remove with undo/redo. Locked scenery remains selectable in the Scene list and can be unlocked in the inspector. Hide large scenery layers there when working underneath them.

**Paths** in the asset library includes ready-made **Straight limestone path** and **Curved limestone path** pieces. Place one, then set its length and width in the inspector, switch between straight segments and a smooth curve, or **Extend by 5 m** along its last segment. **Continue on map** lets you click more points onto the same path; Finish/Enter accepts and Escape cancels. The toolbar's **Path** draws a new path with one drag or a curve through multiple clicks. Select a path and drag its yellow points to reshape it or its blue handle to change width. Paths follow the terrain and placed ground surfaces, and their points and width survive saving and reloading. A playable path uses upright rotation and even horizontal scaling; use the path controls for length and width.

**Fence** in the toolbar or **Oak fence line** in Furnishings uses the same drag or click-points workflow. Select a fence to move its yellow corner points, set a precise length (up to 300 m) or height (0.3–3 m), extend by 5 m, or continue it on the map. The fence follows the terrain and blocks movement in the local game after Apply. Its points and height survive saving and reloading. A playable fence uses upright rotation, even horizontal scaling and 1× vertical scale; use Height to resize it vertically.

**Nature** includes a grass tuft, a 6 m meadow patch and a 14 m wide patch using the village's wind-animated grass. Patches follow the ground and now fade at their circular edges. Use the **Grass** toolbar brush to paint them with a drag; choose Fine, Medium or Wide under Placement. Grass is cleared beneath editable paths and solid props in the authoring view, and returns when those objects move away. The playable world also clears painted grass from paths and colliders.

Use **Erase** in the toolbar to clear meadow grass and decorative lane wildflowers at the cursor, including plants under a footpath. Choose Fine, Medium or Wide under **Erase size**, then click or drag. The path and grass patch objects stay in place; Erase saves a small clearing area instead of deleting either object. A drag is one undo step. Saved clearing rings stay hidden during normal editing; selecting a clearing in **Scene** reveals its ring so it can be adjusted or removed. The Erase cursor still shows the brush size. Save the working copy to keep the clearing, or **Apply to local game** to use it in a local playable preview. Erase does not change the interactive kitchen garden, its flower beds or other props.

**Walkable meadow area** in Landscape expands where the spirit and residents can travel; its X/Z scale and yaw shape an ellipse. It marks movement space over the existing valley terrain rather than creating new terrain geometry. The active eastern area connects to the old boundary. **Oak meadow bench** in Furnishings is a reusable playable seat with collision and scaled seat height. Trees, grass, paths, this bench and the walkable area use their saved transforms in the local game.

**Resident routes** in the right panel lets you choose Pip, Maple, Moss, Luma or Wren, add waypoints on the map, set a pause at each point, remove points, and check reachability using the playable movement rules. The route line appears while adding points. Roads receive a modest travel preference; residents can still cross clear meadow. Save or Apply to keep authored routes.

**Landscape** includes 20 m and 40 m meadow ground tiles, a gentle grassy hill, the round meadow platform and floating gardens. Place a tile, then use its **Expand ground** north/east/south/west buttons to add matching pieces edge-to-edge. Scale X/Z independently for custom dimensions. These pieces can extend beyond the original terrain, within the studio's 1,500 m placement range. **Set on ground**, new object placement and camera height recognize the added surfaces.

**Avoid solid overlaps** is on by default. Placing or transforming a solid into another solid is rejected without losing the working layout, and invalid placement previews turn red. Buildings, bridges, benches, fences, lanterns, tree trunks, rocks and selected solid furnishings use rotation-aware bounds. Existing intersections can be moved apart. Ground pieces, paths and planting can overlap; turn the checkbox off for other intentional layering. The camera uses swept collision against solid bounds and stays above supporting terrain, including added ground. These are editor collision volumes, not full mesh physics or playable-map integration.

The existing kitchen garden and pond life are a locked assembly by default. Individual flowers, plants, animals, a raised bed and the basket are also available as placeable assets. Residents and doves are posed objects in the authoring view. The editor does not read or modify saved player notes, timers, garden progress or preferences.

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

Perspective, top-down view, a ground grid, position/rotation snapping, four lighting previews (including Starlit night) and an uncluttered Preview mode are available. Preview always has a visible **Back to editor** button; Escape also returns.

**Moonlit path lamppost** is a reusable Furnishings asset with a rendered shelf preview. Place it in a working copy, then select, move, rotate or scale it like other props; those transforms are stored in the layout JSON. The playable scene also has four new lamps near the bridge, tea garden, bird clearing and pond. Protected presets remain unchanged and do not gain those positions automatically.

## Integration boundary

**Save layout** keeps an editable local working file. **Apply to local game** writes `public/village/world-layout.json` after a reachability check, revision check, server validation and backup under `layouts/.history/`. Reload a local game preview to see the result. The original presets and saved working copies are not rewritten by Apply. Path, fence, planting, eraser clearing, tree, bench, walkability, cottage/spire position and route data then drive the local runtime; a normal build and release would be required before any visitor sees it.

The game now reads position and facing for its seven existing cottages and the village spire, plus new authored fence lines. It still owns their artwork, legacy roadside fence pieces, bridges, activity anchors, garden interactions, cameras and most legacy scenery in code. Apply rejects unsupported transforms instead of silently ignoring them: existing cottages/spire must stay visible at 1× scale, and arbitrary new buildings or edited legacy props remain working-copy only. New editor ground tiles and hills are visual authoring surfaces only; playable terrain sculpting and general prop integration remain future engine work. Editor collision uses oriented bounds; inspect paths, fence runs, tree trunks, seats and bridge approaches in the local game before a release. The Apply endpoint accepts only same-origin loopback requests and does not ship in the static site.

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
