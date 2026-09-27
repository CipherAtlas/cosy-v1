# Sunflowers and harvest basket — 2026-09-27

This side-conversation addition is implemented locally and is **not committed or deployed**. It was developed in an isolated copy while the main chat completed its tea/daisy release, then reconciled with that release. The main chat's tea approach and 2.4 m daisy interaction radius are preserved.

## Behavior

- The original thirteen sunflowers face the directional light's horizontal direction while keeping their stems upright. Their narrow limestone border stays in place.
- Sunflowers use a seventh saved bed: harvest → plant → water → grow for five minutes → harvest. The sign and activity controls show the same countdown as other crops. Growth continues away from the village; ripe flowers never expire. The entire row is approachable, including both ends.
- A basket at `(17.3, -3.2)` sits on the grass between the cottage and garden path, matching the screenshot area. Its full collision bounds stay off the path; meadow blades are cleared immediately around it.
- All crop harvests animate into this basket. Stored crops appear inside it. Press E or use the nearby button to open the inventory; Garden also has a **View harvest basket** button, including in simple view.
- Inventory shows current stored carrots, radishes, mint, daisies and sunflowers. Counts survive reload and decrease when gifts are given to Luma. These are stored quantities, not lifetime totals. Luma accepts sunflowers with a translated thank-you and held-flower animation.
- Existing five- and six-bed saves retain their crops, quantities, prepared tea and crumb pouch; the sunflower row and zero sunflower inventory are additive defaults under the existing garden key.

## Files

`garden.ts` owns sunflower state, growth, allowed planting, basket position and interaction targets. `gardenScene.ts` handles the row, sunlight orientation, basket, contents and harvest destination. `VillageEngine.ts` passes the actual light direction and measures distance along the full sunflower row. `world.ts` clears grass at the basket; `life.ts` adds Luma's sunflower prop.

`GardenActivities.tsx`, `Village.tsx` and `village.css` add translated sunflower controls and the inventory dialog. Existing garden tests use the current bed count; `sunflowers.cjs` and `sunflowers-ui.cjs` cover this addition. No dependencies, source assets, hosting settings or unrelated routes were changed.

## Verification

- Typecheck and root-path production export pass. Existing Browserslist and unrelated RoomScene image warnings remain.
- Fifty state/scene checks pass in Chrome 154 and Firefox 142: older saves, sunflower growth boundaries, repeated harvesting, every sunflower's sunlight direction, both row ends, inventory presentation and basket/path collision.
- Exported-app checks pass in Chrome (15) and Firefox (14): empty and populated inventory, native keyboard/click entry, real countdown ticking, reload persistence, harvest accumulation, Luma gifts, Japanese simple view and visible close controls. Chrome additionally covers 390×844.
- Existing Chrome suites pass: 32 nearby-interaction, 89 garden/pond/companion, 59 growth/gift and 22 garden-detail checks.
- No application errors were captured in these browser runs. Five-minute growth boundaries use injected timestamps and a shortened saved timestamp in the UI; a real five-minute wait and physical touch were not performed.

Evidence is under `docs/village/evidence/sunflower-basket/`. The local standalone QA harness is not shipped. Use an existing Playwright installation:

```sh
python3 scripts/village/preview_qa.py --port 3043
PLAYWRIGHT_PATH=/absolute/path/to/playwright QA_URL=http://127.0.0.1:3043 node scripts/village/tests/sunflowers.cjs chrome
PLAYWRIGHT_PATH=/absolute/path/to/playwright APP_URL=http://127.0.0.1:3042 node scripts/village/tests/sunflowers-ui.cjs chrome
```

The UI command expects a root static export served at the chosen APP_URL. For Firefox, replace `chrome` with `firefox` and provide BROWSER_EXECUTABLE when required by the installed browser/runtime pair.

The next release should include this addition and perform the usual live-site smoke check after deployment. This side conversation does not authorize publication.
