# Title screen and first-use menus — local evidence

A checked local export and the existing Worker on port 2567 pass 57 real Chrome onboarding checks with zero page errors. Entry waits for world assets, while Language and all Settings sections remain usable during a held layout request. The title screen creates no shared connection or audio context until an explicit user action; Enter joins the actual Worker, switches the camera back to gameplay and focuses the canvas. An explicit pre-entry sound-off choice is respected.

English/Japanese selection and weather/graphics persistence are exercised. Arrow/Home/End menu navigation and modal focus return pass. Title, menu, touch-sized buttons and all three Settings bodies stay contained at 1366×768, 1280×800, 900×640, 768×1024, 744×1133 and a 500×640 desktop window. A fresh Japanese touch browser gets thumbstick guidance. Reduced motion holds the title camera still. A forced WebGL creation failure leaves Settings available, and retry recovers the real scene after WebGL becomes available again.

The final isolated production build, sequential typecheck, lint, full village contracts and export privacy checks pass. All 18 two-client Japanese/chat regressions pass against the same export, including default-language precedence, IME confirmation, original message delivery and reloaded language selection. Five further actual-served smoke checks confirm port3051 serves the title/Settings and enters the real shared village without page errors. Lint retains the pre-existing RoomScene image warning. No new assets, world placements, editor registrations, physics or Worker rules are introduced. Main preview3051 serves the checked export; Worker2567 is unchanged. No deployment or Git writes. Native Safari/Firefox, screen readers, physical iPad/laptop performance and long sessions remain unverified.

Reproduce with a checked export and the local Worker:

```sh
PLAYWRIGHT_PATH=/absolute/path/to/playwright EXPORT_DIR=/absolute/path/to/out node scripts/village/tests/onboarding-browser.cjs
```

[Onboarding checks](checks.json) · [Japanese/chat checks](japanese-checks.json) · [Served smoke](served-smoke.json) · [Laptop title screen](title-1366x768.png) · [Tablet-sized title screen](title-744x1133.png) · [Japanese touch view](title-touch-japanese.png) · [Language menu](language-japanese.png) · [Control settings](settings-controls.png)

Follow-up keycap spacing: the grouped movement hint has 8 px of internal padding on each side, with single-key hints remaining 28 px squares. A fresh production build including lint/types and export privacy passes. Directly served browser measurements cover eight keyboard layouts (two laptop sizes and three iPad portrait/landscape pairs) and six touch layouts at 810×1080, 820×1180, 744×1133 and their rotations. No horizontal overflow or page errors occur. This is viewport/touch emulation, not native or physical iPad acceptance. Earlier interaction checks are reused for unchanged JavaScript. The local AGENTS.md now requires padded keyboard hints and iPad dimension checks for future screens, menus and HUDs. [Measurements](keycap-padding-checks.json) · [Padded hints](padded-keycaps.png).
