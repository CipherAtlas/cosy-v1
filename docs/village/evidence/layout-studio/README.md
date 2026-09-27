# Local layout studio evidence — 2026-09-27

This is the actual standalone local editor, using shared village assets. It is not a public application route or a concept rendering.

- [Overview](editor-overview.png): 1600×1000, asset library and current 252-object village.
- [Cottage transform handle](editor-house-transform.png): actual editable cottage with move gizmo and inspector.
- [Default layouts](editor-presets.png): current village, riverside retreat, open meadow and original snapshot; each opens a working copy.
- [Latest bird clearing](editor-bird-clearing.png): terrace, feeding dish, border, bench, Wren and twelve posed doves included in the default.
- [Tablet](editor-tablet.png): 1024×768.
- [Phone](editor-phone.png): 390×844; inspector moves below the scene and can scroll.
- [Forty browser assertions](browser-checks.json): Chrome 154.0.8037.57, isolated profile and temporary layout directory on port 3041, no JavaScript/renderer errors.

The browser suite uses real pointer/keyboard interactions for picking, dragging a transform handle, numeric edits, undo/redo, duplication, locking, multiple selection, bridge placement and path creation/editing. It also checks named disk saving, browser recovery, downloaded JSON, independent presets, malformed imports and literal handling of imported names. Both the initial working copy and the protected default transforms are checked. Clean screenshots were captured separately on port 3040 using a fresh browser context.

Six Python server tests cover protected presets, input limits, duplicate IDs, origin/host checks, atomic save files, previous versions, revision conflicts and unreadable-file preservation. TypeScript, full static export and thirteen movement/bridge regression checks pass. See [the ledger](../../../../VILLAGE_BUILD.md#2026-09-27-local-layout-studio) and [reproduction commands](../../../../tools/village-editor/README.md#verification).

The earlier snapshot contains 231 objects. At the user's explicit request the current default was refreshed to 252 objects, including ongoing garden/bird work. The JSON files preserve transforms and use the current shared artwork; they do not freeze historical geometry. Browser editing cannot overwrite either preset.

Saved layouts are visual authoring documents. They do not automatically update playable-world collisions, walkable bridges, activity anchors or resident routes. Actors are posed in the editor. Tests do not establish physical-touch behavior, Firefox/Safari compatibility or sustained device performance. No editor deployment was performed.

## Grass, paths and map expansion follow-up

[Expanded ground and an edited path](editor-ground-paths.png) shows the local editor with two connected, elevated 40 m ground tiles, a grass patch and a lengthened curved path. `tools/village-editor/tests/landscape.cjs` passes eight focused groups covering placement/expansion, grass on elevated ground, path shape/length/width/continuation, collision rejection/grounding, intentional layering/undo, exact save/reload, a thin rotated-wall camera sweep and empty JavaScript/renderer error logs. Typecheck and six server tests also pass. This follow-up did not rerun the comprehensive application suite or production build.
