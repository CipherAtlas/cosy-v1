# Reasoning level and efficient execution

Before starting substantive work, assess whether the current reasoning level is appropriate for the requested task. Use the request and only the minimal reads needed to understand its scope. Routine documentation, small isolated fixes and straightforward commit/push/deploy requests usually need low or medium reasoning; broader implementation or difficult debugging may need high reasoning. Reserve xhigh or higher for work whose complexity justifies it. Use the current turn's declared reasoning level when available; do not assume the saved default proves the active setting.

If the current reasoning level is higher than the task warrants, **do not perform the task**. Briefly explain the mismatch, recommend a supported reasoning level and ask the user to switch to it or explicitly authorize continuing at the current level. Stop and wait for their response before editing, testing, building, Git writes or deployment. Do not silently change the model, reasoning setting or configuration. Once the user switches or explicitly overrides the recommendation, continue the authorized task without repeating the question unless its scope materially changes.

When the current reasoning level is appropriate or the user has explicitly resolved the mismatch:

- Read relevant file sections and reuse findings while those files remain unchanged; avoid repeatedly loading entire files or rediscovering established project workflows. Batch independent reads and searches.
- Reuse earlier passing checks only when the relevant source, dependencies, configuration and test inputs remain unchanged and the checks cover the current change. Clearly distinguish reused evidence from checks run now.
- Run the smallest useful verification and all applicable required project checks. Expand testing only for changed behavior, failures or unresolved risks; avoid new temporary test harnesses and repeated broad suites without a concrete need. Shared interaction changes still require the multiple-client checks below.
- For an authorized routine release, use the existing deployment workflow, fill only relevant verification gaps, wait for deployment completion and perform a focused live smoke check. Keep documentation updates concise and proportional to the change.

# Cohesive helper modules

Keep scene engines and React controllers focused on orchestration. When a feature introduces a distinct responsibility such as asset loading, scene construction, camera calculations, visitor rendering, settings or audio lifecycle, put it in a clearly named helper module or hook. Extract an existing responsibility before substantially extending a large mixed-purpose file. Prefer cohesive helpers with small typed interfaces; avoid generic utility buckets, giant context objects and tiny-file fragmentation. File length is a signal to review responsibilities, not a reason to split related code arbitrarily.

# Tablet, laptop and desktop experience

The village supports iPads, other tablets, laptops and desktop PCs. Phones are not supported. Prioritize the standard iPad, 11-inch iPad Air and iPad mini for tablet verification. Run only one simulator at a time; close the current device before booting another. Avoid simultaneous simulator, browser rendering and build workloads on this laptop. Use a touch-capability-based left movement thumbstick and direct thumb dragging on the scene to look, comfortable touch targets and safe-area spacing without covering the player or contextual actions. Prioritize available world-view space, keyboard access and compatibility with 13-inch laptop screens.

Develop every screen, menu and HUD for iPad dimensions alongside laptop dimensions. Check portrait and landscape, including representative CSS viewports of 810×1080, 820×1180 and 744×1133 and their rotations. Account for safe areas and orientation changes; verify readable text, unclipped controls, scrolling menus and touch targets without covering the player or current interaction. Desktop-only verification does not establish iPad layout acceptance; report any native or physical-device verification gap.

Strongly optimize the village scene and interface for 13-inch laptop screens. Keep the world and the current interaction clearly visible; use compact, contextual controls placed away from the main action. Buttons and control panels must have translucent or partially transparent backgrounds with readable text, visible boundaries and clear keyboard focus. Avoid large opaque overlays, unnecessary panels and controls that cover the player, interaction target or too much of the scene. Verify layouts at representative 13-inch laptop viewport sizes and in smaller desktop windows.

Reserve the bottom-right corner for minor actions and UI options. Active gameplay progress belongs in a dedicated, readable HUD: racing countdown, remaining time and checkpoints at the top center, and visible farm growth timers beside the current farming interaction. Keep these displays clear of the player and preserve keyboard access and the translucent village styling.

On phones, refuse to open the village and show a simple message asking the visitor to use an iPad, tablet, laptop or PC. Check device identity before mounting the village scene, loading world assets, initializing game audio or connecting to the shared village. Do not use viewport width alone to block entry: narrow windows on laptops and PCs must still work.

# Village assets and the local layout editor

Whenever creating or adding new village assets, objects, buildings, props, vegetation, scenery, or other world elements, **also add them to the local layout editor in the same change**. Editor support is a required part of completing the asset or object work.

- Make reusable, placeable assets available in the editor's asset library with a clear name, category, and preview.
- Ensure new world objects can be selected and edited using the editor's applicable placement, rotation, and scale controls, and that their layout changes survive saving and reloading.
- Keep editor registrations and saved-layout compatibility in sync when updating or replacing assets. Preserve the original default layout and edit working copies.
- Keep the layout editor a local development tool on its separate port; do not expose it in the public application.
- The editor source, tests, and documentation may be committed with village releases, but the deployed static site must contain no editor route, editor UI, editor server, or layout save API. Verify this before publishing.

# Shared village interaction rules

The outdoor village is one public shared world at all times. Treat every outdoor animal, resident, seat and task as a shared entity; never run a separate player-owned copy of its movement, engagement or task state in each browser.

- The Worker owns actor movement, interaction ownership, reservations and shared action clocks. Clients request an action and apply the accepted result; rejected or pending requests must not grant ownership, resources or occupancy locally.
- An animal or resident engaged with a visitor stays engaged with that visitor. Hold its position during conversation, petting or an open trick menu as appropriate; let followers move with their owner. Other visitors can observe but cannot take, move, dismiss or restart that actor's interaction.
- Claim actual bench and swing seats before sitting. Full benches may refuse entry; do not invent an overlapping seat or bypass occupancy through an activity. Outdoor tasks use their real shared positions and resources, with clear nearby positions for supported groups and refusal when no position is available.
- Broadcast accepted action start times, ownership and task state so current, late-joining and reconnecting visitors see the same outcome. Release abandoned claims when visitors leave, disconnect or stop renewing their presence; pending replies must not reserve a space forever.
- Shared feeding and garden tasks must validate availability and resources in the Worker. Competing requests cannot duplicate harvests, grant unaccepted crumbs or restart an occupied meal.
- The focus cottage is the explicit private exception: every visitor can use their own independent interior simultaneously. Its timer, furniture, cat and local actions remain private. Hide other visitors and their companions from that interior, preserve personal notes/preferences, and prevent shared outdoor events from changing its timer.
- Check interaction changes with multiple real clients, including contention, full seats, leaving/disconnection, reconnection and simultaneous private focus. Keep Worker collision/seat data aligned with the playable layout and record local versus live evidence in the village docs.

# Dialogue and animal action controls

NPC conversation actions and nearby animal interaction buttons must show their real keyboard shortcuts in clear, square `kbd` keycaps inside the clickable button. Keep the keycaps visible on desktop and touch layouts, preserve a distinct button boundary and at least a 44 px touch target, and keep click/tap and keyboard actions equivalent. Do not show a keycap for an action without that shortcut.

Always leave visible padding inside keyboard-hint borders. Grouped shortcuts such as **W A S D** need intrinsic-width rectangles with at least 8 px of horizontal padding on each side; never let their text touch the enclosing border. Keep single-key keycaps square with centered glyphs. Check padding and wrapping in bottom hints and action panels at laptop and iPad dimensions.

# Button press feedback

Every village button, including NPC conversation/actions, animal interactions, swing controls, activities and menus, must give immediate, subtle visual press feedback for pointer and keyboard activation, including its real shortcuts. Use a brief press-and-release animation without moving surrounding layout or delaying the action. Respect reduced motion with a still highlight instead of movement, and never animate disabled controls. Keep translucent forest-green interaction panels, cream text, bordered buttons and square keycaps consistent; the meadow swing controls use the same treatment as the nearby dog panel.

# Documentation after code changes

After every code change, update the relevant existing documentation in the same change. For village work, record the behavior, checks actually run, and remaining limits in `VILLAGE_BUILD.md`; keep `VILLAGE_HANDOFF.md`, `README.md`, and affected village or layout-editor guides aligned with current behavior. For other features, update their corresponding docs. Distinguish local verification from live or deployed results.

# Functional UI copy only

Do not use decorative text, flavor copy, mood-setting slogans, poetic introductions or filler anywhere in the UI. Every label or sentence must identify an action, explain a required control, show state, communicate a limit or report an error. Keep it direct and concise in English and Japanese. Remove existing filler instead of rewriting it as another decorative phrase. For example, never add copy such as “A little cooking, a lovely picnic.”
