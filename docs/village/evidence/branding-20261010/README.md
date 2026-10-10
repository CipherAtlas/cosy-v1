# Hearthwillow branding — local

The user selected the willow-and-hearth concept. The browser tab title is `Hearthwillow`; its icon uses the standalone mark on the original warm-white background, following the user's final tab-icon preference. An opaque cream screen shows the logo from server-rendered first paint, through device detection and scene loading. The village bypasses the legacy page entrance fade/blur so it cannot reveal a gray page before the loader.

The dim silhouette breathes over 3.6 seconds and rotates gently between −3° and +3°. SVG color filters isolate the original amber flame and green willow without replacing the artwork. The first 30% of displayed progress fills the flame upward, with subtle stretching, brightness flicker and amber glow; the remaining 70% fills the willow upward. Displayed progress follows real asset progress with at most 900 ms of catch-up for a complete jump, so the flame finishes before the willow starts. The menu waits for the completed reveal, then retains its 550 ms fade and inert controls. Reduced motion uses direct progress and disables oscillation, flicker and fading. There is no visible loading bar; localized screen-reader status and native real progress remain. Error/retry and phone refusal still work through the existing paths.

Production assets:

- `public/hearthwillow-logo.png`: 560 × 560 PNG with alpha, displayed at up to 280 CSS pixels and loaded with priority.
- `public/favicon.ico`: embedded 16, 32 and 48 pixel PNG icons on warm white.
- `public/hearthwillow-icon-32.png` and `public/hearthwillow-icon-192.png`: browser PNG icons on warm white.
- `public/hearthwillow-apple-icon.png`: 180 × 180 Apple touch icon on cream.

The previous room favicon and its references are removed. Tab icon URLs include a revision query to refresh earlier transparent icons. Asset URLs use `withBasePath`; the local static export uses an empty base path. No world object, layout/editor, shared interaction or Worker changes.

## Verification

`npm run check` passes for the loading source; a fresh final-icon local-Worker static build and `npm run check:export` pass. The updated existing onboarding fixture also passes syntax checking; its full shared-world suite was not rerun for this presentation-only change.

All 69 final focused Chrome checks pass: pre-JavaScript first paint, deliberately delayed scripts, continuous opaque coverage through hydration/loading, sequential flame/willow frames across real progress jumps, all five icon declarations and HTTP responses, English/Japanese accessible loading state, no visible bar, motion preferences, menu fade/inert controls and usable menus. Animated logo containment passes at 1366×768, 1280×800, 900×640, 500×640 and all six required iPad CSS orientations. Phone refusal still precedes the canvas and world assets; the device contract suite also passes. No uncaught page errors. See [results.json](results.json). This run used the earlier transparent tab-icon revision; its unchanged loading/layout evidence is reused. Three focused [failure/retry checks](retry-results.json) and 13 fresh [final white-background icon checks](icon-results.json) pass. The final icon check verifies HTTP responses, revised URLs and opaque PNG/ICO backgrounds, while the loading master still has alpha.

Visual comparisons: [unlit](staged-fill-0.png), [flame filling](staged-fill-15.png), [flame lit](staged-fill-30.png), [willow starting](staged-fill-35.png), [willow filling](staged-fill-70.png), [fully lit](staged-fill-100.png). These deliberately stage SVG clipping and freeze motion for comparison; they do not represent measured loading speed. Actual loader frames are separate in `results.json`. [Before JavaScript](first-paint-before-javascript.png) and [iPad mini](loading-ipad-mini.png) capture the initial screen.

The dim bitmap preloads the same URL used by the SVG color layers. The loading artwork remains transparent, with no surrounding image tile. Native Safari/iPad, physical devices, browser-tab screenshot appearance and live deployment remain unverified. No deployment or Git writes.

## Built-in imagegen prompts

The first edit isolated the selected large emblem and removed the wordmark; PNG/ICO packaging used the existing Sharp installation. The second edit removed the loading image's background. Both used the built-in tool, with no CLI fallback.

First edit prompt:

```text
Use case: precise-object-edit
Asset type: production square favicon and loading emblem for Hearthwillow.
Input image 1 is the edit target, the user's approved identity.
Extract ONLY the large standalone willow-and-hearth emblem in the upper half. Remove the entire bottom emblem and wordmark. Preserve the selected top emblem exactly: identical branching leaf shapes, negative spaces, overall proportions, dark forest green foliage and single amber flame. Do not redesign, simplify, embellish, add outlines or change the emblem.
Reframe the selected mark centered on a square plain uniform warm cream background matching the reference, with approximately 8% empty margin on all four sides. The emblem should fill most of the square for browser favicon readability. A clean image asset with crisp edges, no presentation board, lettering, labels, shadow, border, extra objects or watermark. No text.
```

Final loading edit prompt (`transparent_background: true`):

```text
Use case: background-extraction. Production loading logo.
Remove only the cream background from this approved willow-and-hearth emblem and make it genuinely transparent, including every cream negative-space opening between the leaves and around and within the flame. Keep the foreground silhouette, branch and leaf geometry, proportions, placement, dark green and amber colors exactly unchanged. Preserve the full square canvas and existing margins. No lettering, border, shadows, halo, extra objects or redesign. Output the same emblem alone on actual alpha transparency.
```
