# Cosy Village

A small third-person village for focus, music, breathing, mood check-ins, gratitude and kind notes. Traversal, procedural music and spatial world sound are integrated. The scene remains candidate art; reference fidelity, long-session listening and target-device performance are unfinished.

**New agents and new tasks: start with [VILLAGE_HANDOFF.md](VILLAGE_HANDOFF.md).** It contains the agreed scope, current gaps, priorities, code boundaries, preservation requirements and copyable task brief.

## Direction and documentation

- [Approved visual target](docs/village/references/approved-village.png): detailed golden-hour village, natural traveler, warm cottages, lush planting and layered scenery.
- [Live Cosy Village](https://cipheratlas.github.io/cosy-v1/): the current `main` release. The original Cosy v1 remains the functional baseline, preserved in the [baseline captures](docs/village/references/README.md); earlier local redesign experiments are not references for this work.
- [Arkenfall](https://www.arkenfall.site/): a heavy reference for the immersive RPG experience, traversal, atmosphere and world sound.
- [Art, lighting and asset production](docs/village/ART_AND_ASSETS.md): asset briefs, generation prompts, export/provenance requirements and visual acceptance.
- [Movement and living world](docs/village/MOVEMENT_AND_WORLD.md): required running/sprinting, jumping/landing, energy, camera and coordinated wind.
- [Music and sound](docs/village/MUSIC_AND_SOUND.md): required procedural composition redesign, spatial ambience, effects and listening acceptance.
- [Implementation evidence](VILLAGE_BUILD.md) and [design QA](design-qa.md): what was actually tested, what remains unverified, and why the visual result is still blocked.

PDF, manga, books and book/search experiences are excluded from the village work. Older unrelated routes may remain in the repository; they are not part of this direction.

## Current application

The root page uses [features/village/Village.tsx](features/village/Village.tsx). A raw Three.js engine renders the world, with React/DOM activity controls and dialogs. Native Web Audio powers procedural music, spatial ambience and movement effects. The project uses Next.js App Router, TypeScript and static export; legacy routes and dependencies are not the architecture guide for the new village.

The six activities are available by exploring, direct travel, or a simple activity view. Notes, preferences and focus sessions are stored locally. English/Japanese controls and reduced-motion support are present. Audio requires user interaction.

Walking/running/sprinting, jumping/landing, stamina, shared gusts, spatial ambience and contact effects are now integrated with a candidate skinned traveler. Procedural music has distinct arrangements and phrase development. Art fidelity, long-session listening, physical touch and target-device acceptance remain open; see the handoff and evidence ledger.

The latest feedback pass rebuilt the bridge as a solid, traversable stone arch, widened vertical camera movement, fixed Firefox audio startup, added clouds and surrounding scenery, introduced four ambient residents and twelve birds, and moved the hearth off the road with inward-facing benches. [Current evidence](docs/village/evidence/README.md) includes bridge crossings, camera views and Firefox audio output. The final two-minute 1280×720 desktop sample averaged about 45 fps (p95 frame interval 33.4 ms); sustained 60 fps is not established.

A subsequent activity-exit fix provides a visible **Back to village** button at every activity, restores the walking camera and keyboard focus, and places pond/nook arrivals on clear ground. Its checks are recorded separately from the earlier scene profile.

The four villagers have floating speech bubbles and their own little personalities: **Pip** collects tiny treasures, **Maple** bakes and fusses over her sourdough, **Moss** quietly cares for the garden, and **Luma** shares tea and daydreams. Click **Chat** or press **F** nearby for more conversation; all dialogue supports English and Japanese, with rain and dusk remarks.

While you explore, a nearby villager can walk over to greet you. They approach one at a time over clear ground, leave comfortable space, and return to their routine after a short visit. Menus and activities pause invitations; leaving the area and a cooldown prevent repeated greetings. See the [approach and dialogue evidence](VILLAGE_BUILD.md#2026-09-26-villager-approaches).

## Local development and verification

Use the existing npm lockfile and the project's supported Node environment:

```bash
npm ci
npm run dev
```

For source/build verification:

```bash
npm run typecheck
npm run build
```

The build exports static files into `out`. Preview that output locally with an available port:

```bash
python3 -m http.server 3000 --bind 127.0.0.1 --directory out
```

`next start` is not the preview path for this static export. Preserve `lib/basePath.ts` asset prefixing when testing subpath hosting. A local build or preview does not publish anything.

For deterministic controller/bridge checks and repeatable scene/audio captures, use the commands in [VILLAGE_BUILD.md](VILLAGE_BUILD.md#reproduce-the-checks). Its QA server is local only and does not add a shipped application route.

Runtime asset attribution is in [public/village/CREDITS.txt](public/village/CREDITS.txt). Bundled [reference images](docs/village/references/README.md) are documentation evidence, not part of the application's runtime payload.

## GitHub Pages releases

[Deploy to GitHub Pages](https://github.com/CipherAtlas/cosy-v1/actions/workflows/deploy-pages.yml) runs on every push to `main` and can also be dispatched manually. It uses Node 20, installs the lockfile with `npm ci`, builds with `NEXT_PUBLIC_BASE_PATH=/cosy-v1`, and deploys `out` through GitHub's Pages artifact workflow. No separate publishing branch is used.

Before an authorized release, run the source checks above and verify the subpath export:

```bash
NEXT_PUBLIC_BASE_PATH=/cosy-v1 npm run build
```

After pushing, confirm that both workflow jobs succeed for the pushed commit, then open [the live village](https://cipheratlas.github.io/cosy-v1/). Check arrival, loaded scene assets, an activity exit and villager chat. A successful build alone does not prove a working deployment. Local QA scripts, editable Blender source and documentation evidence remain outside the exported site.
