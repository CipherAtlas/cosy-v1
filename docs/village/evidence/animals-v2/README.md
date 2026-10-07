# Animal art evidence — 2026-10-04 local

[Representative contact sheet](contact-sheet.png) uses the final eight species portraits. [Native-scale cohort](set-final-native-scale.png) shows all seventeen models under one camera and lighting setup. The [catalog](../../ANIMAL_ART.md), [manifest](../../animals-v2-manifest.json) and [saved Blender source](../../../../assets/village/animals-v2/animal-art-studio.blend) describe the delivery.

## Native rig delivery and active integration

[Native rig evidence](rigs/README.md) supersedes the initial static export below. At the October 4 checkpoint, seventeen GLBs contained 110 native clips with unchanged approved resting artwork. The [October 7 owl revision](../owl-20261007/README.md) replaces only the owl artwork and adds three clips; the current set has 113. Active horses, dogs, pasture animals, owls, pond birds and the private cat use the new artwork. The [separate rig studio](../../../../assets/village/animals-v2/animal-rig-studio.blend) preserves the original art studio. The catalog and manifest describe the current delivery; earlier portraits remain valid artwork references.

## Final portraits

- [horse-bay final portrait](horse-bay-final.png): 12,148 triangles.
- [horse-grey final portrait](horse-grey-final.png): 10,692 triangles.
- [highland-copper final portrait](highland-copper-final.png): 10,472 triangles.
- [highland-flower final portrait](highland-flower-final.png): 11,480 triangles.
- [dog-corgi final portrait](dog-corgi-final.png): 6,660 triangles.
- [dog-shiba final portrait](dog-shiba-final.png): 6,660 triangles.
- [dog-beagle final portrait](dog-beagle-final.png): 6,100 triangles.
- [dog-samoyed final portrait](dog-samoyed-final.png): 7,060 triangles.
- [dog-collie final portrait](dog-collie-final.png): 6,932 triangles.
- [dog-shepherd final portrait](dog-shepherd-final.png): 6,532 triangles.
- [sheep final portrait](sheep-final.png): 9,496 triangles.
- [lamb final portrait](lamb-final.png): 5,800 triangles.
- [cat final portrait](cat-final.png): 5,800 triangles.
- [swan final portrait](swan-final.png): 5,800 triangles.
- [owl final portrait](owl-final.png): 5,800 triangles.
- [duck final portrait](duck-final.png): 5,408 triangles.
- [duckling final portrait](duckling-final.png): 5,408 triangles.

## Process captures

The species were worked sequentially; each major pass was inspected through a live Blender viewport screenshot. Saved renders retain the staged reviews: horse 03/04/05, Highland 01/02/03, dog 01/02/03/04, sheep 01/02/03/04/05, cat 01/02/03/04, swan 01/02/03, owl 01/02/03/04/05/06/07 and duck 01/02/03/04. Earlier plate-face owl images and other intermediate views are drafts. Some early stage views include earlier comparison candidates; use the final portraits above for delivered geometry. The last owl pass embeds the feather-color face pattern into the head surface.

## Initial static delivery validation (historical)

- **358 actual GLB assertions**: header/one-scene structure, two meshes/materials, file hashes, finite positions/indices/unit normals, vertex colors, packed UV range, measured triangle budgets, +Z facing, Y-up ground origin and applied transforms. The current `node scripts/village/tests/animal-art.cjs` now validates the native rigs; it remains included in `npm test`.
- **44 real Chrome editor assertions**: [results](editor/editor-checks.json), seventeen rendered previews, placement, transforms, save/reload, actual Three.js imports, selective loading, sculpture-only runtime layout, 1280×800 and 1024×700 shelf bounds, unchanged canonical/preset/design hashes and no captured page errors. Run `tools/village-editor/tests/animal-art.cjs` against an isolated server with temporary `--layouts-dir` and `--playable-file`. [1280×800](editor/editor-1280.png), [1024×700](editor/editor-1024.png).
- **13 Python server tests**: existing persistence/security checks plus successful temporary Apply of every animal with rotation/nonuniform scale and rejection of an unknown asset without changing the accepted file. `python3 tools/village-editor/tests/server_test.py`.
- **Fresh project checks**: current village contracts, final 22-page production build including lint/type validation, application typecheck, authoring Python syntax and static-export privacy check passed. Existing lockfile/Browserslist/room-image and Three.js CommonJS warnings remain.

Application typecheck, existing village contracts and the 13 server API tests were reused across the final cat/lamb geometry-only reduction; their functional source and inputs were unchanged. The final GLB assertions, Chrome editor run, production build, export-byte parity and export privacy checks were rerun. The normal editor was restarted on 3040 and its health/current library/category modules verified. The review server on 3049 used temporary storage. At this initial milestone, gameplay actors retained their original rigs and the delivery was static. The native rig milestone above supersedes those exports and active skins. No live/publication, physical-device, Safari/Firefox or animation acceptance is claimed. Canonical layout/physics and protected saves remain unchanged.
