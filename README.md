# Cosy Village

A colorful third-person village for focus, music, breathing, mood check-ins, gratitude, kind notes and gentle gardening. You explore as a small smiling white spirit. Traversal, recorded location-aware music and spatial world sound are integrated. The scene remains candidate art; reference fidelity, long-session listening and target-device performance are unfinished.

**New agents and new tasks: start with [VILLAGE_HANDOFF.md](VILLAGE_HANDOFF.md).** It contains the agreed scope, current gaps, priorities, code boundaries, preservation requirements and copyable task brief.

## Direction and documentation

- [Approved visual target](docs/village/references/approved-village.png): village composition, warm cottages, planting and scenery. The latest user direction supersedes its palette and traveler: vivid Genshin-inspired colors, Arkenfall atmosphere, and a cute white spirit.
- [Live Cosy Village](https://cosy.sabarg.com/): the current `main` release. The original Cosy v1 remains the functional baseline, preserved in the [baseline captures](docs/village/references/README.md); earlier local redesign experiments are not references for this work.
- [Arkenfall](https://www.arkenfall.site/): a heavy reference for the immersive RPG experience, traversal, atmosphere and world sound.
- [Art, lighting and asset production](docs/village/ART_AND_ASSETS.md): asset briefs, generation prompts, export/provenance requirements and visual acceptance.
- [Movement and living world](docs/village/MOVEMENT_AND_WORLD.md): gliding, unlimited dashing, jumping, mouse/touch camera controls and coordinated wind.
- [Music and sound](docs/village/MUSIC_AND_SOUND.md): recorded compositions, spatial ambience, effects and listening acceptance.
- [Implementation evidence](VILLAGE_BUILD.md) and [design QA](design-qa.md): what was actually tested, what remains unverified, and why the visual result is still blocked.

PDF, manga, books and book/search experiences are excluded from the village work. Older unrelated routes may remain in the repository; they are not part of this direction.

## Current application

The root page uses [features/village/Village.tsx](features/village/Village.tsx), with raw Three.js scenery, accessible React activity controls, local persistence and a recorded Web Audio soundtrack. Activities are available through exploration and Places. English/Japanese, reduced motion and explicit audio activation are preserved.

Explore as a smiling white spirit using WASD/arrows, R for quick glide, Shift for unlimited dash and Space to jump. There is no energy mechanic or bar. Click the scene to capture the desktop mouse, move it to look, and press Escape to release. Menus and activities release capture automatically; touch uses drag-to-look and movement buttons. While settled into an activity, hold and drag the scene to look around. Clicking or tapping the ground does not move the player.

Near a bench, press E or use Sit on the bench; press E again or use Stand up to leave the seat. At the bird clearing, Scatter sourdough crumbs works directly, including from its bench, with a short toss onto the ground. Wren can still give a reusable crumb pouch through conversation.

Pip, Maple, Moss and Luma follow wider neighbourhood circuits, approach nearby players and return to their routines after chatting. Their overhead dialogue uses dark green panels, cream serif text, pastel names and a separate F key hint. Three small bilingual wooden fingerposts guide the important junctions. Hearth benches sit fully beside the road, and the tea-garden bench faces the kitchen garden.

The kitchen garden adds carrots, radishes, sunflowers, flowers and mint. Water once: radishes grow in 2 minutes, mint and daisies in 3, and carrots in 5, then stay ripe until picked. Daisies share the raised wooden beds and can be harvested, replanted and given to Luma. There is no wilting, daily upkeep or shortage of seeds/water. Give harvests to Luma for a compliment and happy animation; mint earns special tea to sip on the garden-facing bench. The tea camera gently pans on arrival and remains draggable. Small circular countdowns show growth progress; wooden signs identify every bed, including “Mint · Tea leaves” at the front left. Garden soil, timber and continuous limestone paving match the village paths. Ask Maple for his reusable crumb pouch and feed the ducklings at the expanded pond. Four jumping fish and a swan share its planted shore. Press E near a garden interaction, C to invite/dismiss a nearby friend, or B near Maple for crumbs. Friends can invite any subset or all four residents to follow and share every activity.

The garden/pond/companion addition is published. The latest tea-seating and daisy follow-up is recorded in [the current milestone](VILLAGE_BUILD.md#2026-09-27-tea-seating-and-daisy-growing). It adds one separate garden save; existing notes/preferences are preserved. Companions are selected per visit.

The spirit stays visible during all seven activities. Recorded music follows the scenery, with manual selection and separate music/world-sound controls. Personal notes and preferences stay in local storage. Art fidelity, long-session listening, physical touch and target-device performance acceptance remain open.

## Shared village

After entering the 3D village, visitors join one shared world automatically. Other visitors appear as colored spirits with randomly generated two-word cosy names, including in activities. Movement, garden tending, bird and duck feeding, and a small village chat are shared. Chat clears at the top of each hour. The garden is stored in a Cloudflare SQLite-backed Durable Object; personal notes and preferences remain on each device. The initial world allows up to 64 simultaneous visitors and reconnects after an established connection drops. If the world is unavailable or full, the status in the village says so and shared actions are disabled.

The static site still deploys through GitHub Pages. The realtime Worker is defined by [worker/index.js](worker/index.js) and [wrangler.jsonc](wrangler.jsonc), and its WebSocket URL is set in the Pages build workflow. To work on the shared world locally, run `wrangler dev --config wrangler.jsonc --port 2567` and open the Next dev site with `?sharedTrial=1`. The local layout editor remains separate and is never deployed.

Release history and verification are recorded in [the implementation ledger](VILLAGE_BUILD.md). The current follow-up expands tea entry around the bench and adds the daisy growing cycle; publication status is recorded with that milestone.

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

## Local layout studio

Run `npm run dev:editor` and open [the local studio](http://127.0.0.1:3040) to arrange cottages, bridges, paths, planting and scenery. The updated village is a protected default, including the latest garden and bird clearing; edits start on a copy. Riverside, meadow and earlier-snapshot presets are included. The editor runs on its own loopback port, saves local JSON layouts, and adds no public route.

See [the studio guide](tools/village-editor/README.md) for placement controls, save/recovery, asset registration and verification. Studio layouts are visual designs; applying them to the playable game still requires connecting collision surfaces, activity anchors and resident routes.

## GitHub Pages releases

[Deploy to GitHub Pages](https://github.com/CipherAtlas/cosy-v1/actions/workflows/deploy-pages.yml) runs on every push to `main` and can also be dispatched manually. It uses Node 20, installs the lockfile with `npm ci`, builds with an empty `NEXT_PUBLIC_BASE_PATH` and the public `NEXT_PUBLIC_SHARED_WORLD_URL` for `cosy.sabarg.com`, and deploys `out` through GitHub's Pages artifact workflow. No separate publishing branch is used. Deploy Worker changes with `wrangler deploy --config wrangler.jsonc` before releasing client changes that depend on them.

Before an authorized release, run the source checks above and verify the root-path export:

```bash
NEXT_PUBLIC_BASE_PATH= npm run build
```

After pushing, confirm that both workflow jobs succeed for the pushed commit, then open [the live village](https://cosy.sabarg.com/). Check arrival, loaded scene assets, an activity exit and villager chat. A successful build alone does not prove a working deployment. Browser data saved under the old `cipheratlas.github.io` origin does not transfer to the custom domain. The old URL still served its previous subpath export during cutover verification, but its continued availability is not guaranteed. Local QA scripts, editable Blender source and documentation evidence remain outside the exported site.
