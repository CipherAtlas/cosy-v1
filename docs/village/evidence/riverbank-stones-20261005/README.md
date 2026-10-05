# Automatic riverbank stones — local evidence

The original river and long town brook carry 1,345 pale limestone stones along both banks. Screenshots show the final vertex-tint fix at 1366×768 and 1280×720. Seventeen editor/geometry checks cover full-length narrow/wide/transformed banks, clear paving and water junctions, hidden rivers, live edits, the rendered Nature shelf preview, JSON and named-file save/reload, and Apply to an isolated playable file. Thirteen existing editor-server boundary tests also pass. These are local Chrome/source checks; production, native Firefox and physical-device performance are not established.

Reproduce the editor checks with an editor started using temporary `--layouts-dir` and `--playable-file` copies, then `APPLY_TEST=1 PLAYWRIGHT_PATH=/absolute/path/to/playwright EDITOR_URL=http://127.0.0.1:3040 node tools/village-editor/tests/riverbanks.cjs`. Omit `APPLY_TEST` against ordinary working files.
