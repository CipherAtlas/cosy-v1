# Village assets and the local layout editor

Whenever creating or adding new village assets, objects, buildings, props, vegetation, scenery, or other world elements, **also add them to the local layout editor in the same change**. Editor support is a required part of completing the asset or object work.

- Make reusable, placeable assets available in the editor's asset library with a clear name, category, and preview.
- Ensure new world objects can be selected and edited using the editor's applicable placement, rotation, and scale controls, and that their layout changes survive saving and reloading.
- Keep editor registrations and saved-layout compatibility in sync when updating or replacing assets. Preserve the original default layout and edit working copies.
- Keep the layout editor a local development tool on its separate port; do not expose it in the public application.
- The editor source, tests, and documentation may be committed with village releases, but the deployed static site must contain no editor route, editor UI, editor server, or layout save API. Verify this before publishing.

# Dialogue and animal action controls

NPC conversation actions and nearby animal interaction buttons must show their real keyboard shortcuts in clear, square `kbd` keycaps inside the clickable button. Keep the keycaps visible on desktop and touch layouts, preserve a distinct button boundary and at least a 44 px touch target, and keep click/tap and keyboard actions equivalent. Do not show a keycap for an action without that shortcut.

# Documentation after code changes

After every code change, update the relevant existing documentation in the same change. For village work, record the behavior, checks actually run, and remaining limits in `VILLAGE_BUILD.md`; keep `VILLAGE_HANDOFF.md`, `README.md`, and affected village or layout-editor guides aligned with current behavior. For other features, update their corresponding docs. Distinguish local verification from live or deployed results.
