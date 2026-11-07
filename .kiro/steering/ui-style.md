---
inclusion: fileMatch
fileMatchPattern: "**/*.{css,html}"
---

# Visual rules — skeuomorphism, cheaply

No image assets. Everything is CSS: gradients, inset shadows, one mask. If a design idea needs a
PNG, it is the wrong idea for a one-week build.

## Palette (dark room, warm plastic)

| Token | Value | Use |
|---|---|---|
| room | `#0d0908` -> `#060404` radial | page background |
| shell | `#241b16` -> `#170f0c` | machine body |
| plastic | `#d9cdb8` -> `#b3a58c` | keys, lit from above |
| ink | `#2a211b` | key legends |
| amber | `#ffb648` | LED, counter, active state |
| red | `#e6482e` | REC only |
| paper | `#efe6d6` | body text |

One accent only. Amber means "the machine is doing something".

## Physicality rules

- **Light comes from above**, always. Every raised element has a 1px white line at the top and a
  darker line at the bottom.
- **Keys move 3px on press** and lose their drop shadow. No scale transforms — plastic does not
  scale, it travels.
- **The counter is tabular numerals, always 3 digits.** `000`, not `0`.
- **Reels only spin when the transport is moving.** Idle machine is still. Respect
  `prefers-reduced-motion` (no spin at all).
- **Focus must be visible and amber.** This is a real app, not a picture of one.

## Typography

Monospace for everything (status, counter, log). Letter-spacing wide on labels (0.1em+), tight on
the counter. Never a web font — system mono only, so the page loads instantly on a judge's phone.

## Do not

Glassmorphism, neumorphism-but-purple, gradient text, emoji, rounded corners above 20px, shadows
that do not correspond to a light source.
