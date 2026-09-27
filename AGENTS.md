# Village assets and the local layout editor

Whenever creating or adding new village assets, objects, buildings, props, vegetation, scenery, or other world elements, **also add them to the local layout editor in the same change**. Editor support is a required part of completing the asset or object work.

- Make reusable, placeable assets available in the editor's asset library with a clear name, category, and preview.
- Ensure new world objects can be selected and edited using the editor's applicable placement, rotation, and scale controls, and that their layout changes survive saving and reloading.
- Keep editor registrations and saved-layout compatibility in sync when updating or replacing assets. Preserve the original default layout and edit working copies.
- Keep the layout editor a local development tool on its separate port; do not expose it in the public application.
- The editor source, tests, and documentation may be committed with village releases, but the deployed static site must contain no editor route, editor UI, editor server, or layout save API. Verify this before publishing.
