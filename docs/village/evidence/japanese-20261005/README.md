# Japanese language and chat — local evidence

The isolated exported village and the existing local Worker on port 2567 passed 18 real two-client Chrome checks with zero page errors. One fresh Japanese-locale profile defaulted to Japanese; another Japanese-locale profile retained explicit English. They exchanged original Japanese messages, checked localized room/participant/cooldown text, changed language live and restored Japanese after reload. Composition events, modern `isComposing`, Safari-style keyCode 229, implicit form submission, Escape and close/reopen were exercised; these use synthetic composition events, not an operating-system IME.

The four screenshots cover 1366×768, 1280×800, 1024×720 and 900×640. Chat stays within the window without horizontal overflow. Japanese uses system font fallbacks and strict line breaking. The sender and recipient retain their own UI language and see the same original message.

`node scripts/village/tests/japanese.cjs` passes 243 content/control checks: all nine resident profiles have Japanese names, greetings, ambient/chat/weather lines; current shared refusals and dynamic crop/food refusals translate; farm requests retain their original shared payloads and disabled growing/harvest state; animal/orchard/owl controls and saved language precedence work. The full project contract suite, final typecheck and isolated production build/export privacy check also pass. Lint has the existing RoomScene image warning.

The checked preview is `http://127.0.0.1:3068/`, from `/tmp/cosy-japanese-preview-path.txt`; the ordinary 3051 preview and Worker service were not replaced. This snapshot includes concurrent work present at build time. Subsequent tablet changes are independently tracked. Nothing is published. Native macOS/Windows/iPad Japanese IME, Firefox/Safari typography and Japanese-speaking editorial acceptance remain unverified.

Reproduce against an isolated local export with the local Worker running:

```sh
node scripts/village/tests/japanese.cjs
PLAYWRIGHT_PATH=/absolute/path/to/playwright EXPORT_DIR=/absolute/path/to/isolated/out node scripts/village/tests/japanese-browser.cjs
```

[Checks](checks.json) · [1366×768](chat-1366x768.png) · [1280×800](chat-1280x800.png) · [1024×720](chat-1024x720.png) · [900×640](chat-900x640.png)
