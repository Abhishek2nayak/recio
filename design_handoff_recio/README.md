# Handoff: Recio — Async Screen Recording & Knowledge Sharing Platform

## Overview

Recio is a Loom-alternative async communication platform focused on **capturing and sharing knowledge** (not just recording video). This handoff covers a complete 5-screen interactive product flow built as a high-fidelity HTML prototype.

The design system is built around a **capture reticle** logomark (precision corner brackets), a cool neutral light-first palette with a single electric accent, and two type families: **Hanken Grotesk** (UI/display) + **JetBrains Mono** (timecodes, labels, metadata).

---

## About the Design Files

The files in this bundle are **design references created in HTML** — high-fidelity prototypes showing the intended look, feel, and behavior of the Recio UI. They are **not production code to copy directly**.

Your task is to **recreate these designs in your existing codebase** (React, Next.js, etc.) using its established component libraries, routing, and state patterns. Use these files as a pixel-level visual and behavioral specification.

Open `Recio.html` in a browser to interact with the full prototype. Use the **flow pill** at the top center to jump between screens. Open **Tweaks** (bottom-right corner) to explore the three visual directions and layout variants.

---

## Fidelity

**High-fidelity.** These are pixel-accurate mockups with final colors, typography, spacing, iconography, hover states, and micro-interactions. Recreate the UI pixel-precisely using your codebase's existing patterns and tooling.

---

## Design Tokens

All tokens are defined as CSS custom properties in `Recio.html` under `:root`. Reference these when mapping to your design system (Tailwind config, theme tokens, etc.).

### Color System

```css
/* Cool neutral surfaces — light mode */
--paper:      oklch(0.984 0.003 255)   /* page background */
--surface:    oklch(1 0 0)             /* card / panel background */
--surface-2:  oklch(0.972 0.004 255)   /* subtle inset background */
--surface-3:  oklch(0.955 0.005 255)   /* deeper inset */
--line:       oklch(0.918 0.005 258)   /* default border */
--line-2:     oklch(0.872 0.006 258)   /* stronger border */

/* Ink (text) */
--ink:        oklch(0.235 0.013 262)   /* primary text */
--ink-2:      oklch(0.455 0.011 262)   /* secondary text */
--ink-3:      oklch(0.612 0.009 262)   /* tertiary text */
--ink-4:      oklch(0.722 0.007 262)   /* placeholder / metadata */

/* Near-black HUD (recording overlay) */
--hud:        oklch(0.205 0.011 262)   /* HUD background */
--hud-2:      oklch(0.262 0.012 262)   /* HUD hover surface */
--hud-line:   oklch(0.36 0.012 262)    /* HUD border */
--hud-ink:    oklch(0.96 0.004 255)    /* HUD primary text */
--hud-ink-2:  oklch(0.74 0.008 258)    /* HUD secondary text */

/* Accent — three theme directions */
/* Pulse (default) — electric green */
--accent:     oklch(0.77 0.175 150)
--accent-2:   oklch(0.70 0.175 150)    /* hover state */
--accent-ink: oklch(0.22 0.05 150)     /* text on accent */
--accent-soft:oklch(0.95 0.045 150)    /* tinted surface */
--accent-ring:oklch(0.77 0.175 150 / 0.35) /* focus ring */

/* Tide — electric cyan */
--accent:     oklch(0.72 0.13 232)
--accent-ink: oklch(0.99 0.01 232)

/* Ink — monochrome (single electric-green "live" spark survives) */
--accent:     oklch(0.30 0.012 262)
--accent-ink: oklch(0.98 0.003 255)
--live:       oklch(0.76 0.18 150)     /* recording indicator only */
```

### Hex approximations (for tools that don't support oklch)

| Token | Approx hex |
|---|---|
| `--paper` | `#F8F8FC` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F3F3F8` |
| `--line` | `#E4E4ED` |
| `--ink` | `#2A2A38` |
| `--ink-2` | `#626274` |
| `--ink-3` | `#8E8EA0` |
| `--ink-4` | `#AEAEBF` |
| `--hud` | `#28283A` |
| `--accent (Pulse)` | `#5CE87A` |
| `--accent (Tide)` | `#38C6DD` |

### Typography

```
Display / headings:   Hanken Grotesk, 700–800 weight
Body / UI:            Hanken Grotesk, 400–600 weight
Monospace / metadata: JetBrains Mono, 400–600 weight
```

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

Type scale used in the prototype:

| Use | Size | Weight | Letter-spacing |
|---|---|---|---|
| Screen title (h1) | 22–27px | 700 | -0.025em |
| Section heading | 19px | 700 | -0.02em |
| Card title | 14–15px | 600 | -0.01em |
| Body copy | 13.5px | 400–500 | 0 |
| Label / meta | 12–13px | 500–600 | 0 |
| Mono metadata | 11–13px | 500–600 | 0.01–0.05em |
| Tag / badge | 10–11px | 600 | 0.01em |

### Spacing & Radius

```css
--r-sm:  7px    /* small inputs, tags */
--r:    11px    /* standard buttons, inputs */
--r-lg: 16px    /* cards, panels */
--r-xl: 22px    /* large panels */
--r-2xl:30px    /* modals */
--r-pill:999px  /* chips, pills */
```

### Elevation

```css
--e1: 0 1px 2px rgba(18,20,28,.05), 0 1px 1px rgba(18,20,28,.04);
--e2: 0 6px 16px -4px rgba(18,20,28,.10), 0 2px 5px -2px rgba(18,20,28,.06);
--e3: 0 18px 44px -12px rgba(18,20,28,.20), 0 5px 12px -6px rgba(18,20,28,.10);
--e-hud: 0 24px 60px -12px rgba(0,0,0,.55), 0 6px 18px -6px rgba(0,0,0,.4);
```

### Motion

```css
--ease:     cubic-bezier(.2,.7,.2,1)
--ease-out: cubic-bezier(.16,1,.3,1)
--t1: 120ms   /* micro (hover) */
--t2: 220ms   /* standard (toggle, slide) */
--t3: 360ms   /* entrance animations */
```

---

## Screens / Views

### 1. Dashboard (Library)

**Purpose:** The home screen. Users see all recordings (captures) organized by space. Entry point to everything.

**Layout:**
- Fixed-height `60px` top sticky header (blurred backdrop)
- Left sidebar: `244px` wide, full height, `var(--surface)` background, `1px solid var(--line)` right border
- Main content area: flex-1, scrollable, `var(--paper)` background

**Sidebar contents (top → bottom):**
1. Logo (22px Hanken Grotesk 700, reticle mark + "Recio" wordmark)
2. "New capture" primary button (full width, `var(--accent)` bg, reticle icon)
3. Nav items (Library, Shared with me, Comments, Starred) — `8px 11px` padding, `var(--r)` radius, active state: `var(--surface)` bg + `var(--e1)` shadow
4. "Spaces" section label — 11px mono, uppercase, `var(--ink-4)`
5. Space items (Product, Engineering, Design, GTM) — each with a `9×9px` colored dot (`oklch(0.7 0.13 {hue})`)
6. Cloud storage card (Google Drive) — shows usage ring + path
7. User avatar + name + settings icon

**Main header:**
- Page title "Library" (19px, 700)
- Search bar (max-width 320px) with `/` kbd shortcut
- Filter chips: All / Mine / Shared
- Grid/Stream view toggle (icon buttons in a pill container)

**"Pick up where you left off" row:**
- 3-column grid of continue-watching cards
- Each card: thumbnail (104px wide) + title (2-line clamp) + progress bar + `{pct}%` mono

**Main grid (default):**
- `repeat(auto-fill, minmax(264px, 1fr))`, `26px 22px` gap
- Each GridCard: thumbnail → title (2-line clamp, 14px 600) → avatar + author + timestamp + watch status
- Hover: thumbnail lifts (`translateY(-3px)`) with `var(--e3)`, play button appears centered

**Stream layout (alternate):**
- Single column, `4px` gap
- Each row: `132px` thumbnail + metadata columns (title, author, space tag) + stats (views, comments, watch%) + more button
- Hover: `var(--surface)` bg + `var(--e1)` + `var(--line)` border

**Thumbnail placeholder:**
- Dark radial gradient (`oklch(0.32 0.04 {hue})` → `oklch(0.16 0.012 262)`)
- Crosshatch overlay at 45° (`rgba(255,255,255,.045)`)
- Reticle mark centered (38% size, `rgba(255,255,255,.5)`)
- Space label top-left (10px mono uppercase)
- Duration badge bottom-right (11px mono, `rgba(0,0,0,.42)` bg, `backdrop-filter: blur`)

---

### 2. Launcher (Pre-record Setup)

**Purpose:** User chooses what to capture before recording starts.

**Layout:** Centered card, `460px` wide, on a radial-gradient background. No chrome/header.

**Card contents:**
1. Logo + keyboard shortcut tag (`⌥⇧R`) on same row
2. Heading: "What are you capturing?" (27px, 700, `-0.025em`)
3. Sub: "Frame the knowledge — Recio handles the rest." (15px, `var(--ink-3)`)
4. **2×2 source picker grid** (`10px` gap):
   - Screen / Screen + Cam / Camera / Screenshot
   - Each cell: icon in 38×38 rounded square + label (14.5px 700) + sub (12px)
   - Selected: `var(--accent-soft)` bg, `var(--accent)` border, `3px` accent focus ring
5. **Settings panel** (surface card, `6px` padding):
   - Microphone row — live waveform bars (9 bars, 16px tall) when on
   - Camera row — same
   - 4K quality row
   - Each row: icon + label + mono sub + toggle
6. **CTA**: "Start capture" primary button (lg, full width, reticle icon) or "Capture screenshot" if screenshot mode
7. Settings button (outline, icon-only) beside CTA
8. Footer note: "3-second countdown · press Esc to cancel"

**Toggle component:**
- `40×23px` pill, `var(--accent)` when on, `var(--line-2)` off
- Thumb: `19×19px` white circle, `transition: transform 220ms`

---

### 3. Recording Overlay

**Purpose:** The hero signature screen. A live recording HUD floats over the content being captured.

**Background:** The full app (simulated as a kanban board) renders underneath. During recording, a glowing capture frame and floating controls appear on top.

**3-second countdown:**
- Full-screen semi-opaque overlay (`oklch(0.16 0.01 262 / 0.55)`, `backdrop-filter: blur(3px)`)
- Centered 168×168 reticle mark in `var(--accent)` color
- Large countdown number (78px, 800 weight, white) centered inside reticle
- Each number animates in with `r-fade` (opacity 0→1, 220ms)

**Live capture frame:**
- `inset: 10px` absolutely positioned div, `border-radius: var(--r-lg)`
- Glowing border: `box-shadow: 0 0 0 2px var(--live), 0 0 0 8px color-mix(in oklch, var(--live) 18%, transparent)`
- Plus subtle inner glow

**Webcam bubble:**
- `138×138px` circle, `border-radius: 50%`
- Position: `bottom: 104px, left: 26px` (or `bottom: 26px` in Rail mode)
- Ring: `3px solid var(--accent)`, `animation: r-pulse-ring 2.4s infinite` (expanding ring pulse)
- Dark radial gradient fill simulating a webcam feed
- Live dot: `13×13px` circle, `var(--live)` color, `r-live-blink` animation, top-right of bubble
- `cursor: grab`

**Live dot animation:**
```css
@keyframes r-live-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: .35; }
}
```

**Control Dock (default layout):**
- Horizontally centered, `bottom: 22px`, fixed position
- Pill shape: `background: color-mix(in oklch, var(--hud) 86%, transparent)`, `backdrop-filter: blur(20px) saturate(160%)`, `border: 1px solid var(--hud-line)`, `var(--e-hud)`
- Contents left → right:
  1. **Stop button**: `44px` height pill, `var(--live)` background, stop icon + "Stop" text
  2. **Live dot + timer**: `00:00` in JetBrains Mono 16px 600, `minWidth: 52px`
  3. Divider: `1px` vertical line
  4. **Waveform**: 13 animated bars, `22px` tall, `var(--hud-ink)` color (or MicOff icon)
  5. Divider
  6. Pause/Resume icon button (`44px`)
  7. Mic toggle icon button
  8. Camera toggle icon button
  9. Draw/annotate icon button
  10. Discard icon button
- HUD icon buttons: `background: rgba(255,255,255,.07)` on hover `rgba(255,255,255,.09)`

**Control Rail (alternate layout):**
- Vertically stacked, `right: 22px`, `top: 50%` centered
- `70px` wide pill column
- Same controls as dock, stacked vertically
- Stop button is a circle (`50px`)

---

### 4. Review Screen

**Purpose:** After stopping the recording, user can rename, trim, view AI summary, and share.

**Layout:** Full screen. Fixed 60px header. 2-column content: `1fr 332px`.

**Header:**
- Logo + divider + "Ready in seconds" accent tag
- Right: "Save to library" ghost button + "Share" primary button

**Left (editor):**
1. Editable title input (22px, 700, no border, transparent bg — inline edit)
2. **Player** (16:10 aspect ratio):
   - Dark gradient background
   - Webcam circle inset (92px) bottom-left
   - Large play/pause button centered (76×76px white circle, `var(--e3)`)
   - Chapter pills above scrub bar (10px mono, dark semi-transparent)
   - Scrub bar: `5px` track, `var(--accent)` fill, white `13px` thumb
   - Timecode left + duration right (11px mono)
3. **Trim timeline** card:
   - "Trim" label + `{duration} kept` mono + "Remove silences" button
   - `52px` waveform visualization (64 bars, dark bg)
   - Darkened regions outside trim handles
   - `6px` wide accent-colored trim handles (`ew-resize`)
   - Playhead: `2px` white line with glow

**Right sidebar (aside):**
1. **Auto summary** section — AI-generated paragraph, hashtag tags
2. **Transcript** section — timestamped lines, accent-colored timestamps

---

### 5. Share Screen

**Purpose:** The public-facing view a recipient sees when clicking a Recio link.

**Layout:** Scrollable. Sticky 60px header. `max-width: 1080px` centered content. `1fr 320px` grid.

**Header:** Logo + "Library" ghost nav + avatar

**Left (player + discussion):**
1. Player (same as Review, `big` size variant)
2. Title (21px 700) + author + timestamp + view count (eye icon + number)
3. Reaction chips: "Got it" (check), "3 comments", "Share with team"
4. Timestamped comments thread:
   - Avatar (34px) + bold name + accent timestamp tag + body copy
   - Comment input at bottom: placeholder "Add a comment at {current time}…"

**Right sidebar:**
1. **Share card:**
   - URL display (`recio.to/a/4f9c2`) + Copy button (toggles to "Copied" with check icon)
   - Access selector: 3 radio-style buttons (Globe/Users/Shield icons)
     - Anyone with link / Team / Private
     - Selected: `var(--accent-soft)` bg + `var(--accent)` border

2. **"Stored in your cloud" card:** (brand-differentiating section)
   - Cloud icon + "Stored in your cloud" heading
   - Drive row: colored icon + "Google Drive" + file path + "Synced" tag
   - Copy: "Your recordings live in **your** storage — not ours."

---

## Component Specs

### Button

```
Variants: primary, dark, soft, ghost, outline, hud
Sizes: sm (32px), md (40px), lg (48px)
Padding: sm=0 12px, md=0 16px, lg=0 22px
Font: 600, letter-spacing: -0.01em
Radius: var(--r)
Press state: translateY(0.5px) scale(0.985)
Hover: accent-2 bg for primary; surface-2 for soft/ghost
```

### Icon Button
```
Size: 38px default (configurable)
Radius: var(--r-sm)
Active: accent-soft bg (light) | rgba(255,255,255,.14) (hud)
Hover:  surface-2 (light) | rgba(255,255,255,.09) (hud)
```

### Tag / Badge
```
Height: 22px, padding: 0 8px, radius: 6px
Font: JetBrains Mono, 11px, 600, letter-spacing: 0.01em
Tones: neutral (surface-3/ink-2), accent (accent-soft/accent-ink), live (live/live-16%)
```

### Avatar
```
Circular, colored by hue (oklch(0.62 0.11 {hue}))
Initials: first letter of each name word, white, font 700
Ring variant: 2.5px solid var(--surface) — used in stacks
```

### Chip (filter pill)
```
Height: 32px, radius: var(--r-pill), padding: 0 13px
Active: var(--ink) bg, white text
Inactive: var(--surface) bg, var(--line) border
```

### Waveform
```
N animated bars (default 22), gap = bar width
Heights: random 18%–82% of container height, updated every 120ms
Transition: height 130ms var(--ease)
Inactive: all bars at 16% height
```

---

## Iconography

All icons are custom SVG line icons (24×24 viewBox, `strokeLinecap: round`, `strokeLinejoin: round`, `strokeWidth: 1.7`).

**Key icons used:**
- `Reticle` — the Recio logomark (4 corner brackets + center dot)
- `Screen` — monitor/display
- `Cam` — video camera
- `Combo` — monitor + camera circle overlay
- `Mic` / `MicOff` — microphone
- `Shot` — screenshot (corner arrows + inner rect)
- `Stop` — filled rounded square
- `Pause` — two rounded rects
- `Play` — filled triangle
- `Share` — upload arrow
- `Trim` — scissors/trim
- `Bolt` — lightning (AI features)
- `Cloud` — cloud storage
- `Shield` — private access
- `Globe` — public access
- `Stream` — list lines
- `Grid` — 2×2 squares

All icon SVG paths are in `recio-icons.jsx`.

---

## Interactions & Behavior

### Flow Navigation
- 5 screens in order: Dashboard → Launcher → Recording → Review → Share
- Screens animate in with `opacity: 0 → 1`, `220ms`
- Navigation is state-based (no URL routing in prototype, but implement with real routing)

### Recording countdown
- 3 → 2 → 1 → 0, each number held for 750ms
- On 0: countdown overlay fades out, capture frame appears, webcam bubble slides in, controls animate up
- Timer increments by 1 every second while not paused

### Webcam bubble pulse ring
```css
@keyframes r-pulse-ring {
  0%   { box-shadow: 0 0 0 0   var(--accent-ring); }
  70%  { box-shadow: 0 0 0 14px transparent; }
  100% { box-shadow: 0 0 0 0   transparent; }
}
/* Runs every 2.4s on the webcam circle border */
```

### Hover lift (grid cards)
```css
transform: translateY(-3px);
box-shadow: var(--e3);
transition: transform 220ms var(--ease), box-shadow 220ms;
```

### Player scrub
- Progress stored as 0.0–1.0 float
- Increments `+0.006` per 60ms tick when playing (simulated)
- Timecode = `Math.round(duration * progress)` → formatted as `m:ss`

### Copy link button
- Toggles to "Copied" state with check icon for 1600ms, then resets

### Theme switching
- Swaps `data-theme` attribute on `<html>` (`pulse` / `tide` / `ink`)
- All accent tokens update via CSS cascade — no JS repainting needed

---

## State Management

```
screen: "dashboard" | "launcher" | "recording" | "review" | "share"
settings: { src: "screen"|"combo"|"cam"|"shot", mic: boolean, cam: boolean }
duration: number (seconds recorded)
theme: "pulse" | "tide" | "ink"
controls: "dock" | "rail"
dashLayout: "grid" | "stream"
radius: number (0–1.8, multiplier for border radius tokens)
```

---

## Assets

- **Fonts**: Hanken Grotesk + JetBrains Mono (Google Fonts)
- **Icons**: Custom SVG, all defined inline in `recio-icons.jsx`
- **Thumbnail images**: Simulated via CSS gradients (replace with real thumbnails in production)
- **Webcam feed**: Simulated via CSS gradient circle (replace with real `<video>` element)

---

## Files in This Package

| File | Purpose |
|---|---|
| `Recio.html` | Main prototype — open in browser to interact |
| `recio-icons.jsx` | All SVG icon components + Reticle logomark |
| `recio-ui.jsx` | Shared primitive components (Button, Avatar, Tag, Toggle, Waveform, etc.) |
| `recio-screens-1.jsx` | WorkCanvas (bg), Launcher, Recording overlay |
| `recio-screens-2.jsx` | Player, Review screen, Share screen |
| `recio-screens-3.jsx` | Dashboard (Grid + Stream) |
| `recio-app.jsx` | App shell, state machine, flow navigator, Tweaks wiring |
| `tweaks-panel.jsx` | In-prototype Tweaks panel (design exploration tool, not needed in production) |

---

## How to Use This Handoff in Claude Code

Paste the following prompt into Claude Code to get started:

```
I have a high-fidelity HTML prototype for Recio (an async screen recording / knowledge-sharing app). 
I want you to implement this design in [your framework — e.g. Next.js + Tailwind + shadcn/ui].

The design files are in my project. Start by reading:
1. design_handoff_recio/README.md — full specs, tokens, and screen descriptions
2. Recio.html — the interactive prototype (open in browser to see it)
3. recio-screens-1.jsx, recio-screens-2.jsx, recio-screens-3.jsx — component implementations

Implement the 5 screens (Dashboard, Launcher, Recording, Review, Share) following the specs exactly.
Use the design tokens, typography, and color system from the README.
```
