# Cosy Layout Studio

A private visual map editor using the village’s actual Three.js artwork. It runs outside Next.js, binds to your computer’s loopback address, and is excluded from the public static export. It uses the project’s existing TypeScript and Three.js installation plus Python 3; no new dependencies are required.

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

Every preset opens as a new working copy. Choosing another layout is undoable. The browser cannot write to presets. The current default was refreshed at the user’s request after the new garden and bird work; the earlier snapshot was retained. These JSON files preserve layout transforms and reference the shared asset kit, so future artwork updates can change an asset’s appearance while its placement stays preserved.

**Save layout** writes a named JSON file under `tools/village-editor/layouts/`. A browser recovery draft is kept after each edit. **Save current as a new copy** creates another file. **Export JSON** downloads a portable copy; **Import JSON** validates a file before replacing the working view. Saved layouts and their previous versions are ignored by Git.

Writes are atomic. Previous file contents are retained under `layouts/.history/`; restore one by importing it, then saving a copy. Revision checks reject stale saves from another tab instead of silently overwriting them. A failed save leaves the open design available for export. Browser drafts are local to the browser origin and shared across tabs on that origin; named files are the durable source of truth. Changing the port changes the browser-draft origin, but all ports use the same local layout directory by default.

## Editing

Choose an asset from the rendered shelf, then click the ground. Hold Shift while placing to add several copies; use `[` and `]` to turn the placement preview. Escape cancels.

Click an object, or use **Scene** to search and select it. Shift-click adds individual objects; Shift-drag adds every visible, unlocked object whose bounds overlap the selection rectangle. Use Cut/Copy/Paste or Cmd/Ctrl+X/C/V on the group. Pasting places it at the centre of the current view while preserving relative positions, rotations and scales. Repeated pastes are offset by 2 m; the studio clipboard survives reload and stays separate from the system text clipboard. Cuts and pastes are undoable. The move, rotate and scale handles work in world or local coordinates; the inspector also accepts precise X/Y/Z values, uniform scaling and quick yaw turns. Use **Focus** to frame a selection, **Set on ground** to restore terrain elevation, and Duplicate/Remove with undo/redo. Locked scenery remains selectable in the Scene list and can be unlocked in the inspector. Hide large scenery layers there when working underneath them.

**Paths** in the asset library includes ready-made **Straight limestone path** and **Curved limestone path** pieces. Place one, then set its length and width in the inspector, switch between straight segments and a smooth curve, or **Extend by 5 m** along its last segment. **Continue on map** lets you click more points onto the same path; Finish/Enter accepts and Escape cancels. The toolbar's **Path** still draws a new freeform route. Paths follow the terrain and placed ground surfaces, and their points remain editable after saving.

**Nature** includes a grass tuft, a 6 m meadow patch and a 14 m wide patch using the village's wind-animated grass. Patches follow the ground. Grass is cleared beneath editable paths and solid props in the authoring view, and returns when those objects move away.

**Landscape** includes 20 m and 40 m meadow ground tiles, a gentle grassy hill, the round meadow platform and floating gardens. Place a tile, then use its **Expand ground** north/east/south/west buttons to add matching pieces edge-to-edge. Scale X/Z independently for custom dimensions. These pieces can extend beyond the original terrain, within the studio's 1,500 m placement range. **Set on ground**, new object placement and camera height recognize the added surfaces.

**Avoid solid overlaps** is on by default. Placing or transforming a solid into another solid is rejected without losing the working layout, and invalid placement previews turn red. Buildings, bridges, benches, fences, lanterns, tree trunks, rocks and selected solid furnishings use rotation-aware bounds. Existing intersections can be moved apart. Ground pieces, paths and planting can overlap; turn the checkbox off for other intentional layering. The camera uses swept collision against solid bounds and stays above supporting terrain, including added ground. These are editor collision volumes, not full mesh physics or playable-map integration.

The existing kitchen garden and pond life are a locked assembly by default. Individual flowers, plants, animals, a raised bed and the basket are also available as placeable assets. Residents and doves are posed objects in the authoring view. The editor does not read or modify saved player notes, timers, garden progress or preferences.

| Control | Action |
| --- | --- |
| Drag / right-drag / scroll | Orbit / pan / zoom |
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
| P / Enter / Escape | Draw path / finish / cancel |

Scroll zoom is faster and follows the cursor. Camera movement and panning stay at least 1.5 m above supporting ground; typing in fields does not move the camera. Camera collision remains active when intentional object layering is enabled. Existing saved layouts and protected presets are loaded without rearranging their objects.

Perspective, top-down view, a ground grid, position/rotation snapping, three lighting previews and an uncluttered Preview mode are available. Preview always has a visible **Back to editor** button; Escape also returns.

## Integration boundary

This is a visual layout authoring tool. Saved layouts load through `LayoutScene` in the studio. Saving or previewing a layout **does not replace the public game’s map**. The game’s collision surfaces, bridge walkability, activity anchors, garden interactions and resident routes remain authored in the existing game modules; arbitrarily transformed copies do not acquire new gameplay behavior. Terrain sculpting and automatic navigation baking are not implemented. Editor collision uses conservative oriented bounds rather than the playable game’s collision system; inspect doorways, paths and bridge approaches visually.

This separation keeps map experiments reversible while preserving the current game. Applying an edited design to the playable village requires a separate integration pass for those movement/activity systems, followed by its normal testing and release process.

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

The default browser-test evidence directory is `/tmp/cosy-studio-evidence`; set `STUDIO_EVIDENCE` to change it. The test uses Chrome, actual pointer/keyboard controls and a downloaded JSON file. It checks transforms, selection, duplication, locks, paths, history, local saving, reload, presets, malformed imports, text injection and desktop/tablet/phone layouts. The read-only `window.cosyStudio` inspection surface is confined to this local tool. Server tests cover stale revisions, atomic saves, backups, protected presets, invalid data and origin/host restrictions.

Focused grass/path/ground/collision smoke check (the same temporary server setup):

```bash
PLAYWRIGHT_PATH=/path/to/playwright STUDIO_URL=http://127.0.0.1:3041 node tools/village-editor/tests/landscape.cjs
```

This checks ground extension, elevated placement, path editing/continuation, overlap protection, intentional layering/undo, JSON save/reload and a swept camera collision against a thin rotated wall. It does not run the comprehensive application suite.
