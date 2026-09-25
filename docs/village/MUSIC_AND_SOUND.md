# Procedural music and world sound

Updated: 2026-09-25. Production specification and remaining acceptance for `AUDIO-01` and `AUDIO-02`, coordinated with `WIND-01` and `MOVE-01`. Start with the [canonical handoff](../../VILLAGE_HANDOFF.md) and [movement/event specification](MOVEMENT_AND_WORLD.md).

## The requirement

The user explicitly wants procedural music to be **WAY better**, plus world sound with Arkenfall as a heavy reference. Treat this as a substantial composition, arrangement, instrument and soundscape redesign. Adding more random notes, more reverb or louder ambience to the current loop will not satisfy it.

The goal is music worth leaving on during a long focus session, inside a village whose sounds explain where the player is and what they are doing. Exploration should feel alive without constant noise or intrusive feedback. Use original or appropriately licensed material; do not extract Arkenfall's soundtrack or effects.

## Implemented now

`composition.ts` now plans seeded bars independently of ambience randomness: a five-section, 40-bar form with motif development, bounded harmony/register, inversions, cadences and rests. Piano (66 bpm), lo-fi (76 bpm) and jazz (84 bpm) have distinct accompaniment and instrumentation. Native synthesis provides bass/kick/brush/hat layers; existing attributed piano samples remain. New bars adopt preset/place choices without restarting the form. This is implemented composition structure, not a listening-quality verdict.

`audio.ts` uses separate music/ambience/effects buses, retained rain/fire controls and optional new `ambience`/`effects` preferences. Old preferences gain defaults without changing notes or timers. World panners use a traveler-origin listener with camera orientation outdoors; settled activities use their authored look target. Water position follows the nearest part of the river; the fire switches between hearth and cottage. Shared gusts and shelter control wind and filtering. Stone/wood/soil/grass each have six synthesized footstep buffers with no immediate repeat; contact events come from achieved locomotion phase. Jump/land, sparse birds and door/paper/fire details are synthesized locally.

Explicit activation loads/decodes samples with loading feedback and a visible fallback message when incomplete. Stop fades, clears voices and suspends the context after 350 ms; master zero suspends it. Musical voices are limited to 32, effects to 16, including release tails. Hidden tabs mute ambience/effects; deliberately selected music can continue. Delayed scheduling drops overdue events rather than replaying a burst. Disposal aborts loading, removes listeners, stops sources and closes the context.

The QA harness can render 120 seconds plus tail for each preset using the actual score and instrument methods, and records sample peak/RMS. Those offline previews do not certify a live 15-minute session, headphone/speaker mix, full traversal audio, sample-failure behavior, or subjective musical quality. All listening gates below remain open.

## Firefox compatibility and current evidence

The reported silence came from assuming `AudioListener.positionX` and the other listener AudioParams existed in Firefox. `audio.ts` now feature-detects that API and falls back to `setPosition` / `setOrientation`. `Village.tsx` stops a failed start and restores the off state, rather than leaving a broken playing indicator. Explicit user activation remains required. The outdoor fire emitter follows the shared `HEARTH` anchor at `(−5.8, −19)`; sheltered cottage audio retains its separate position.

- Actual Firefox 156 decoded all 14 samples and produced a running, non-silent master-bus signal through the legacy listener API: peak 0.04446, RMS 0.00707. See [audio-output.json](evidence/audio-output.json).
- [Nine Firefox lifecycle checks](evidence/audio-lifecycle.json) pass: decoding, starting muted, unmute/resume, 16-effect cap, leaving shelter, legacy listener updates, overdue-note discard, stop/suspend and reported sample failure. Resume is asynchronous; the test waits for the running state instead of assuming 80 ms is sufficient.
- The final [movement recording](evidence/motion.webm) includes stereo Opus audio from the master bus before the output compressor. Production-preview sound on/off controls were also checked with no captured console errors.

This verifies compatibility, lifecycle and graph output. No speaker/headphone review or 15-minute live listening session has been completed; perceptual footstep synchronization, preset quality and long-session comfort remain open. The [evidence index](evidence/README.md) distinguishes these live checks from the earlier offline music previews.

## Historical prototype source audit (before this milestone)


[audio.ts](../../features/village/audio.ts) implements `VillageAudio` with native Web Audio. The village does not use the older Tone.js music engine, even though Tone.js remains a project dependency.

- Audio starts only after a user action. Fourteen locally served Salamander piano samples are selected by nearest pitch, with playback-rate transposition and a sine-based fallback.
- The scheduler uses a 100 ms interval and approximately 250 ms lookahead. The current beat length is about 0.54 seconds for jazz and 0.64 seconds otherwise.
- Four fixed chord arrays cycle through a 16-step pattern: `[48,55,59,62,67]`, `[45,52,55,59,64]`, `[41,48,52,57,60]`, `[43,50,53,57,62]`. Melody enters at repeating step positions. Preset differences are small: filtering, extra notes and a low pulse rather than genuinely different arrangements.
- A low-pass filter, randomized convolution reverb and compressor shape the output. These processing choices do not establish musical quality.
- Rain and fire come from filtered looping random noise. Place changes adjust fire gain. There is no positional river/fire emitter system, occlusion, surface footstep library, cloth, doors, wind field or contact-linked landing sound.
- `stop` fades the master level; the context/noise sources are not equivalent to a fully suspended audio graph. Lifecycle and hidden-tab behavior need deliberate redesign and testing.

The prior UI test showed that audio could enter the playing state and stop. **It did not certify listening quality.** The existing piano samples can be useful raw material, but their license and quality do not make the current composition finished.

## Music direction and composition engine

Keep genuine generative/procedural composition. It can use authored motifs, phrase grammars, curated performances and recorded layers, but do not silently replace the request with a short looping MP3.

### Form before ornament

Build a seeded musical plan over phrases and sections, then schedule performance details. A useful starting form is an opening motif, an answering phrase, a varied return, a contrasting section and a quieter resolution. Plan 8–16-bar phrases and a multi-minute arc, with larger variation over a long session. These are production starting points, not a demand that every style use identical form.

The generator should understand:

- A bounded key/mode, chord vocabulary and register for each style.
- Voice leading and chord inversions that reduce awkward jumps; bass and melody with independent but coherent roles.
- Memorable short motifs, development and deliberate repetition. Small rhythmic/melodic transformations should feel related.
- Cadences, tension/release, rests and space. Do not run an uninterrupted arpeggio because the scheduler always has another slot.
- Density and energy envelopes across phrases. Introduce/remove layers at musical boundaries rather than randomly every beat.
- Performance timing, velocity, articulation and pedal behavior with narrow human variation. Randomization should preserve groove and phrase intention.
- Reproducible seeds for review and regression. Keep composition randomness separate from incidental ambience randomness.

Avoid long-session failures: abrupt key jumps, repeated unresolved dissonance, incessant high notes, bass build-up, identical cadences every few seconds, machine-like velocity, overlong tails and obvious sample pitch artifacts.

### Presets must sound different

| Preset | Musical identity | Production needs |
| --- | --- | --- |
| Piano | Intimate, spacious, warm solo or near-solo piano; clear melodic phrases and gentle accompaniment | Good velocity/articulation handling, convincing sustain/release, limited register, restrained room sound. Felt-piano color is a direction, not a claim about current samples. |
| Lo-fi | Soft keys, rounded bass, relaxed rhythm and carefully controlled texture | Actual complementary instruments and a coherent groove; subtle swing/velocity variation; optional low-level texture. Not just a piano low-pass filter. |
| Jazz | Calm jazz harmony, expressive voicings, bass movement and light rhythmic conversation | Appropriate keys, bass and brush/percussion sources or synthesis; coherent phrasing and sparse tasteful melodic development. Not just extra chord notes. |

A gentle original village motif may connect presets. Restrained plucked/woodwind colors can support the fantasy setting if they fit; avoid piling every “cozy” instrument into every arrangement. Any added sample library needs documented rights, size, quality and loading behavior.

### Contextual arrangement

Places should influence instrumentation, density and acoustic feel without restarting the composition on each boundary. Weather can alter energy subtly. Move harmonic/arrangement changes at phrase or bar boundaries; fade ambience independently over a few seconds. Preserve musical continuity when visiting a cottage or opening a menu.

Music is available throughout the village and in simple view. Do not force a destination-specific soundtrack on a user who chose a preset. Retain the user's mix and stop/mute choices across interactions.

## A real world soundscape

Use layered, varied sounds with spatial placement and restrained density. Recordings or carefully designed synthesis can both work; a single filtered noise loop is insufficient for all sources.

| Sound family | Behavior and integration |
| --- | --- |
| Stream / pond | Localized water near banks/bridge, broader quiet bed at distance; distinct small ripples, stream flow and rain-on-water where appropriate. |
| Hearth / cottage fire | Spatial crackle and occasional small pops, no relentless loud transients; indoor room response differs from the open hearth. |
| Wind / foliage | Broad wind bed plus local rustle, driven by the same gust state as vegetation/cloth. Sheltered areas and interiors reduce exposure. |
| Village life | Sparse distant birds, wood creaks and occasional appropriate background detail. Give events space; avoid obvious repeating loops or implying crowds the scene does not contain. |
| Footsteps | Stone, wood, soil and grass sets with contact timing, speed/weight variation and restrained stereo/spatial behavior. Start with at least six useful variations per major surface and avoid immediate repeats. |
| Character | Quiet coat/satchel/cloth motion where audible; takeoff and soft landings scaled by motion. No loud impact for every small hop. |
| Interactions | Door/latch, postbox/paper, chair or other actual interaction sounds. Trigger only when the corresponding action occurs. |
| Weather | Rain beds, roof/window droplets and exposed ground impacts where relevant; smooth changes in shelter and weather states. |

Use positional emitters and a defined listener transform. Choose and document whether the listener follows the camera or traveler; camera orientation with a stable nearby origin is a reasonable starting point, then test third-person perception. Activity cameras need a deliberate sound position so a scene transition does not create abrupt impossible sound movement.

Apply distance attenuation and modest indoor/occluded low-pass/reverb transitions. A simple zone/portal model can be sufficient for this village; do not introduce expensive ray-based acoustics without a measured need. Do not pan all ambience hard left/right, and verify headphones plus speakers.

Footstep and landing events must come from actual animation/controller contacts. Walking into a wall should not produce continuing running footsteps. Use the achieved speed and surface classification proposed in [the shared event contract](MOVEMENT_AND_WORLD.md#shared-world-contracts--implementation).

## Mixer, lifecycle, and performance

Proposed mixer: **Music, Ambience, Effects, Master**, with simple controls and retained user preference. Map existing rain/fire controls intentionally if the data model changes; do not silently discard settings. A richer mixer can be progressive disclosure, not a permanent bank of sliders over the world.

- Preserve explicit user activation, reliable mute and a silent initial state. Never autoplay after reload because an old preference says “on.”
- Schedule musical events against `AudioContext.currentTime`; timer intervals only fill the scheduling window. Resume without firing an accumulated queue of stale notes.
- Load samples deliberately, show real loading/error state, and handle decoding/network failure. An oscillator fallback may keep the app functional but must not masquerade as the finished instrument.
- Pool transient sources and bound polyphony. Initial planning limits around 32 musical voices and 16 transient effects are starting points to profile, not current guarantees. Long release tails count.
- Avoid per-frame node creation. Reuse routing, ramp gain/filter parameters to prevent clicks, disconnect ended sources, release buffers when appropriate, and dispose cleanly.
- Decide and document the hidden-tab policy. Foreground exploration ambience should not waste CPU while hidden; user-selected focus music may warrant continuing. Stop/mute must meaningfully reduce work, and focus timers remain wall-clock based.
- Separate music dynamics from effects. Keep completion cues gentle and optional within the sound controls. Prevent wind/rain from masking the music at ordinary settings.

## Licensing and asset delivery

The current Salamander samples are attributed to Alexander Holm under CC BY 3.0, distributed here through the Tonejs/audio source. Preserve [credits](../../public/village/CREDITS.txt) and [the sample license](../../public/village/audio/Salamander-LICENSE.txt).

For every new audio asset, deliver source/creator, exact license, attribution requirements, any modifications, sample rate/channels, duration, encoded/decoded size, loop points if relevant, and intended use. Verify seamless loops by listening. Separate source masters from browser delivery formats. Unknown licensing is not a finished deliverable; meaningful external costs require the task's authorization.

Generated music/effects need tool/model provenance and usage rights as well. Do not claim a recording, instrument sample or imitation came from a particular artist/game unless it actually did and is authorized.

## Verification and acceptance

Code checks can verify scheduling/state/data behavior. They cannot certify composition or a pleasant mix. Required evidence:

1. **Music samples:** provide at least two minutes of each preset from recorded output, with seed, tempo/key if applicable, generation version and mix settings. Demonstrate several seeds and a real contrasting section/return, not three nearly identical clips.
2. **Long-session listening:** record and listen to a continuous 15-minute session, including regeneration/preset or place transitions. Note repetition, phrase endings, artifacts, excessive density and fatigue. Listen on headphones and ordinary speakers where available; state the equipment and what was actually heard.
3. **World traversal:** capture audible entrance → bridge → hearth → cottage and back, with surface changes, sprint/jump/landing, gusts and rain. Confirm distance, orientation, shelter, synchronization and volume continuity.
4. **Technical behavior:** test first activation, sample failure, stop/start, all mixer levels, rapid place changes, hidden/resume, reload, headphones/speakers and at least the target browser family. No clicks, stale-note bursts, accumulating nodes or unbounded voices.
5. **Output checks:** measure peak levels/clipping and inspect loudness consistency at the actual master settings. An initial sample-peak ceiling of −1 dBFS is a useful headroom target; do not call it a true-peak measurement without the appropriate meter. Verify the complete mix, including effects and completion cues.
6. **Deterministic regression:** retain a small set of musical seeds and expected structural properties, plus tests for event scheduling, cancellation and bounded voices. Avoid brittle assertions that mirror every sample value while missing audible problems.

Record musical and mix criticisms honestly, alongside implemented fixes and remaining limits. `AUDIO-01` closes only when the new generator has convincing form, distinct styles and listening evidence. `AUDIO-02` closes only when the world is audibly responsive in actual traversal. A successful audio-start promise or a “playing” label closes neither.
