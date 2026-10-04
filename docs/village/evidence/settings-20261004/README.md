# Settings and personal keybindings — 2026-10-04 local

The updated 3051 preview serves a compact forest-green Settings workspace with Experience, Sound and Controls sections. Sound defaults and the animal boost are preserved. Twenty-nine personal action slots can be reassigned or explicitly swapped, and their live keycaps/accessible shortcuts follow the assignment. Graphics choice and bindings now persist alongside the existing local preferences. No Worker, layout, dependency, Git write or deployment change.

## Evidence

- [39 actual-app checks](checks.json), with two real clients: sound defaults/reset, wind adjustment, live graphics, sensitivity, binding conflicts, keyboard swap, cancellation/reserved keys, old-key silence, actual movement/release, reload persistence, independent visitor keys, native NPC prompts, accepted shared cow petting, private focus pause, Japanese labels and reset isolation. No page errors.
- [26 three-client regressions](shared/checks.json): default dog/trick/companion ownership and contention, disconnect/reconnect, full benches and release, accepted flock clocks, simultaneous private focus and small desktop layouts. No page errors.
- [44 mapping/data-boundary assertions](binding-checks.json): unique defaults for all 29 actions, replacement/disabled-old/shifted-letter/prompt behavior and safe defaults for malformed/reserved/duplicate saved input.
- [Actual served smoke](served-smoke.json) and [served Settings](served-settings.png)/[served Sound](served-sound.png) confirm the refreshed main preview. O opens Sound inside the same Settings workspace.
- [Experience](experience.png), [Sound](sound.png), [Japanese](japanese.png) and Controls at [1366×768](controls-1366.png), [1280×720](controls-1280.png), [1024×640](controls-1024.png) and [800×640](controls-800.png). The body scrolls independently; visible tabs and binding buttons keep 44 px targets. Short sections size to their content.
- Application types, lint (only the existing RoomScene image warning), full `npm test`, isolated static build and export-privacy checks pass. The export's only WebSocket endpoint is Worker2567.

## Behavior and limits

Single letters, digits, punctuation, Space and Shift are assignable. Conflicts require an explicit swap; corrupted bindings restore defaults. Escape cancels capture before closing Settings. Arrow keys and Escape/Tab/Enter keep their navigation roles, native buttons keep Enter/Space activation and journal Ctrl/Meta+Enter remains standard. Contextual actions share a slot (interact/pet/sit and jump/brake/pause, for example). Reset keys leaves other settings intact; Reset sound restores only the mix. Weather selection no longer changes slider values. Fresh browsers still start with Gentle on battery.

These are local Chrome checks with synthetic visitors. Physical laptop usability, native Firefox/Safari and subjective visual acceptance remain unverified. Earlier fixture attempts used a routed Chrome origin without the required test flag, overly broad labels, malformed range strings, hidden target measurements and an obsolete four-resident count; the final runner corrects those fixture assumptions. The accessible select labels were improved during the pass.

## Reproduce

Build an isolated export with `NEXT_PUBLIC_SHARED_WORLD_URL=ws://127.0.0.1:2567`. With the local Worker healthy on 2567, run `PLAYWRIGHT_PATH=/absolute/path/to/playwright EXPORT_DIR=/absolute/path/to/out node scripts/village/tests/settings-browser.cjs`. `EXPORT_DIR` intercepts assets on the allowed 3051 origin; omit it to test the currently served main preview. `OUTPUT_DIR` selects the evidence directory. Run the existing `shared-world-browser.cjs` with the same export and an independent output directory for the three-client regression. No dependencies need to be installed.
