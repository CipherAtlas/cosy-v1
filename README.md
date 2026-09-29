# Hearthwillow

Hearthwillow is a colorful third-person village for focus, music, breathing, tea with Luma, gratitude, kind notes and gentle gardening. You explore as a small smiling white spirit. Traversal, recorded location-aware music and spatial world sound are integrated. The scene remains candidate art; reference fidelity, long-session listening and target-device performance are unfinished.

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

Rain and other world ambience continue with music when the tab is hidden. [Focused checks and limits](VILLAGE_BUILD.md#2026-09-29-background-world-sound-local) describe the local verification; the [integrated release](VILLAGE_BUILD.md#2026-09-30-integrated-village-release-published) records publication and live checks.

The root page uses [features/village/Village.tsx](features/village/Village.tsx), with raw Three.js scenery, accessible React activity controls, local persistence, recorded village music and ambience. The personal lo-fi radio code and design notes remain in the repository, but the radio is disabled. Activities are available through exploration and Places. English/Japanese, reduced motion and explicit audio activation are preserved.

The Tea garden panel keeps its quiet welcome and Luma's harvest gifts and mint tea. Its former mood choices and suggested-activity card have been removed locally. Luma's gift buttons use soft crop-colored gradients; [the build entry](VILLAGE_BUILD.md#2026-09-30-tea-garden-panel-simplification-local) records checks and limits.

Explore as a smiling white spirit using WASD/arrows, G for quick glide, Shift for unlimited dash and Space to jump. The east bridge end has a bank-side opening beside the lamppost so you can walk directly back onto the deck. If you get stuck elsewhere, press R to move to nearby safe ground; touch controls have an Unstuck button. If no nearby ground is clear, recovery returns you to the village entrance. There is no energy mechanic or bar. Click the scene to capture the desktop mouse, move it to look, and press Escape to release. Mouse sensitivity is adjustable from 25% to 200% in Settings and is saved in this browser. Menus and activities release capture automatically; touch uses drag-to-look and movement buttons. Clicking or tapping the ground does not move the player.

Near a bench, click or tap the side you want to sit on. E and the Sit on the bench button still choose an available side automatically; press E again or use Stand up to leave the seat. Two visitors can use separate sides of a bench, while later visitors share those spots. Ask Maple or Wren for crumbs while close to that resident before feeding birds or ducklings. At the bird clearing, scatter the crumbs with a short toss onto the ground, including from its bench.

Pip, Maple, Moss and Luma follow wider neighbourhood circuits, approach nearby players and return to their routines after chatting. Their overhead dialogue uses dark green panels, cream serif text, pastel names and boxed F/C/B key hints. Luma's tea action has a boxed E; after picking mint, a gently animated red exclamation appears over her head and the tea action stays visible and highlighted until the mint is shared. The cue respects reduced motion. The dialogue buttons and nearby puppy actions keep clearly bordered square shortcut hints on desktop and touch layouts; [the focused check](VILLAGE_BUILD.md#2026-09-30-dialogue-and-animal-action-keycaps-local) records local coverage and limits. Three small bilingual wooden fingerposts guide the important junctions. Hearth benches sit fully beside the road, and the tea-garden bench faces the kitchen garden.

The kitchen garden adds carrots, radishes, sunflowers, flowers and mint. Water once: radishes grow in 2 minutes, mint and daisies in 3, and carrots in 5, then stay ripe until picked. Daisies share the raised wooden beds and can be harvested, replanted and given to Luma. There is no wilting, daily upkeep or shortage of seeds/water. Give harvests to Luma for a compliment and happy animation; mint earns special tea to sip on the garden-facing bench. The tea camera gently pans on arrival and remains draggable. Small circular countdowns show growth progress and disappear when a crop is ready; the completed countdown shipped in the integrated release. Wooden signs identify every bed, including “Mint · Tea leaves” at the front left. Garden soil, timber and continuous limestone paving match the village paths. Feed the ducklings at the expanded pond after asking a nearby resident for crumbs. Four jumping fish and a swan share its planted shore. Press E near a garden interaction, C to invite/dismiss a nearby resident, or B near Maple or Wren for crumbs. Residents can still be invited directly in conversation to follow and share activities.

The garden/pond/companion addition is published. The latest tea-seating and daisy follow-up is recorded in [the current milestone](VILLAGE_BUILD.md#2026-09-27-tea-seating-and-daisy-growing). It adds one separate garden save; existing notes/preferences are preserved. Companions are selected per visit.

The spirit stays at the authored focal position during all eight activities, including the focus cottage chair, independent of its shared-world visitor slot. Outdoor activity visitors can share the same spot; each focus cottage interior shows only its own visitor. [The activity seating check](VILLAGE_BUILD.md#2026-09-29-activity-spirit-seating-published) records its published status and remaining limits. Recorded music follows the scenery, with manual selection and separate music/world-sound controls. Personal notes and preferences stay in local storage. The Writing nook has a labelled writing surface and a separate Past notes section: scroll one-line previews and open any note to read it. Download notes and Restore backup use readable `.txt` files only; older JSON backups are not accepted in the current local UI. [The local UI check](VILLAGE_BUILD.md#2026-09-30-writing-nook-and-past-notes-refresh-local) records its limits. The journal fix removes an older route's eight-note cap; [the retention checks](VILLAGE_BUILD.md#2026-09-29-journal-note-retention-safeguards-local) explain the remaining storage boundaries. Art fidelity, long-session listening, physical touch and target-device performance acceptance remain open.

The village has four Blender-made puppies: Mochi the corgi by the entrance, Kiko the Shiba on the cottage lane, Biscuit the beagle west of the bridge, and Cloud the Samoyed near the northern path. They rest, follow short walkable patrols and offer a nearby **Pet** button or E key. Petting turns the spirit toward the pup; the pup approaches, wags, tilts its head and shows a brief happy response. Use **Walk with** or P near a puppy to invite one walking companion; it follows just behind you. **Send home** or H returns it toward its usual spot, and inviting another puppy switches companions. Their individual recorded yips use the Effects volume and only sound after audio activation. [Local checks and limits](VILLAGE_BUILD.md#2026-09-29-village-puppies-local) cover their behavior; the [release entry](VILLAGE_BUILD.md#2026-09-30-integrated-village-release-published) records the public asset and visitor smoke checks.

Settings → Time & weather follows your device's local time by default: blue hour near dawn and dusk, a bright village by day, and a starlit sky at night. Pick a fixed scene or rain to override it; Follow local time restores automatic changes. The night has a near-black sky, moon, dense stars and a galaxy band. Lamps, the hearth and glowing spirits provide warm light. Four path lampposts mark the bridge, tea garden, bird clearing and pond approaches; six low stone lanterns light the kitchen garden edge and dry pond banks. The local studio offers a night preview and placeable lamppost and low-lantern assets; its protected presets are unchanged.

The village renderer skips off-camera cells of meadow grass and distant forest while retaining their original placements and the layout editor's placeable assets. Local visual and render-count evidence is in the [build ledger](VILLAGE_BUILD.md#2026-09-29-spatial-vegetation-culling-local); target-device performance remains unverified.

A local lighting-shader change skips point lights outside their existing illumination radius, and Settings → Show performance now includes frame-stall diagnostics. The [Firefox investigation](VILLAGE_BUILD.md#2026-09-29-point-light-shader-performance-investigation-local) records the measured night improvement and the unresolved intermittent Golden-hour slowdown. Target-device and long-session performance remain unverified.

A later local Safari-stall fix shows a full-screen preparation view when Time & weather changes, prepares the new lighting shaders before revealing the scene, and uses only the two nearest fixture lights plus the local spirit's ground light. Detailed now reduces its drawing-buffer scale after sustained low FPS while keeping its scenery and shadows. The [Safari investigation and local checks](VILLAGE_BUILD.md#2026-09-29-safari-scenery-stalls-and-detailed-budget-local) explain the trade-off and remaining device limits. The [Pages release](VILLAGE_BUILD.md#2026-09-29-scenery-performance-release) records the live checks; Safari 26.6.2 remains unverified.

Every village visit starts with **Gentle on battery** graphics. Detailed and Automatic are choices for that visit; earlier saved graphics choices do not override the starting mode. Weather, sound, language and mouse sensitivity remain saved separately. [The Battery graphics release](VILLAGE_BUILD.md#2026-09-29-battery-first-graphics-default-published) records the live check and limits.

## Shared village

The empty chat input says “Press "Enter" to type!” Enter opens and focuses chat from exploration. The chat opens at a fixed size; drag its lower-right corner to make it wider or taller. Messages scroll inside the panel. New messages show their send time using the viewing computer's local time; older messages without a recorded time remain unlabelled. Up to three visitor names show directly; larger groups have a count and an expandable, scrollable name list. [The timestamp check](VILLAGE_BUILD.md#2026-09-30-local-chat-timestamps-local), [layout check](VILLAGE_BUILD.md#2026-09-29-fixed-and-resizable-shared-chat-local) and [participant-list check](VILLAGE_BUILD.md#2026-09-30-shared-chat-participant-list-local) record local checks; live chat sends and physical touch remain unverified.

After entering the 3D village, visitors join one shared world automatically. Other visitors appear as colored spirits with randomly generated two-word cosy names, including in outdoor activities; the focus cottage interior shows only your spirit. Movement, garden tending, bird and duck feeding, and a small village chat are shared. Chat clears at the top of each UTC hour even when nobody sends a message, with the next reset shown in each visitor’s local time; [the automatic-reset check](VILLAGE_BUILD.md#2026-09-29-automatic-shared-chat-reset-local) records local verification; the live hour boundary remains unobserved. The chat client holds Send and Enter for about three seconds after a message to respect the Worker's send limit; you can type during that time, and the draft stays in the input until you send it. The garden is stored in a Cloudflare SQLite-backed Durable Object; personal notes and preferences remain on each device. The initial world allows up to 64 simultaneous visitors and reconnects after an established connection drops. If the world is unavailable or full, the status in the village says so and shared actions are disabled.

The static site still deploys through GitHub Pages. The realtime Worker is defined by [worker/index.js](worker/index.js) and [wrangler.jsonc](wrangler.jsonc), and its WebSocket URL is set in the Pages build workflow. To work on the shared world locally, run `wrangler dev --config wrangler.jsonc --port 2567` and open the Next dev site with `?sharedTrial=1`. The local layout editor remains separate and is never deployed.

To manage the live shared chat, follow the [local chat admin guide](tools/village-admin/README.md): from this repository run `python3 tools/village-admin/server.py`, then open `http://127.0.0.1:3052/`. The console shows the current hour's messages and can remove one or clear the hour. It needs only Python 3 and the private admin secret; the loopback proxy sends authenticated requests to the Worker without exposing the secret to the browser. The Worker and matching client are published; the admin page remains outside the public static site. [The build ledger](VILLAGE_BUILD.md#2026-09-29-local-chat-admin) records the live checks and remaining limits.

Release history, current verification and remaining limits are recorded in [the implementation ledger](VILLAGE_BUILD.md).

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

Run `npm run dev:editor` and open [the local studio](http://127.0.0.1:3040) to arrange cottages, bridges, paths, fencing, planting, puppies and scenery. The local playable layout now includes the saved **My village** design, preserved newer lanterns and four puppy placements. Drag to draw paths or oak fence lines; edit their points, length and path width or fence height. Click a shelf asset repeatedly to place multiple copies until Escape, or right-click in the scene for Cut, Copy, Paste here, Duplicate, Focus, Remove and history actions. You can also paint grass, erase meadow grass and lane wildflowers under paths, shape walkable areas and edit resident routes. Saved erase rings are hidden until a clearing is selected in Scene. The earlier current village, riverside, meadow and original presets remain protected. The editor runs on its own loopback port, saves local JSON layouts, and adds no public route.

See [the studio guide](tools/village-editor/README.md) for placement controls, save/recovery, asset registration and verification. **Apply to local game** writes the versioned `public/village/world-layout.json` for paths, fence lines, grass, erased planting areas, trees, walkable areas, oak meadow benches, puppy placements, resident routes and existing cottage/spire positions, with validation and a backup. Bridges, other buildings and props, activities, garden interactions and cameras remain authored in game code; Apply rejects edits to those objects until their runtime integration is implemented. Nothing is deployed by local Apply.

## GitHub Pages releases

[Deploy to GitHub Pages](https://github.com/CipherAtlas/cosy-v1/actions/workflows/deploy-pages.yml) runs on every push to `main` and can also be dispatched manually. It uses Node 20, installs the lockfile with `npm ci`, builds with an empty `NEXT_PUBLIC_BASE_PATH` and the public `NEXT_PUBLIC_SHARED_WORLD_URL` for `cosy.sabarg.com`, and deploys `out` through GitHub's Pages artifact workflow. No separate publishing branch is used. Deploy Worker changes with `wrangler deploy --config wrangler.jsonc` before releasing client changes that depend on them.

Before an authorized release, run the source checks above and verify the root-path export:

```bash
NEXT_PUBLIC_BASE_PATH= npm run build
```

After pushing, confirm that both workflow jobs succeed for the pushed commit, then open [the live village](https://cosy.sabarg.com/). Check arrival, loaded scene assets, an activity exit and villager chat. A successful build alone does not prove a working deployment. Browser data saved under the old `cipheratlas.github.io` origin does not transfer to the custom domain. The old URL still served its previous subpath export during cutover verification, but its continued availability is not guaranteed. Local QA scripts, editable Blender source and documentation evidence remain outside the exported site.
