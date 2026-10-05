# Welcome guide and menu back navigation

57 final actual Chrome guide/back checks pass with zero page errors. Fresh entry opens the English/Japanese guide; the heading takes focus and the reading area starts at the top. Reading scrolls inside the panel, while the opt-out, Start and Back controls remain visible at laptop/small-window and iPad portrait/landscape dimensions. Both language layouts pass 810×1080, 820×1180, 744×1133 and their rotations; smaller desktop windows pass as well. Visual review confirms readable forest-glass styling and unclipped action buttons.

Escape/Backspace return to the proper opening control or scene. A manually opened guide returns to Settings. The checkbox works with E, persists over reload, skips later entry and can be re-enabled. Manual reading works while hidden. Input editing and Escape cancellation during key capture remain intact. Map/inventory/sound back keys, touch instructions, saved keybindings and expanding named-key keycaps pass.

70 onboarding and 18 actual two-client Japanese/chat regressions also pass with zero page errors. Build (including lint/types), fresh full contracts and export privacy pass. Unchanged shared authority/physics/touch movement evidence retains its original scope. Browser QA helpers for Japanese/tablet/onboarding explicitly dismiss the new guide before their gameplay scenarios. Native/physical-device comfort, complete Safari/Firefox, screen-reader and Japanese editorial acceptance remain open.

Preview3051 serves the checked export with the local Worker2567. Public publication/live smoke is pending.

[Guide/back checks](checks.json) · [Onboarding](onboarding/checks.json) · [Japanese/chat](japanese/checks.json) · [Laptop guide](guide-1366x768.png) · [Japanese guide](guide-japanese.png) · [Starter document](../../GETTING_STARTED.md)

Reproduce with a local-Worker export and `EXPORT_DIR=/absolute/path/to/out PLAYWRIGHT_PATH=/absolute/path/to/playwright node scripts/village/tests/tutorial-browser.cjs`. Build with `NEXT_PUBLIC_SHARED_WORLD_URL=ws://127.0.0.1:2567` for origin3051. Existing browser QA must dismiss the guide or save `dontShowTutorial: true` before gameplay assertions.
