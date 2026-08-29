# AGENT IMPOSTER — Design System

**Source of truth:** Claude Design project `6b809d94-c484-4764-979a-58d1771f6ece`,
design system `_ds/modernist-7dfaa098`, treatment **2a — Live Match (Playful)**.

**Implemented in:** [frontend/src/app/globals.css](frontend/src/app/globals.css) — every token
and component class below lives there. Never hard-code a hex, font, radius or spacing value
that a token already carries.

---

# 1. The System in One Paragraph

Modernist is flat and architectural, set entirely in **Archivo**, on a warm off-white ground
with a single reserved red. Structure comes from alignment and strong 2px dividers rather than
decoration. The **Playful pass** keeps that ink, type and restraint but softens every corner and
gives the crew idle motion — the result reads as a game without becoming a toy.

Not a dark space theme. Not neon. The drama comes from one red used sparingly against a calm
paper ground.

---

# 2. Color

## 2.1 Roles

| Token | Value | Use |
|---|---|---|
| `--color-ground` | `#e9e6e4` | The page behind the shell |
| `--color-bg` | `#f3f2f2` | Panel ground, text on dark |
| `--color-surface` | `#eae9e9` | Cards, rooms, market rows, chat bubbles |
| `--color-text` | `#201e1d` | Ink; also the header bar fill |
| `--color-accent` | `#ec3013` | Sabotage, live, primary action, the recap banner |
| `--color-divider` | `ink @ 40%` | 2px rules and the 2px grid gaps |

## 2.2 Ramps

`--color-neutral-100…900` and `--color-accent-100…900`, generated in OKLCH on one shared
lightness scale — the same step of either ramp carries the same visual weight.

- **100–300** — tinted fills, hovers, subtle borders
- **500** — the role's base
- **700–900** — text on tinted fills, pressed states

Prefer a ramp step over an ad-hoc `color-mix()`.

> **Contrast:** the accent-on-ground pair is tuned to ~3:1 — enough for icons, large text and
> chrome, **not** for body copy. For paragraph-size text in accent use `--color-accent-700`.

## 2.3 Agent color

Each agent is one **OKLCH hue** at two fixed lightness steps — body `oklch(0.62 0.09 H)`,
backpack and legs `oklch(0.52 0.09 H)`. Only the hue varies, so no agent can read as louder
than another.

| Agent | Hue | Reads as |
|---|---|---|
| ATLAS | 250 | blue |
| BYTE | 155 | green |
| CIRCE | 305 | purple |
| DELTA | 75 | ochre |
| ECHO | 205 | cyan |
| FLINT | 340 | pink |

DELTA's hue 75 was added to the comp's five — it sits in the wide gap between 340 and 155 and
stays clear of the accent's ~30.

**Color is never the only channel.** Every agent also carries its name in Archivo 800 and, on
the map, a letter tag. A viewer who cannot separate 205 from 250 still reads ECHO from ATLAS.

The visor is `--visor` `#cfe3ef` on every crewmate, always — it is what makes the silhouette
legible at 20px.

---

# 3. Type

**Archivo** for everything, at 400 / 600 / 800. Headings are always 800 with `-0.015em`
tracking; body is 15px / 1.55.

| Role | Spec |
|---|---|
| Match title | Archivo 800, 24px |
| Recap headline | Archivo 800, 26px |
| Section heading | Archivo 800, 17px |
| Agent name | Archivo 800, 12–15px |
| Body | Archivo 400, 13.5–15px |
| Kicker (`.kicker`) | 10px, `.12em`, uppercase |
| Numbers, clocks, addresses, odds | **`ui-monospace`** |

Every number a viewer might compare — stake, payout, odds, share %, countdown, wallet address,
timestamps — is monospace. This is the one non-negotiable typographic rule in the product: it
makes the market scannable.

---

# 4. Radius — a deliberate deviation

Base Modernist is **`--radius-*: 0`** and its readme says *"do not round a corner anywhere."*
The Playful pass overrides this on purpose, and that override is the single largest departure
from the parent system.

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 12px | Speech bubbles |
| `--radius-md` | 16px | Market rows, toast |
| `--radius-lg` | 20px | Room cards |
| `--radius-xl` | 22px | The bet ticket |
| `--radius-shell` | 28px | The outer shell |
| `--radius-pill` | 999px | Buttons, badges, nav, chips, crew pills |

Chat bubbles use an asymmetric `16px 16px 16px 5px` so the corner points back at the crewmate
that spoke.

If this treatment is ever merged back into the design-system page, the radius scale is the
thing to reconcile — everything else is already compliant.

---

# 5. Space & Elevation

Spacing: `4 · 8 · 12 · 16 · 24 · 32`.

Elevation is ink-tinted and soft, never a hard drop shadow — with one exception:

| Token | Use |
|---|---|
| `--shadow-shell` | `0 18px 50px` — the app shell floating on the ground |
| `--shadow-lift` | Room card hover |
| `--shadow-lift-accent` | Sabotage room hover, tinted red |
| `--shadow-ticket` | The bet ticket |
| `--shadow-toast` | Transaction toast |

**The exception:** the "Lock it in" button uses a hard offset shadow
`0 6px 0 var(--color-accent-700)` that compresses to `0 2px 0` on press and lifts to `0 8px 0`
on hover. It is the only physical-feeling control in the product, and it is deliberately the
one that spends money.

---

# 6. Motion

One easing for everything: `--ease: cubic-bezier(.2, 0, .2, 1)`.

| Duration | Token | Use |
|---|---|---|
| 80ms | `--dur-press` | Button press |
| 120ms | `--dur-fast` | Small hovers |
| 160ms | `--dur-base` | Card and row hovers |
| 300ms | `--dur-enter` | New chat line arriving |

**Idle keyframes** — these are what make the office feel inhabited:

| Keyframe | Meaning |
|---|---|
| `bob` | Standing around, alive. Every crewmate gets a different duration and delay so they never sync |
| `waddle` | Moving — used for the agent caught mid-sabotage |
| `shine` | Light sweeping across a visor |
| `pulseDot` | Live indicator, sabotage badge, typing dots, the countdown |
| `ringOut` | Expanding accent ring on the LIVE badge |
| `tickerIn` | A chat line entering, 8px up-fade |
| `toastIn` | Transaction toast sliding in from the right |
| `growBar` | Market share bar filling on load |
| `wobbleStamp` | The ejected crewmate landing on the recap strip |

Staggering matters: six crewmates bobbing in lockstep looks like a bug. Durations run
2.2s–3.4s with delays of 0–0.8s.

`prefers-reduced-motion` collapses every animation and transition to 0.01ms.

---

# 7. The Crewmate

The one piece of custom art, drawn in DOM at a base height of **44px** and scaled
proportionally from there. Implemented in
[frontend/src/components/Crewmate.tsx](frontend/src/components/Crewmate.tsx).

**Anatomy** (at 44px): backpack `11×20` offset `-7px` left · body `38×44`, radius
`19 19 14 14`, with an `inset 0 -6px 0 rgba(0,0,0,.09)` to ground it · visor `26×14` at
`+9,+10` · two legs `10×6` hanging `-4px` below · letter tag centred `13px` above.

**Three renderers:**

| Component | Where | Why |
|---|---|---|
| `<Crewmate>` | Office map, bet ticket, recap, lobby | Full character with visor, legs, tag |
| `<CrewmateGhost>` | A room holding an eliminated agent | Tipped 90°, drained to neutral, 45% opacity |
| `<CrewBlob>` | Market rows, chat, crew pills | Silhouette only — no visor or legs. Below ~30px the detail becomes noise |

**States:** `accused` draws a 3px accent ring at 3px offset. `badgeAccent` turns the letter tag
red. Dead agents lose their hue entirely — elimination should be visible at a glance.

---

# 8. Screen Anatomy — Live Match

```
┌──────────────────────────────────────────────────────────┐
│ TOPBAR         dark ink bar, brand bean, nav, wallet     │
├──────────────────────────────────────────────────────────┤
│ MATCHBAR       LIVE · title · round meta · countdown     │
├───────────────────────────────┬──────────────────────────┤
│ OFFICE MAP    3×2 room grid   │ CHATTER                  │
│ CREW STRIP    6 pills         │  bubbles + system events │
│ ───── 2px rule ─────          │  typing indicator        │
│ MARKET        4 outcome rows  │ BET TICKET               │
│               share bar behind│  stake, payout, lock     │
│                               │ TOAST                    │
├───────────────────────────────┴──────────────────────────┤
│ RECAP STRIP    full-bleed accent, ejected crewmate       │
└──────────────────────────────────────────────────────────┘
```

Grid is `1fr 400px` with a **2px gap over a divider-coloured ground** — the rule between the
panels is the gap itself, not a border. This is the Modernist "let the grid show" instruction
applied literally.

## 8.1 Room states

| State | Treatment |
|---|---|
| `default` | Surface fill, transparent 2px border, lifts 3px on hover |
| `sabotage` | Accent-100 fill, solid accent border, corner bleed, pulsing SABOTAGE badge, mono forensics line |
| `empty` | Dashed neutral border, no lift — nothing happened here |
| `ghost` | Neutral-200 fill, GHOST badge, holds the tipped crewmate |

## 8.2 Market row

The share bar is **absolutely positioned behind the row content**, animating `growBar` on
mount; every sibling is `position: relative` to sit above it. The leading outcome fills in
`--color-accent-200`, the rest in `--color-neutral-300`. Row hover slides 3px right — motion
away from the map, toward the ticket.

---

# 9. Rules

**Do**

- Take every value from a token.
- Let the grid show — equal cells, 2px rules between sections.
- Keep the accent scarce. It marks exactly three things: **live**, **sabotage**, and **the
  action that spends money**. The recap banner is the one place red runs as a field.
- Give every interactive element a hover tint *and* a pressed state.
- Set every comparable number in mono.
- Stagger idle animation.

**Don't**

- Don't add a second accent hue. `--color-accent-2-*` is a machine-derived stand-in that
  resolves to the same role — treat the palette as mono.
- Don't use `--color-accent` for body-size text; use `--color-accent-700`.
- Don't leave the browser's default focus ring — `:focus-visible` is a 2px accent outline at
  2px offset, already global.
- Don't let color alone carry agent identity.
- Don't sync the crew's idle loops.

---

# 10. Where This Meets the Engine

[prd.md](prd.md) §7.1 fixes the playback schedule — moves at 600ms, kills at 1800ms,
eliminations at 2500ms. Those are **event pacing**, and they are deliberately an order of
magnitude slower than the interaction durations in §6 above. A hover must feel instant; a
death must be allowed to land.

When `simulate.ts` lands, the UI contract is
[frontend/src/lib/match.ts](frontend/src/lib/match.ts) — swap `demoMatch` for a value derived
from the engine's event log and nothing in the component tree changes.

One hard constraint carried over from the PRD: the browser must never receive
`imposterId`. Nothing in this design system needs it — the accused ring, the flagged crew pill
and the market share bar are all derived from **public** events only.
