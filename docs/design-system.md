# Design system

Colours come from the club's kits. Nothing here was picked for taste.

## Sources

| Token | Hex | Source | Evidence |
|---|---|---|---|
| men-green | #03994B | Sampled | Patterned home kit, two photos (#03994B, #1EAC53) |
| men-green-bright | #03CA29 | Sampled | Solid green kit, one heavily edited photo |
| men-yellow | #F1B40F | Sampled | Midpoint of #E9B207 and #F9B717, warm-light photos |
| men-gold | #C7A84A | Specified | Club spec. Photo sample #BE9E53 agrees |
| starlets-blue | #4A5BAB | Sampled | Zigzag band, collar and cuffs |
| starlets-pink | #EB8AE7 | **Provisional** | One edited photo; likely too magenta |
| starlets-black | #000000 | Assumed | Sample #161B37 carried a blue cast |
| pitch | #011E0F | Derived | men-green at 6% lightness |
| men-green-ink | #02783B | Derived | men-green darkened to pass 4.5:1 on white |
| starlets-blue-glow | #949FD1 | Derived | starlets-blue lightened to pass 4.5:1 on pitch |

Derived colours are supporting shades, never presented as kit colours.

## Kits (content, not tokens)

Kits are club content and will be managed as data with real photos.

- Men: patterned green with yellow shorts; solid green with gold trim and mustard shorts; yellow; gold.
- Starlets: white with a blue zigzag gradient band, blue collar and cuffs, white shorts; pink with black shorts.
- The red-and-white "MARINES FC" kit is a former kit: history content only.
- The yellow kit's printed credit is not mentioned anywhere on the site.

## Contrast rules

- Men's green, yellow, gold and bright green all fail as text on white. Use them on
  pitch, or as fills. Green text on white uses men-green-ink.
- Starlets blue passes on white and fails on pitch; use starlets-blue-glow there.
- Yellow and pink fills always carry pitch text.

## Motion

Motion is built to read like matchday broadcast graphics: quick, decisive, and
always saying something. The tokens and every animation live in
`web/src/app/globals.css` under "Motion".

### Rules

1. **Only transform and opacity move**, plus a stroke or shadow where the
   thing being drawn is a line. Nothing animates layout, so nothing moves
   under a supporter's thumb.
2. **150–700ms, decelerating** on the quint curve (`--ease-out-motion`).
   Entrances finish inside a second.
3. **CSS first.** Reveals are scroll-driven (`animation-timeline: view()`),
   entrances are keyframes that run as the HTML paints, page changes use the
   View Transitions API. Unsupported browsers show final content.
4. **Reduced motion means none.** Every animation sits inside
   `prefers-reduced-motion: no-preference`; without it, content is simply in
   its final state.
5. **Motion carries information or it is cut**: the order results were
   played, which row is ours, that a form was sent, that today is match day.
   Scores are never counted up from nought; season totals may be.

### Tokens

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 150ms | Presses, small state changes |
| `--motion-base` | 300ms | Hover and focus feedback |
| `--motion-slow` | 600ms | Entrances |
| `--ease-out-motion` | cubic-bezier(0.22, 1, 0.36, 1) | Almost everything |
| `--ease-in-out-motion` | cubic-bezier(0.65, 0, 0.35, 1) | Loops (shimmer, match-day pulse) |

### Inventory

| Where | What | How |
|---|---|---|
| Homepage hero, team headers | Kit bar draws in, name rises word by word, lines follow | Keyframes (`.entrance-*`) |
| Every page change | Body crossfades; player photos and story pictures morph between pages | React `<ViewTransition>` |
| Match cards | Goals roll up like a scoreboard, home then away | Scroll-driven (`.score-roll`) |
| Section headings | Rule draws itself, led by a short accent bar | Scroll-driven (`.heading-rule`) |
| Grids, league table | Items arrive a beat apart; our row is swept with the accent | Scroll-driven (`.stagger`, `.table-reveal`) |
| Cards | Accent bar slides in on hover and keyboard focus | Transition (`.card-bar`) |
| Header, articles | Header gains depth on scroll; reading progress along its edge | Scroll-driven (`.site-header`, `.reading-progress`) |
| Mobile menu, photo viewer | Rise or scale in; contents cascade | `@starting-style` on `<dialog>` |
| Buttons | Compress on press; arrow nudges on hover | Transition |
| Homepage fixtures | Ticket stack: swipe, fan on hover, buttons for keyboards | `motion` (`FixtureTickets`) |
| Team page | Form pills pop in oldest first; win-rate ring fills | Scroll-driven (`.form-guide`) |
| Season totals | Roll up to their value once, below the fold only | `StatNumber` (IntersectionObserver) |
| Partners | Logos glide; pause on hover; five or more partners only | Keyframes (`.marquee`) |
| Skeletons | Diagonal shimmer | Keyframes (`.skeleton-shimmer`) |
| Public forms | Success tick draws itself | Stroke keyframes (`.success-tick`) |
| Match day | Highlight ring on the day's ticket, pulsing | Keyframes (`.matchday-ring`) |

## Outstanding

- Crest file. It should confirm or change the dominant colour.
- A clean, unedited photo of the pink kit.
