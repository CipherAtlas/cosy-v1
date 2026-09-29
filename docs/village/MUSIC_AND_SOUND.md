# Recorded music and world sound

Updated: 2026-09-29. Current specification for `AUDIO-01` and `AUDIO-02`. Start with the [canonical handoff](../../VILLAGE_HANDOFF.md) and [movement/event specification](MOVEMENT_AND_WORLD.md).

## Personal lo-fi radio design — disabled 2026-09-28

The active village uses the four original location-aware recordings and the original Sound panel. `PERSONAL_RADIO_ENABLED` in `Village.tsx` is false. The optional radio implementation and these design notes remain in source for later; the current application does not display its dock, search Audius or read radio preferences. The retained design uses a small collapsible dock with play/pause, next song, current track and Sound controls. Its panel offers four lo-fi stations and the original village recordings without an individual song catalog. When enabled, stations search Audius in the background and load more tracks as playback advances.

When enabled, station, current track, play/pause state and collapsed state use `cosy-village-radio` in this browser's local storage; older queue and favorites data are retained for compatibility. The active application does not read or overwrite that key. The active `cosy-village-preferences` continues storing the original sound mix and soundtrack choice. Nothing about an individual's listening choices is synchronized to the shared village. The dormant radio panel places master, music, fire, river, wind, rain, nature and effects controls together. The active Sound panel retains the original soundtrack selector and six volume controls; the music activity exposes the same selector and optional sound balance.

The catalog and streams depend on Audius availability. Artist pages are linked beside the current track for attribution. Station results are user-uploaded and have not been individually curated or license-audited for reuse outside Audius playback. Browser autoplay rules still require entering the village or another direct audio action. Remote failures keep the previous track when possible, or return to the local village recordings at startup.

## Garden and pond effects — 2026-09-27

The local addition uses seven original cached procedural effects in `VillageAudio.gardenEffect`: planting, watering, picking, pouring mint tea, crumbs, splash and a soft duck call. They use the existing effects/master buses, explicit Sound activation, visibility guard, distance attenuation and 16-voice effect budget; simple view uses centered output. Fish landing and occasional nearby ducks can play effects while wandering. The recorded music above is unchanged.

[Sound checks](evidence/garden-garden-audio.json) verify non-silent output for all seven effects plus activation/mute/off/disposal and voice limits. [Short preview](evidence/garden-garden-sounds.webm) records the production master bus. Perceptual headphone/speaker balance and physical-phone sound remain unreviewed.

## Puppy yips — 2026-09-29 local

Each of the four breeds has one short recorded bark cut, with subtle runtime pitch variation. Petting schedules a second, lighter yip; an occasional nearby bark gives the village a little life without constant repetition. The four clips come from Brandon Morris's [CC0 dog barking recording](https://opengameart.org/content/dog-barking-mono) and are archived with the [source and modification manifest](puppy-sound-manifest.json); [listen to the four clips](evidence/puppy-yips.mp3). They are decoded only after explicit sound activation, routed through the existing Effects/master buses, spatially attenuated, capped by the existing effect voice budget and silenced by Effects mute or a hidden tab. The browser check verified decode and scheduling, but headphone/speaker judgment and phone output remain open.

## The requirement

The user explicitly replaced the procedural-music direction: use proper recorded compositions that suit the scenery and location, with relevant ambience and effects. This supersedes the former requirement for a generative score. Keep the Arkenfall-inspired sense of place without extracting its soundtrack or Genshin's assets.

The goal is music worth leaving on during a long focus session, inside a village whose sound communicates location and activity. Audio starts only after a deliberate user action. Music, nature and effects remain independently adjustable.

## Original village recordings

`RecordedSoundtrack` in `soundtrack.ts` streams four complete pieces from Holizna's **Quiet Village Collection**, totaling approximately 13.4 minutes. They are locally hosted MP3 files; the runtime no longer imports `composition.ts`, schedules musical notes or loads piano samples. The old composition module and sample files remain archived in the repository for provenance and historical tests.

| Context | Recording | Duration |
| --- | --- | --- |
| Village paths and entrance | Quiet Village 1 | 3:34 |
| Willow pond and tea garden | Quiet Village 2 | 3:20 |
| Focus cottage, writing nook, rainy/dusk exploration away from other landmarks | Quiet Village 3 | 4:16 |
| Village hearth | Quiet Village 4 | 2:16 |

When village recordings are selected, `Follow the scenery` chooses the cue. Explicit activity selection changes it; walking proximity also selects the pond, tea garden, nook and hearth. A 2.5-second stable candidate and a minimum ten-second hold prevent repeated changes near boundaries. Changing the music volume does not change the selected recording.

Two HTML media elements stream through separate Web Audio gains into the music bus. A change crossfades for four seconds, then pauses the old deck. Full pieces repeat through the media element's loop behavior; this is not a claim of sample-perfect musical loops or beat-matched transitions. Failed loads keep the previous recording playing and display a notice. Media load attempts time out after 15 seconds; disposal/cancellation stops pending work. No music assets load while music or master volume is zero.

## A real world soundscape

`audio.ts` decodes three short recordings after explicit activation: stream water, rain and fireplace. Each decoded bed has a 0.8-second crossfaded seam and plays as a continuous Web Audio loop, independent of page timers. Rain responds to weather and the rain slider. Stream and fire use distance attenuation and panning; the stream emitter follows the nearest river segment, while fire switches between the shared hearth and sheltered cottage anchors.

Shared gusts still drive a quiet filtered wind layer. Sparse birds, spirit takeoff/landing, paper, door and completion effects remain locally synthesized effects. The request to stop procedural **music** does not remove these responsive effects. Hovering spirits do not produce walking footsteps. Enabled music and world ambience continue in hidden tabs; movement and interaction effects are suppressed until the page is visible again.

Outdoor listener position follows the spirit, with camera-facing orientation. Settled activities use their authored listening position. Shelter reduces/filter outdoor sound. Firefox's legacy listener methods remain supported when AudioParam coordinates are unavailable.

## Mixer, lifecycle, and performance

- Separate music, ambience and effects buses feed a master compressor. Existing levels are preserved; old preferences default to `Follow the scenery` without changing notes or timers.
- Stop fades for 350 ms, pauses both recordings, clears temporary sources and suspends the context. Master zero also pauses/suspends; world-only unmute resumes without restarting music.
- Only two long recordings stream at once. Three short nature beds are decoded and loop from Web Audio sources; non-effect voices are capped at 32 and effects at 16, including release tails. No full music tracks are decoded into Web Audio buffers.
- Partial nature failure is reported. Missing beds are retried on the next explicit start. Disposal aborts fetches, stops media and generated sources, removes listeners and closes the audio context.
- Local audio payload added by this pass is about 13.7 MB on disk, loaded on demand after activation. This is not an initial-page transfer measurement or constrained-network benchmark.

## Licensing and asset delivery

- [Holizna — Quiet Village Collection](https://opengameart.org/content/quiet-village-collection): CC0, four complete compositions.
- [PagDev — Fireplace Sound loop](https://opengameart.org/content/fireplace-sound-loop): CC0, 20-second excerpt.
- [kurt — Stream Sounds](https://opengameart.org/content/stream-sounds): CC BY 3.0, 18-second excerpt from `stream1.ogg`.
- [Ylmir — Rain (loopable)](https://opengameart.org/content/rain-loopable): CC0, 24-second excerpt from `1.mp3`.

Source URLs, license URLs, modifications, durations, sizes and SHA-256 hashes are recorded in [recordings.json](../../public/village/audio/recordings.json); shipped attribution is in [CREDITS.txt](../../public/village/CREDITS.txt). Tracks were loudness-normalized to −18 LUFS, true peak −2 dB, LRA 11 and encoded to 44.1 kHz MP3. Nature excerpts were normalized to −18 LUFS, true peak −3 dB, LRA 9 and encoded to 32 kHz mono MP3. Runtime gains leave room for the full mix. The output compressor is an additional safeguard, not proof of a comfortable subjective mix.

## Verification and acceptance

Current browser evidence is under `polish-` in [the evidence index](evidence/README.md). The local harness checks streaming playback, recorded world decoding, each context cue, bounded crossfades, manual selection, failed-track preservation, mute/resume, world-only playback, stop/disposal and missing nature files. It measures non-silent master output and can record a 56-second sequence of the four contexts through the actual music/ambience graph.

Historical Firefox files and old offline piano/lo-fi/jazz previews describe the superseded implementation. Do not use those recordings as evidence for this soundtrack.

The [published application release](../../VILLAGE_BUILD.md#2026-09-26-main-release) includes all seven recordings and their credits. Live checks confirmed the deployed manifest matches the committed file and every recording URL returns 200 with the expected byte length. Chromium hearth playback reached Pause music after explicit activation and returned to Play music on stop, with no captured console warnings/errors. This confirms delivery and controls; Firefox streaming and subjective listening remain separate acceptance items.

Remaining acceptance:

- Listen on speakers and headphones through a continuous 15-minute live traversal/focus session. Judge transitions, melody repetition, low-end balance, fatigue and environmental clarity.
- Confirm Firefox streaming-media behavior and physical-phone user activation, interruptions and background/resume behavior for this new soundtrack.
- Test constrained-network loading, mid-track network interruption, full-file repeat boundaries and memory/thermal behavior on target devices.
- Review interaction timing and positioning by ear. An analyser signal, file decode or browser capture does not establish subjective audio quality.
