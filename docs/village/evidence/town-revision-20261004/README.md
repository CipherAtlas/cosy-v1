# Town interaction and layout revision — 2026-10-04 local

These captures use the local exported game and local Worker, or the isolated local editor as identified below. They do not show a production deployment. [The build ledger](../../../../VILLAGE_BUILD.md#2026-10-04--town-interaction-and-layout-revision-local) records current behavior, source checks and remaining limits.

| Evidence | What it verifies |
| --- | --- |
| [Physical layout](physical-layout-checks.json) | 400 checks, final 595-object layout and exact renderer/Worker collision parity |
| [Grass/fixture audit](grass-fixture-checks.json) | 29 checks of actual paving/water triangles: 24 light fixtures, two swing envelopes and Bramble/orchard footprints |
| [Editor persistence](editor-save-checks.json) | 13 isolated import/save/reload/Apply checks, with seven protected designs unchanged |
| [Cottage landing](editor-cottage-landing.png) | The reachable lane meets the rotated Meadow cottage front step |
| [River capture](river-game-capture.json), [1366 px](river-1366.png), [1024 px](river-1024.png) | The original blue river remains visible beside the enlarged pond in the actual exported game |
| [Animal interactions](animal-browser-checks.json), [cow](pet-cow.png), [Bramble](pet-bramble.png) | 35 two-client rendered checks of accepted motion, petting, meals, species captions and effect routing |
| [Final owl response](owl-final-checks.json), [1366 px](owl-hearts-1366.png), [1024 px](owl-hearts-1024.png) | Seven checks of staggered readable hoot responses and hearts after the final caption timing change |
| [Map and basket](map-inventory-checks.json), [1366 px](map-1366.png), [1024 px](map-1024.png), [basket](inventory.png) | 19 checks at 1366×768, 1280×720 and 1024×640; authored districts/water/crossings, moving named NPC/dog markers and all eight inventory counts |

[Fresh three-client ownership checks](ownership-checks.json) pass all 26 assertions with zero page errors: dog/NPC ownership and contention, shared clips/following, full benches, leaving/disconnect/reconnect and simultaneous private focus. [Shared dog](shared-dog.png) shows the actual accepted trick. Short rendered observer checks explicitly foreground their tab so browser background frame throttling does not skip the accepted animation. [Private resource/farm/Retry](resource-checks.json) passes 30 checks. [The actual eight-gate race](race-checks.json) passes 17, and [final HUD spacing](hud-checks.json) passes 13 after narrowing the 1024 px HUD. [Race1366](racing.png), [race1024](racing-1024.png), [farm1024](farm-growth-1024.png) and [farm after the lap](farm-after-race.png) show the final controls. [Both swing copies](swing-checks.json) pass 19 three-client checks of separate seats, real W pumping, full-set refusal, release and reconnect. The unchanged complete lap/resource/ownership results were reused across the final CSS-only spacing correction. Gameplay models remain the existing animated rigs; the separate static animal-art catalog is documented in [Animal Art](../../ANIMAL_ART.md).

Physical laptop GPU/thermal cost, Firefox/Safari, crowded or long sessions, live behavior and human speaker/headphone judgment of the synthesized calls remain unverified. No Git writes or publication occurred.
