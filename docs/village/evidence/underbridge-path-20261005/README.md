# Farm bridge — paving removal, local 2026-10-05

The saved lane crossed the river at ground height beneath the arch. Its west/east bank segments now stop at X52.8/X64.8. The bridge, other objects and all existing routes are unchanged. Source scope comparison confirms exactly one existing path changes and one matching generic path is added; named editor designs/presets remain untouched.

[Before](before.png), [after](after.png), [actual-engine crossing checks](checks.json), [served preview](served-preview.png), [served app/Worker proof](served-preview.json).

Fresh checks: 421 layout assertions with actual Worker colliders, 98 shared-world Worker assertions, renderer parity with 1,890 colliders/eight benches, local editor saved-layout validation, walking across the arch from both directions and zero captured page errors. The layout-only change reuses the existing application bundle; no production build or deployment. Browser renders are Chrome; the user's Firefox tab requires reload.

The main preview was refreshed concurrently during verification. Its current serving root was rechecked from the active process, and only this lane split was applied to that export and its source copy. The current root is recorded in `/tmp/cosy-underbridge-preview-path.txt`; the existing Worker2567 source snapshot also carries this split and matching physics fingerprint. No preview server replacement, Git writes, original presets/named-layout changes or production release.
