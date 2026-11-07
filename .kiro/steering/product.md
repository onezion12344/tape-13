---
inclusion: always
---

# Product steering — TAPE 13

## What this is

A 1992 tape answering machine, resurrected as a single static web page. People leave voice
messages for someone who can no longer pick up. The machine keeps them, in order, on one tape.

## Who it is for

- People who found a cassette of a relative's voice and have no machine left to play it.
- People who want to leave a message they will never send.

Design for a 55-year-old who has not used a web app since 2013. Nothing should need explaining.

## Hard product rules

1. **No backend.** No accounts, no sync, no upload, no telemetry. Recordings never leave the
   browser. This is also why the project stays available for the whole judging period for free.
2. **Degradation is the feature.** Playback must sound like 1992 by default, and the user must be
   able to switch it off to hear the difference. Never "fix" the tape sound.
3. **A judge with no microphone must get the full experience.** The demo tape is a first-class
   path, not a fallback. Never gate the interesting part behind a permission prompt.
4. **Every visible control works.** No disabled buttons, no "coming soon". If a control cannot be
   finished this week, it does not ship.
5. **One screen.** No routes, no modals, no onboarding tour.

## Tone of copy

Short, lowercase-ish, mechanical, slightly elegiac. The machine talks in status codes
(`STANDBY`, `TAPE EMPTY`, `MIC DENIED`). Never cute, never jokey about grief.

## Out of scope (do not add)

Transcription, sharing, cloud storage, AI-generated audio, user accounts, dark-mode toggle
(the whole thing is dark), settings page.
