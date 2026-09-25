# Reference images and evidence

Bundled on 2026-09-25 so future tasks do not depend on files in a previous task's generated-image or visualization directory. These files are documentation references, not runtime assets. They are outside `public/` and should not be added to the application's asset preload.

For the current implementation, use the separate [evidence index](../evidence/README.md). The `prototype-*` files below predate the systems, bridge/environment and activity-exit fixes; they remain historical evidence. The approved concept remains the visual target.

| File | Meaning |
| --- | --- |
| [approved-village.png](approved-village.png) | User-approved generated concept and primary visual target, 1536 × 1024. It is not a screenshot of completed software. |
| [prototype-village.jpg](prototype-village.jpg) | Unfinished implementation at the entrance, 1536 × 1024. Use to assess gaps, never as the new art target. |
| [prototype-cottage.jpg](prototype-cottage.jpg) | Unfinished focus interior, 1280 × 720. |
| [prototype-mobile.jpg](prototype-mobile.jpg) | Prior rainy village UI check, 390 × 844. |
| [prototype-simple.jpg](prototype-simple.jpg) | Prior simple activity view check, 390 × 844. |
| [arkenfall-title.jpg](arkenfall-title.jpg) | Arkenfall title screen, 1280 × 720. No playable traversal or audio quality is proven by this image. |
| [baseline-focus.jpg](baseline-focus.jpg), [baseline-music.jpg](baseline-music.jpg), [baseline-breathe.jpg](baseline-breathe.jpg) | Prior captures of the published Cosy functional baseline, 1280 × 720. |
| [baseline-mood.jpg](baseline-mood.jpg), [baseline-gratitude.jpg](baseline-gratitude.jpg), [baseline-compliment.jpg](baseline-compliment.jpg) | Remaining baseline activities, 1280 × 720. Reader/search captures are intentionally not part of this direction. |

[manifest.json](manifest.json) records the original local source, purpose, bundled date, actual media type, dimensions and SHA-256 hash. Copies preserve source bytes. Several original browser captures had `.png` names but JPEG contents; bundled extensions reflect their real encoding. Original source paths are provenance only; use these portable relative links in future tasks.

Baseline/prototype images came from the preceding implementation session. Bundling them is not a fresh browser test. The original Cosy v1 preserved in the baseline captures remains the only functional baseline; the [live site](https://cipheratlas.github.io/cosy-v1/) tracks the village release on `main`. [Arkenfall](https://www.arkenfall.site/) remains a heavy live experiential reference. Record new captures separately with state, viewport, date and what was actually observed; do not overwrite the approved target or silently rewrite historical evidence.
