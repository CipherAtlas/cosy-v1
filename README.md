# Cosy Village

A colorful third-person village for focus, music, breathing, mood check-ins, gratitude and kind notes. You explore as a small smiling white spirit. Traversal, recorded location-aware music and spatial world sound are integrated. The scene remains candidate art; reference fidelity, long-session listening and target-device performance are unfinished.

**New agents and new tasks: start with [VILLAGE_HANDOFF.md](VILLAGE_HANDOFF.md).** It contains the agreed scope, current gaps, priorities, code boundaries, preservation requirements and copyable task brief.

## Direction and documentation

- [Approved visual target](docs/village/references/approved-village.png): village composition, warm cottages, planting and scenery. The latest user direction supersedes its palette and traveler: vivid Genshin-inspired colors, Arkenfall atmosphere, and a cute white spirit.
- [Live Cosy Village](https://cipheratlas.github.io/cosy-v1/): the current `main` release. The original Cosy v1 remains the functional baseline, preserved in the [baseline captures](docs/village/references/README.md); earlier local redesign experiments are not references for this work.
- [Arkenfall](https://www.arkenfall.site/): a heavy reference for the immersive RPG experience, traversal, atmosphere and world sound.
- [Art, lighting and asset production](docs/village/ART_AND_ASSETS.md): asset briefs, generation prompts, export/provenance requirements and visual acceptance.
- [Movement and living world](docs/village/MOVEMENT_AND_WORLD.md): required running/sprinting, jumping/landing, energy, camera and coordinated wind.
- [Music and sound](docs/village/MUSIC_AND_SOUND.md): recorded compositions, spatial ambience, effects and listening acceptance.
- [Implementation evidence](VILLAGE_BUILD.md) and [design QA](design-qa.md): what was actually tested, what remains unverified, and why the visual result is still blocked.

PDF, manga, books and book/search experiences are excluded from the village work. Older unrelated routes may remain in the repository; they are not part of this direction.

## Current application

The root page uses [features/village/Village.tsx](features/village/Village.tsx). A raw Three.js engine renders the world, with React/DOM activity controls and dialogs. Streaming recordings feed a native Web Audio mixer alongside spatial ambience and movement effects. The project uses Next.js App Router, TypeScript and static export; legacy routes and dependencies are not the architecture guide for the new village.

The spirit remains visible during each activity, with a working hourglass, breathing ripples, tea, quill and letters reacting to the controls. Water and fire animate throughout the world; paper activity panels can be tucked away to enjoy the view.

Published application release: [`ae3f826`](https://github.com/CipherAtlas/cosy-v1/commit/ae3f826340bbfb57dacb558efb41269c1dc47290), deployed successfully on 2026-09-26 through [Pages run 36234597977](https://github.com/CipherAtlas/cosy-v1/actions/runs/36234597977). Live arrival, recorded-music controls, activity exit and villager chat passed verification. See [the release record](VILLAGE_BUILD.md#2026-09-26-main-release) for asset checks and remaining acceptance work.

The six activities are available by exploring, direct travel, or a simple activity view. Notes, preferences and focus sessions are stored locally. English/Japanese controls and reduced-motion support are present. Audio requires user interaction.

Gliding, quick gliding/dashing, jumping, stamina, shared gusts and spatial ambience are integrated with an original floating white spirit. Pip, Maple, Moss and Luma are pastel blob spirits with distinct accessories, conversations and greeting behavior. Four complete recordings follow the village paths, waterside gardens, quiet spaces and hearth. Art fidelity, long-session listening, physical touch and target-device acceptance remain open; see the handoff and evidence ledger.

An earlier feedback pass rebuilt the bridge as a solid, traversable stone arch, widened vertical camera movement, fixed Firefox audio startup, added clouds and surrounding scenery, introduced four ambient residents and twelve birds, and moved the hearth off the road with inward-facing benches. [The evidence index](docs/village/evidence/README.md) preserves those bridge/camera/audio checks alongside later captures. The latest water/activity two-minute profile averaged 75.0 fps at 1280×720, DPR 1, detailed quality (p95 frame interval 20.4 ms). Earlier 45 fps and 86 fps profiles describe different milestones and conditions; target-device acceptance remains open.

A subsequent activity-exit fix provides a visible **Back to village** button at every activity, restores the walking camera and keyboard focus, and places pond/nook arrivals on clear ground. Its checks are recorded separately from the earlier scene profile.

The four villagers have floating speech bubbles and their own little personalities: **Pip** collects tiny treasures, **Maple** bakes and fusses over her sourdough, **Moss** quietly cares for the garden, and **Luma** shares tea and daydreams. Click **Chat** or press **F** nearby for more conversation; all dialogue supports English and Japanese, with rain and dusk remarks.

While you explore, a nearby villager can walk over to greet you. They approach one at a time over clear ground, leave comfortable space, and return to their routine after a short visit. Menus and activities pause invitations; leaving the area and a cooldown prevent repeated greetings. See the [approach and dialogue evidence](VILLAGE_BUILD.md#2026-09-26-villager-approaches).

The checkpoint art pass adds swept teal/coral/lilac cottage roofs, limestone arches, painted glazing, flower boxes, rounded tree crowns, soft mountain layers and two distant floating gardens. Houses, paths and wood share original painted materials; the photo-based birch cards and human residents are no longer loaded. A compact **Controls** guide explains gliding and the click destination ring. Spirit modeling source and measurements are in [the spirit manifest](docs/village/spirit-manifest.json); new captures and verification are in [the build ledger](VILLAGE_BUILD.md). That art pass was committed and pushed as `7642527` before the current polish work. The Pages workflow succeeded.

The subsequent polish pass removes the player’s idle turn toward the camera, adds softer continuously updated detailed shadows, and places a directory at the entrance plus eight village signposts. Labels support English and Japanese. Recorded music and stream/rain/fire ambience replace the old generated score; the Sound controls provide automatic scenery selection and manual choices. See [the newest evidence](VILLAGE_BUILD.md#2026-09-26-orientation-shadows-wayfinding-and-recorded-soundtrack).

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
