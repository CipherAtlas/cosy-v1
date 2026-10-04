# Animal audio — local evidence, 2026-10-04

Twelve short, licensed species/purr cuts plus the four existing dog recordings feed one spatial animal call channel. The current local export runs at `http://127.0.0.1:3051`, with Worker2567 unchanged; reload to receive it. No Git writes or deployment.

## What was checked

- [Final browser checks](final-browser-checks.json): 19 production Web Audio checks cover all 16 decodes, distance, walk-by versus standing, response priority, burst limits, mute/hidden/off, private cat, all music selections and failed music loading. Ten-millisecond polling observes at most one playing music deck.
- [Final broader regression](shared-retry/checks.json): all 26 three-client dog/resident/bench/flock/disconnect/reconnect/private-focus and small-window checks pass, with zero page errors.
- [Two real clients](shared-audio-checks.json): 12 accepted/contested cow-pet and stable-hay assertions verify one response per observer, rejected-action silence, disconnect release, quiet reconnect and simultaneous private focus. No page errors. The initial fixture used the unapproved origin 3066, then chose the distant Juniper horse for a stable feed; the final fixture uses the allowed 3051 origin and Willow's authored feeding bay.
- [Representative mix timeline](browser-checks.json) accompanies [WebM compressor output](game-mix.webm) and [MP3 preview](game-mix.mp3). This is a 51-second sequence of direct production audio calls with music/ambience, twelve species and a distant horse; it is not natural traversal. Its earlier 18 assertions also pass; the final nineteenth assertion adds failed-music preservation without recapturing unchanged audio.
- [Independent critique](neutral-review.txt): the reviewer attempted audio input and received `audio content omitted because you do not support audio input`. It then analyzed decoded signals and call scheduling. Revisions corrected the hot swan, weak duckling, sharp hedgehog peak, cow leading silence, repeated owl hoots and unnecessary music ducking. A later mono-conversion peak was fixed by measuring/limiting after downmix. Final clips stay below −6 dBTP; captured output measures −27.72 LUFS/−14.06 dBTP with no clipping.
- Fresh application types, complete `npm test` contracts, 53 animal-motion/channel assertions, existing audio restart/background checks, isolated static build and export privacy pass. Delivered clip/manifest hashes match the isolated export.

## Limits

Neither agent heard the recordings. Animal identity, warmth, harshness, subtle source noise, music masking on speakers/headphones and long-session repetition still need human listening. Numerical levels cannot establish that the SFX sound great. The broader shared-world run's separate dog transition timeout is preserved in [failed checks](shared/failed-checks.json); the final retry passes all 26 checks and is recorded above.

## Reproduce

Use existing Playwright via `PLAYWRIGHT_PATH=/absolute/path/to/playwright`; no dependency installation is required. Start `python3 scripts/village/preview_qa.py --port 3072`, then run `node scripts/village/tests/animal-audio.cjs` (`CAPTURE=0` skips recapture). Run `node scripts/village/tests/animal-audio-shared.cjs` against the matching export on the Worker's allowed 3051 origin. Use `python3 scripts/village/prepare_animal_sounds.py` to rebuild source cuts; `--cached-sources` accepts previously downloaded source files. Attribution, source URLs, excerpt edits and hashes ship in `public/village/audio/animal-recordings.json` and `public/village/CREDITS.txt`.
