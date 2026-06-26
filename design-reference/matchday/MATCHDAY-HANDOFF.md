# Handoff: Club Rugby Tipping — "Matchday" Redesign

## Overview
A visual redesign of a community rugby **tipping site** for the CMK Premier club competition (Taranaki, NZ). Users pick the winner of each match in the current round, earn a point per correct tip, and climb a season-long leaderboard. The redesign moves the product away from a generic, "AI-default" navy/gold look toward a bold, broadcast-style **"Matchday"** identity inspired by professional club sites (reference: harlequins.co.uk).

The package contains four screens: **Home**, **Tips**, **Leaderboard**, and **Ladder**.

## About the Design Files
The `.dc.html` files in this bundle are **design references created in HTML** — interactive prototypes that show the intended look, layout, and behavior. They are **not production code to copy directly**.

Each file is a self-contained HTML document using **inline styles only** (no external CSS framework), plus a small embedded JavaScript class that supplies mock data and interactivity. They were authored in a component runtime ("DC" format), but for implementation purposes you only need to read them as plain HTML + JS references.

**Your task:** recreate these designs in the target codebase's existing environment (React, Vue, Svelte, SwiftUI, server-rendered templates, etc.), using its established components, routing, and data layer. If no front-end environment exists yet, choose the most appropriate framework for the project and implement the designs there. Wire the screens to **real data** in place of the mock arrays embedded in each file.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, and interactions are final and intentional. Recreate the UI to match — exact hex values, fonts, and measurements are documented below and present in the files. The only placeholders are **data** (see "Data & Mock Content") and **club crests** (currently monogram circles).

---

## Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| Ink / page-dark | `#0B0E13` | Hero & header backgrounds (near-black) |
| Panel-dark | `#0D1016` | Featured cards, table headers |
| Panel-dark-2 | `#161B24` | NPC banner |
| Canvas | `#F2F0EA` | Page background (warm off-white) |
| Card | `#FFFFFF` | Content cards, table rows |
| Card subtle | `#FAF9F5` / `#F4F2EC` | Match card header strip, VS divider |
| Border | `#E4E1D8` | Card borders |
| Border row | `#EFEDE6` | Row separators |
| Border canvas | `#DCD9CF` | Section divider rules |
| Text primary | `#11151C` | Headings, primary text |
| Text secondary | `#5A6371` / `#5A5546` | Body, stats |
| Text muted | `#8B8676` / `#A39E8C` / `#B4B0A2` | Labels, meta |
| Text on dark | `#FFFFFF` / `#C2C7D0` / `#AEB4BE` | Hero/header text |
| Text muted on dark | `#8C93A0` / `#99A0AC` / `#9AA1AD` | Dark-bg labels, inactive nav |
| Win green | `#1F9E5A` / `#169B63` | Wins, positive point diff |
| Live green | `#2CC36B` | "Open now" pulse dot, submitted state |
| Loss red | `#B23A48` / `#C2535F` | Losses, negative point diff |
| Relegation band | `#D98C8C` | Ladder bottom-3 left border |

### Accent (themeable)
The product ships with a **selectable accent color**. The active/default accent is **Amber**. Implement this as a single theme variable.

| Name | Hex | Text-on-accent |
|---|---|---|
| **Amber (default)** | `#D9A521` | `#11151C` (dark) |
| Magenta | `#E6007E` | `#FFFFFF` |
| Light Blue | `#2C9FD4` | `#FFFFFF` |
| Green | `#12A150` | `#FFFFFF` |
| Chocolate | `#7A4B36` | `#FFFFFF` |

**Important:** the text color placed *on* the accent depends on the accent. Amber uses **dark** text (`#11151C`); all others use **white**. Selected-pick tints also vary: Amber uses `rgba(217,165,33,.12)`, others use `rgba(230,0,126,.06)` (a light accent wash). Centralize this in a theme helper.

### Typography
Two fonts, both Google Fonts:
- **Archivo Black** (`'Archivo Black', sans-serif`, weight 400 only) — all display headings, numerals, club monograms, wordmark. Always **UPPERCASE**.
- **Archivo** (`'Archivo', system-ui, sans-serif`, weights 400/500/600/700/800) — body, labels, buttons, table data.

Type scale (px):
- Hero H1: **92** (Home) / **60** (interior pages), Archivo Black, line-height `.86`, letter-spacing `-.01em`, uppercase
- Section H2: **23**, Archivo Black, uppercase, letter-spacing `.02em`
- Featured numeral (e.g. "ROUND 14"): **44**
- Round-tile numeral: **42**; Countdown numerals: **34**
- Lead paragraph: **19** (Home hero) / **16** (interior), line-height `1.5`, color `#C2C7D0`/`#AEB4BE`
- Body/table: **14–15**
- Buttons / CTAs: **16**, weight 800, uppercase, letter-spacing `.02em`
- Eyebrow labels: **11–13**, weight 800, letter-spacing `.10em–.22em`, UPPERCASE
- Table headers: **11**, weight 800, letter-spacing `.08em–.10em`, uppercase, on `#0D1016`

### Spacing, radius, shadow
- Max content width: **1200px** (Home) / **1100px** (interior). Horizontal padding **32px**.
- Header height: **74px**, sticky, `rgba(13,16,22,.94)` + `backdrop-filter: blur(12px)`.
- Border radius: cards **18px**; large featured panels **20–22px**; buttons **10–13px**; round tiles **15px**; pills **999px**; avatars circle.
- Card shadow (light): `0 1px 2px rgba(17,21,28,.04)`. Cards lean on borders, not heavy shadows.
- Brand mark: the old diamond/harlequin motif was **removed**. The wordmark is preceded by a simple **accent tick**: a `26px × 3px` rounded bar in the accent color.

---

## Screens / Views

### Global — Header (all screens)
- Sticky, full-width, dark (`rgba(13,16,22,.94)`, blur). Inner row max-width 1100–1200px, height 74px, space-between.
- **Left:** accent tick (`26×3px`, accent) + wordmark "CLUB RUGBY TIPPING" in Archivo Black 17px, uppercase, letter-spacing `.06em`, white.
- **Right nav:** Home · Tips · Leaderboard · Ladder. Active item is white with a 6px accent dot before it; inactive items `#99A0AC`, hover → white on `rgba(255,255,255,.06)`, radius 9px, padding `9px 15px`. Home additionally has a "Sign in" pill (accent bg, accent-text color, padding `10px 20px`, radius 10px) after a vertical divider.

### 1. Home (`Club Rugby Tipping — Home.dc.html`)
**Purpose:** landing page — orient the user, drive them into tipping the open round.
Layout, top to bottom:
1. **Hero** (`#0B0E13`, 88px top / 96px bottom padding). Optional full-bleed background **matchday photo** behind a left-to-right dark gradient (`linear-gradient(98deg, rgba(11,14,19,.97) 0%, .86 40%, .45 78%, .25 100%)`). Eyebrow "ROUND 14 · CMK PREMIER · TARANAKI". H1 **"MAKE YOUR CALL."** at 92px (period in accent). Lead paragraph (max 480px). **Countdown** row: four tiles (Days / Hrs / Min / Sec) — `rgba(255,255,255,.05)` bg, `1px rgba(255,255,255,.1)` border, radius 13px, numerals 34px (Sec numeral in accent) — plus a "Tips close · Sat 27 Jun · 1:45 PM" caption. CTAs: primary "MAKE YOUR TIPS →" (accent) → Tips; secondary "VIEW LEADERBOARD" (ghost, `1.5px rgba(255,255,255,.28)` border) → Leaderboard.
2. **Clubs rail** (`#0D1016`): horizontally scrolling row of all 13 clubs — 52px circular monogram avatar (club color) + name below.
3. **Featured Round 14 card** (`#0D1016`, radius 22px, 36×40 padding): pulsing green dot + "OPEN NOW · CMK PREMIER", "ROUND 14" at 44px, "Tips close…" caption, two pills ("6 matches", "0 / 6 tipped"), and a "SUBMIT TIPS →" accent button → Tips.
4. **All rounds** grid: section header (accent tick + "ALL ROUNDS" + rule + "14 rounds · 1 open"). Auto-fill grid, `minmax(126px, 1fr)`, 14px gap. Each tile is `aspect-ratio: 1.05`, radius 15px, with "ROUND" label, big number (42px), and a status line. Three tile states:
   - **done** — white bg, `#E4E1D8` border, green "6/6 ✓" meta.
   - **open** — accent bg, accent-text number, "Tip now" (Round 14 only).
   - **soon** — `#EAE8E0` bg, muted "Upcoming".
5. **NPC banner** (toggleable): dark panel inviting users to a separate NPC tipping comp.
6. **Ladder snapshot**: top-5 of the CMK Premier ladder (see Ladder for column spec), with "FULL LADDER →" link → Ladder.
7. **Footer** (`#0B0E13`): accent tick + wordmark, "© 2026 · CMK Premier Club Rugby · Taranaki".

**Tweakable props:** `accent` (enum, default Amber), `heroPhoto` (bool, default true), `showNpc` (bool, default true).

### 2. Tips (`Club Rugby Tipping — Tips.dc.html`)
**Purpose:** the core flow — pick a winner for every match in the round.
- **Dark header section:** pulsing green "OPEN · CMK PREMIER · TARANAKI" eyebrow, "ROUND 14." at 60px, instruction line, and a "to lock" countdown chip on the right.
- **Sticky progress bar** (below the main header, `top: 74px`): a `8px` track (`#E2DFD5`) filled to `picked/total` in the accent, plus "X / 6 tipped" count. Background `rgba(242,240,234,.92)` + blur.
- **Match cards** (stack, 16px gap): each card radius 18px. Header strip (`#FAF9F5`) shows venue + time. Body is a 3-column grid: **home button | VS divider (64px) | away button**. Each team button shows a 46px monogram avatar, club name (Archivo Black 19px uppercase) and a form/position caption. Tapping a side:
  - sets that side as the pick → button gets `inset 0 0 0 2px <accent>` ring + light accent wash, a checkmark badge (accent bg, accent-text) appears, and the **card border** turns accent.
  - picking is single-select per match; tapping the other side moves the pick.
- **Sticky bottom action bar** (`rgba(13,16,22,.96)`, blur, `bottom: 0`): "X of 6 tipped" + status line, and a **Lock in tips** button. Button is disabled-looking (`rgba(255,255,255,.14)` bg, `#737A86` text) until **all 6** are picked, then turns solid accent. On submit it locks to green (`#2CC36B`) "Tips locked ✓".

**Tweakable prop:** `accent` (enum, default Amber).

### 3. Leaderboard (`Club Rugby Tipping — Leaderboard.dc.html`)
**Purpose:** season tipping standings across all tippers.
- **Dark header:** accent tick + "SEASON STANDINGS · AFTER ROUND 13", "LEADERBOARD." at 60px, "124 tippers" sub.
- **Podium:** 3-column grid, `align-items:end`. The **1st-place** card is dark (`#0D1016`), lifted `translateY(-14px)`, with accent points; 2nd/3rd are white cards. Each shows a rank numeral (top-right, accent for #1), an avatar (initials), name (Archivo Black 21px uppercase), club, and points (38px).
- **Full table:** dark header row; columns `# | Tipper | This rd | Hit % | Pts`. Each row: rank (accent for top 3), avatar + name + club, this-round points (green), hit %, total points (Archivo Black 18px). The **current user's** row ("You") is tinted, has an accent left-border (3px) and a "YOU" pill. "See all 124 tippers →" link below.

**Tweakable prop:** `accent` (enum, default Amber).

### 4. Ladder (`Club Rugby Tipping — Ladder.dc.html`)
**Purpose:** full competition standings for all 13 clubs.
- **Dark header:** accent tick + "CMK PREMIER MEN · AFTER ROUND 13", "THE LADDER." at 60px, points-system sub.
- **Legend:** three swatches — Top 4 (accent) Semi-finals · Mid-table (`#C9C5B8`) · Relegation risk (`#D98C8C`).
- **Table:** dark header; columns `# | Club | P | W | D | L | PF | PA | PD | Pts`. Each row: rank numeral, 32px monogram avatar + club name + a **form guide** (5 small `16px` squares, W=green `#1F9E5A`, L=red `#C2535F`, D=`#B0AB9A`), then stats. PD colored by sign. **Left border** encodes standing: top-4 = accent, bottom-3 (ranks 11–13) = `#D98C8C`, else `#E4E1D8`.

**Tweakable prop:** `accent` (enum, default Amber).

---

## Interactions & Behavior
- **Navigation:** header links and CTAs route between the four screens. In production, use the app's router.
- **Tips picking:** click either team → single-select pick per match. State drives: ring + wash on the chosen button, checkmark badge, accent card border, progress bar fill, count text, and the bottom bar's enabled/disabled + label states. Submit only fires when all matches are picked; on success the button latches to a green "locked" state.
- **Countdown:** Home hero counts down (live, 1s tick) to the tips-close datetime (mock target: **Sat 27 Jun 2026, 13:45**). Replace with the real round deadline.
- **Hover states:** nav items (bg wash), buttons (`filter: brightness(1.06–1.08)`), ghost buttons (`rgba(255,255,255,.08)` bg), links (`opacity: .75`), match buttons (`#FBFAF6`).
- **Live indicator:** "Open now" uses a pulsing dot — keyframe `pulseDot` (opacity 1→.3, scale 1→.75, 1.6s ease-in-out infinite).
- **Responsive:** prototypes are desktop-width (1100–1200px). For mobile, the header nav should collapse, the Tips 3-column match grid should stack or compress, and tables should become horizontally scrollable or card-based. Hit targets ≥ 44px.

## State Management
- **Theme:** single `accent` value (one of the 5 names) → resolves to accent hex, accent-text color, and selected-wash. Centralize.
- **Tips screen:** `picks` (map of matchIndex → 'home' | 'away'), `submitted` (bool). Derived: picked count, progress %, all-done flag, button state.
- **Data fetching (production):** current round + fixtures (Tips, Home featured), all rounds list + statuses (Home grid), tipper standings (Leaderboard), team standings + recent form (Ladder), and the logged-in user's identity (to highlight "You").

## Data & Mock Content
All data in the files is **mock**. The 13 clubs are **real Taranaki CMK Premier sides** (Clifton, Coastal, Inglewood, Kaitake, Kaponga, NPOB, NPHSOB, Okaiawa, Pātea, Southern, Stratford Eltham, Toko, Tukapa) and each has an assigned brand color + 2-letter monogram — but **match results, ladder figures, tipper names, and points are invented** for the prototype. Replace all of it with live data. Verify the real club list, colors, and the competition's exact bonus-point rules before shipping.

## Assets
- **Fonts:** Archivo + Archivo Black via Google Fonts (`<link>` already in each file's `<head>`).
- **Club crests:** none supplied — currently **monogram circles** (2 letters on the club's color). Swap in real crest images when available.
- **Hero photo:** the Home hero background is a drag-and-drop image slot in the prototype (`image-slot.js`, included for reference only). In production, use a real matchday photograph as the hero background image behind the gradient.
- **Icons:** none — checkmarks and arrows are Unicode glyphs (✓ →). Use the codebase's icon set if preferred.

## Files
- `Club Rugby Tipping — Home.dc.html` — Home / landing
- `Club Rugby Tipping — Tips.dc.html` — Tipping flow
- `Club Rugby Tipping — Leaderboard.dc.html` — Tipper standings
- `Club Rugby Tipping — Ladder.dc.html` — Team standings
- `image-slot.js` — image-drop helper used by the Home hero (reference only; not needed in production)

Each HTML file has two relevant parts to read: the markup (between `<x-dc>` … `</x-dc>`) for structure/styles, and the `class Component` script near the bottom for data shape and interaction logic.
