# Riverbank stone grounding — October 7, 2026

Automatic river stones now sample actual transformed terrain and pond-bank triangles. A temporary 4 m triangle index is built during scenery preparation; there are no added per-frame queries. Placement moves farther onto a lowered bank when necessary, uses each rotated/scaled rock's lower vertices to find contact, and embeds it 5.5–10 cm. Lateral position, spacing, size, yaw and tilt are deterministic and varied. Paths and water confluences stay open. Clipped rivers may have different bank sample counts; outward directions now follow each bank independently.

The same helper is used by the game and local editor. Existing asset IDs, independent Small riverbank stone controls, transforms, saved layouts and Worker behavior remain unchanged. No source layout, saved design, preset, physics or dependency changes.

Verification:

- Final `npm run check` passes: lint, application/Worker types and all current fast contracts (`project-check.log`).

- 18 isolated Chrome editor checks pass: library preview, 2/6/18 m widths, transformed rivers, deterministic dressing, path/junction clearance, sloped grounding, unequal clipped banks, edited width/bends/position, independent stone controls and named-save/reload.
- Independent raycasts find all 91 test stones contacting a transformed sloping mesh with 5.55–9.94 cm penetration even when the original height callback incorrectly returns 8 m.
- `river-bank.png` and `river-bank-close.png` show the production-module village with the current riverbank helper. The existing QA server's other compiled modules are retained; only this helper is overridden in the test browser. These are focused source-change captures, not a final integrated export or deployed proof. The player is hidden only in the captures to expose the bank.
- Short 1366×768 Detailed Chrome154 / AppleM4 samples reach 60 FPS, full shadows, no captured errors (`runtime.json`). This does not establish sustained native Firefox/iPad performance or a speedup.

The user's preview on3051 and the main chat's waterfall/water-join work are left running. This side fix is in shared source and needs inclusion in the main chat's next integrated build/preview refresh. The isolated editor uses3134 and temporary layout/playable paths; no public editor route was added. No Git writes or deployment.
