# Cosy Village

A colorful third-person village for focus, music, breathing, mood check-ins, gratitude and kind notes. You explore as a small smiling white spirit. Traversal, recorded location-aware music and spatial world sound are integrated. The scene remains candidate art; reference fidelity, long-session listening and target-device performance are unfinished.

**New agents and new tasks: start with [VILLAGE_HANDOFF.md](VILLAGE_HANDOFF.md).** It contains the agreed scope, current gaps, priorities, code boundaries, preservation requirements and copyable task brief.

## Direction and documentation

- [Approved visual target](docs/village/references/approved-village.png): village composition, warm cottages, planting and scenery. The latest user direction supersedes its palette and traveler: vivid Genshin-inspired colors, Arkenfall atmosphere, and a cute white spirit.
- [Live Cosy Village](https://cipheratlas.github.io/cosy-v1/): the current `main` release. The original Cosy v1 remains the functional baseline, preserved in the [baseline captures](docs/village/references/README.md); earlier local redesign experiments are not references for this work.
- [Arkenfall](https://www.arkenfall.site/): a heavy reference for the immersive RPG experience, traversal, atmosphere and world sound.
- [Art, lighting and asset production](docs/village/ART_AND_ASSETS.md): asset briefs, generation prompts, export/provenance requirements and visual acceptance.
- [Movement and living world](docs/village/MOVEMENT_AND_WORLD.md): gliding, unlimited dashing, jumping, mouse/touch camera controls and coordinated wind.
- [Music and sound](docs/village/MUSIC_AND_SOUND.md): recorded compositions, spatial ambience, effects and listening acceptance.
- [Implementation evidence](VILLAGE_BUILD.md) and [design QA](design-qa.md): what was actually tested, what remains unverified, and why the visual result is still blocked.

PDF, manga, books and book/search experiences are excluded from the village work. Older unrelated routes may remain in the repository; they are not part of this direction.

## Current application

The root page uses [features/village/Village.tsx](features/village/Village.tsx), with raw Three.js scenery, accessible React activity controls, local persistence and a recorded Web Audio soundtrack. The six activities remain available through exploration, Places and simple view. English/Japanese, reduced motion and explicit audio activation are preserved.

Explore as a smiling white spirit using WASD/arrows, R for quick glide, Shift for unlimited dash and Space to jump. There is no energy mechanic or bar. Click the scene to capture the desktop mouse, move it to look, and press Escape to release. Menus and activities release capture automatically; touch uses drag-to-look and movement buttons. Clicking or tapping the ground does not move the player.

Pip, Maple, Moss and Luma follow wider neighbourhood circuits, approach nearby players and return to their routines after chatting. Their overhead dialogue uses dark green panels, cream serif text, pastel names and a separate F key hint. Three small bilingual wooden fingerposts guide the important junctions. Hearth benches sit fully beside the road, and the tea-garden bench faces its table.

The spirit stays visible during all six activities. Recorded music follows the scenery, with manual selection and separate music/world-sound controls. Data stays in the existing local storage keys. Art fidelity, long-session listening, physical touch and target-device performance acceptance remain open.

Published application: [`738e408`](https://github.com/CipherAtlas/cosy-v1/commit/738e4085de1c88a3fbe5f1d26ef48f0b5b68f57b), verified after successful [Pages run 36245251354](https://github.com/CipherAtlas/cosy-v1/actions/runs/36245251354). Live arrival, controls guide, six-place menu and hearth return checks passed, with no energy UI or captured console warnings/errors. See [the release ledger](VILLAGE_BUILD.md#2026-09-26-village-controls-and-layout-release) for local test coverage and live-browser limits.

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
