# Full-screen loading and game-key menus

A fresh local-Worker export passes 70 real Chrome onboarding checks with zero page errors. Loading covers the viewport with only Hearthwillow and a progress bar without visible numbers. Menu controls remain inert during loading and the 550 ms reveal. Full-screen loading covers standard iPad, 11-inch Air and mini portrait/landscape dimensions (810×1080, 820×1180, 744×1133 and rotations). Main title and all Settings bodies remain contained at laptop/tablet/smaller desktop sizes.

WASD/E navigate/activate Language choices and pre-entry/in-game Settings tabs; saved movement/interaction remapping works. Modal focus return, native arrow/Home/End behavior, persisted language/weather/graphics, sound choice preservation, reduced motion, actual shared Worker entry, WebGL failure and retry also pass. The loader and revealed title screenshots were visually reviewed. Build, lint/types, full contracts and export privacy pass; unchanged Japanese/chat/tablet/Worker evidence retains its prior scope.

Main preview3051 serves the checked export using Worker2567. Follow-up public deployment/live checks are pending. Physical device comfort, native/complete Safari/Firefox, screen readers and sustained performance remain open.

[Checks](checks.json) · [Loading](fullscreen-loading.png) · [Laptop menu](title-1366x768.png) · [Japanese touch](title-touch-japanese.png)

Reproduce with `EXPORT_DIR=/absolute/path/to/local-worker/out PLAYWRIGHT_PATH=/absolute/path/to/playwright node scripts/village/tests/onboarding-browser.cjs`. Build with `NEXT_PUBLIC_SHARED_WORLD_URL=ws://127.0.0.1:2567` for the accepted local origin on 3051.
