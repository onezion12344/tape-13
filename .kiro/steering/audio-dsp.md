---
inclusion: fileMatch
fileMatchPattern: "app.js"
---

# Audio rules — the tape chain

Playback goes through this graph, in this order, and the order matters:

```
AudioBufferSourceNode
  -> WaveShaper (soft saturation, tanh curve, oversample 2x)
  -> BiquadFilter lowpass  3200 Hz, Q 0.7      (telephone-grade band limit)
  -> BiquadFilter highpass  180 Hz             (kills DC and room rumble)
  -> destination

parallel:
  white-noise loop -> Gain 0.014 -> destination   (hiss is a source, not a filter)
  Oscillator 0.7 Hz  -> Gain 0.006 -> source.playbackRate   (wow)
  Oscillator 6.3 Hz  -> Gain 0.0018 -> source.playbackRate  (flutter)
```

## Non-negotiables

- **Wow and flutter modulate `playbackRate`, never a delay node.** A delay gives a chorus; a rate
  change gives a worn capstan. If it sounds like a guitar pedal, it is wrong.
- **Depth stays subtle.** Wow depth above 0.01 becomes seasick on headphones. Flutter above 0.003
  becomes a ring modulator.
- **Hiss is uncorrelated white noise, low level.** Do not gate it — tape hiss never stops, it only
  gets masked.
- **The "clean" path must be a genuinely separate branch**, not the same chain with gain at zero,
  so an A/B switch is honest.
- **`stopEverything()` must tear down oscillators and noise sources**, otherwise each playback
  leaks an oscillator and the page slowly fills with ghosts. Every node started must be stopped.
- **Autoplay policy:** always `await` a user gesture before `AudioContext.resume()`. Never create a
  context on page load.

## When in doubt

Re-record a 1992 reference in your head: a voice through a 3 kHz phone line, sitting under hiss,
with a slow pitch drift you notice only on long vowels. Match that, not a Spotify filter preset.
