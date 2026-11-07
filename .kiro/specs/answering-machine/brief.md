# Spec brief — answering-machine

Paste this into Kiro's **Spec** mode as the feature description. Kiro must generate
`requirements.md`, `design.md` and `tasks.md` into `.kiro/specs/answering-machine/` itself.

> This file is the input to the spec, not a substitute for it. Do not hand-write the three spec
> files: the judges are asked to judge *how Kiro was used*, and hand-authored specs are visible as
> such.

---

## Feature

A single-page, offline-capable web app that behaves like a 1992 tape answering machine.

## User-visible requirements

1. **Record** — hold up to 60 seconds per message from the microphone. Show `RECORDING` and blink
   the LED while recording. Stop automatically at 60 seconds.
2. **Persist** — messages survive a page reload (IndexedDB, blob storage). No server.
3. **Play** — messages play back in the order recorded ("one tape"), with a 3-digit counter that
   follows the position. REW/FF move one message.
4. **Treat** — playback passes through a fixed tape-degradation chain (saturation, 3.2 kHz band
   limit, 180 Hz rumble cut, hiss, wow 0.7 Hz, flutter 6.3 Hz). A toggle compares treated vs clean
   without reloading.
5. **Demo tape** — three synthesised takes load without a microphone, generated in code, so a judge
   who denies mic permission still experiences the chain.
6. **Import** — drag and drop an existing audio file onto the machine.
7. **Honest failure** — if the mic is denied or storage is blocked, say so in the LED and keep the
   demo path working.

## Acceptance criteria (each must be checkable by a human in under 30 seconds)

- AC1: record a 5-second message, reload the page, the message is still listed.
- AC2: with the toggle on, the same recording has audibly less high end and a slow pitch drift; with
  it off, it is clean. Difference is obvious on laptop speakers.
- AC3: pressing STOP mid-playback leaves no sound and no running oscillators (verify by playing five
  times in a row — noise floor must not increase).
- AC4: with microphone permission denied, "Load demo tape" still plays three takes in sequence.
- AC5: on a 390px-wide viewport, all five transport keys are visible without horizontal scroll.
- AC6: `node --check app.js` passes, and the page runs from `python3 -m http.server` with no build
  step and no network requests.

## Non-goals

Backend, accounts, sharing, transcription, analytics, framework, build tooling, TypeScript.

## Property-based tests to include in `tasks.md`

- **P1 (determinism)** — `encodeWav` of the same float array twice produces byte-identical output.
- **P2 (band limit)** — after the lowpass stage, energy above 4 kHz is at least 30 dB below energy
  below 3 kHz for any input signal.
- **P3 (no leak)** — after N play/stop cycles, the number of live source nodes returns to zero.
- **P4 (round trip)** — any signal in [-1, 1] survives WAV encode/decode with error < 1/32768.
