---
name: "Traitors: The Game"
description: A private night at a Bombay Deco palace, where every phone and the TV change colour together.
colors:
  day-ground: "#00474c"
  day-surface: "#025359"
  day-surface-2: "#055c62"
  day-ink: "#f6efe3"
  day-ink-muted: "#bcd6cf"
  day-accent: "#f3a98f"
  day-on-accent: "#052a2d"
  day-line: "#a7c8c0"
  day-danger: "#c5301c"
  on-danger: "#fff6ee"
  day-danger-ink: "#ffa18d"
  day-danger-bright: "#ff7f66"
  day-notice: "#f7c9b8"
  day-on-notice: "#052a2d"
  day-jade: "#86d9ae"
  day-ghost: "#c9ccf2"
  circle-ground: "#430d1a"
  circle-surface: "#521223"
  circle-surface-2: "#62192c"
  circle-ink: "#f8efe4"
  circle-ink-muted: "#e4c6c1"
  circle-line: "#d3b1aa"
  circle-danger: "#cf3520"
  circle-danger-ink: "#ff9d88"
  circle-danger-bright: "#ff8a73"
  night-ground: "#0f1440"
  night-surface: "#161c50"
  night-surface-2: "#1f2661"
  night-ink: "#f1eee8"
  night-ink-muted: "#bcc2e8"
  night-line: "#a6acdc"
  innocents-ground: "#f3a98f"
  innocents-surface: "#f6bba6"
  innocents-surface-2: "#f9cdbc"
  innocents-ink: "#052a2d"
  innocents-ink-muted: "#1f4648"
  innocents-accent: "#00474c"
  innocents-on-accent: "#f6efe3"
  innocents-line: "#025359"
  innocents-danger: "#a8230f"
  innocents-danger-ink: "#8a1a08"
  innocents-notice: "#052a2d"
  innocents-on-notice: "#f6efe3"
  innocents-jade: "#0a4d33"
  innocents-ghost: "#2b2f6b"
  traitors-ground: "#8f1d10"
  traitors-surface: "#a02517"
  traitors-surface-2: "#ad2e1f"
  traitors-ink: "#fff3ea"
  traitors-ink-muted: "#f8d4c8"
  traitors-accent: "#f6efe3"
  traitors-on-accent: "#5e1209"
  traitors-line: "#f4c8bb"
  traitors-danger: "#5e1209"
  traitors-jade: "#d6f2e2"
  traitors-ghost: "#e8e9ff"
  act-day: "#0f6a6f"
  act-circle: "#7a1a2e"
  act-night: "#2a3185"
  act-innocents: "#8f5a48"
  act-traitors: "#8f1d10"
  on-tone: "#f6efe3"
  tone-1: "#0a6a70"
  tone-2: "#6d1a2c"
  tone-3: "#2a3185"
  tone-4: "#8a4a3a"
  tone-5: "#3f6b70"
  tone-6: "#5a2540"
typography:
  sign:
    fontFamily: "Limelight, serif"
    fontSize: "min(7.4vw, 8.5rem)"
    fontWeight: 400
    lineHeight: 1.02
  reveal:
    fontFamily: "Federo"
    fontSize: "3.4rem"
    fontWeight: 400
    lineHeight: 1
  display:
    fontFamily: "Federo"
    fontSize: "2.6rem"
    fontWeight: 400
    lineHeight: 1.05
  title:
    fontFamily: "Federo"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.25
  card-title:
    fontFamily: "Federo"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "Federo"
    fontSize: "1.875rem"
    fontWeight: 400
    letterSpacing: "0.18em"
  tv-code:
    fontFamily: "Federo"
    fontSize: "min(6.4vw, 6.5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.14em"
  tv-sub:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "min(2.4vw, 2.4rem)"
    fontWeight: 400
  body:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  label:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
rounded:
  none: "0px"
  dot: "9999px"
spacing:
  corner-step: "7px"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.day-accent}"
    textColor: "{colors.day-on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "56px"
    width: "100%"
  button-primary-disabled:
    backgroundColor: "{colors.day-surface-2}"
    textColor: "{colors.day-ink-muted}"
  button-secondary:
    backgroundColor: "{colors.day-surface}"
    textColor: "{colors.day-ink}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "56px"
  button-secondary-hover:
    backgroundColor: "{colors.day-surface-2}"
  button-danger:
    backgroundColor: "{colors.day-danger}"
    textColor: "{colors.on-danger}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "56px"
  button-quiet:
    textColor: "{colors.day-ink-muted}"
    padding: "0 20px"
    height: "48px"
  button-small:
    typography: "{typography.label}"
    padding: "0 16px"
    height: "48px"
  text-field:
    backgroundColor: "{colors.day-ground}"
    textColor: "{colors.day-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "48px"
  room-code-field:
    backgroundColor: "{colors.day-surface}"
    textColor: "{colors.day-accent}"
    typography: "{typography.code}"
    rounded: "{rounded.none}"
    height: "64px"
  card:
    backgroundColor: "{colors.day-surface}"
    textColor: "{colors.day-ink}"
    rounded: "{rounded.none}"
    padding: "20px"
  notice-plain:
    backgroundColor: "{colors.day-surface}"
    textColor: "{colors.day-ink-muted}"
    padding: "12px 16px"
  notice-warn:
    backgroundColor: "{colors.day-surface-2}"
    textColor: "{colors.day-ink}"
    padding: "12px 16px"
  chip-paused:
    backgroundColor: "{colors.day-notice}"
    textColor: "{colors.day-on-notice}"
    typography: "{typography.label}"
    padding: "4px 12px"
  toggle-on:
    backgroundColor: "{colors.day-accent}"
    height: "32px"
    width: "56px"
  toggle-off:
    backgroundColor: "{colors.day-ground}"
    height: "32px"
    width: "56px"
  sheet:
    backgroundColor: "{colors.day-surface}"
    textColor: "{colors.day-ink}"
    rounded: "{rounded.none}"
    padding: "20px"
  rail-item-active:
    backgroundColor: "{colors.day-accent}"
    textColor: "{colors.day-on-accent}"
    typography: "{typography.label}"
    height: "48px"
  rail-item:
    textColor: "{colors.day-ink-muted}"
    typography: "{typography.label}"
    height: "48px"
---

# Design System: Traitors: The Game

## Overview

**Creative North Star: "The House Lights"**

A private night at a Bombay Deco palace. A rose tower sign you are let past, your portrait on the wall, and light that changes for the whole room at once. When night falls, every phone and the TV fade to midnight indigo together, and the colour alone tells a dozen people in a dim villa where the game has gone. Colour is the one large gesture; everything else stays out of its way.

The system runs in two registers from one set of tokens. Player phones and the big screen are Experience: stepped corners, triple speed lines, tall sign lettering, vast empty ground and only the current moment at full strength. Host and co-host panels are Operate: the world lends its type, palette and density, while controls stay plain rectangles and the panel keeps one peacock ground. Guests get one job per screen and one primary action at the thumb. The TV is theatre, readable across a room. The host reads a precise panel.

The system rejects generic luxury, the black and gold that could be any club, watch or wedding template. It also rejects round avatars in dark cards. Exclusivity comes from being on the list, never from being hard to use.

**Key Characteristics:**
- Five acts of colour, set once at the root of the page and faded over 1.4 seconds.
- One corner: two set-backs, cut by clipping rather than radius.
- Three typefaces with separate jobs: Limelight signs, Federo titles, Jost for reading.
- Host-loaded portraits are the only imagery, shown as tall stepped plates.
- No shadows at all; depth comes from tone and hairlines.
- Everything moves on one exponential ease-out, and all of it stops under reduced motion.

## Colors

The palette is lacquer, leather and sandstone under changing light: saturated grounds, rose accent, nickel hairlines and warm ivory ink.

Tokens live as custom properties on the root element and are overridden by `data-act`. Frontmatter keys carry the act as a prefix; a role an act does not override inherits the day value. In the built CSS every role keeps one name (`--ground`, `--accent`) across all acts, so components never name an act.

### Primary
- **Rose Sandstone** (day-accent, #f3a98f): The tower sign, primary buttons, card titles, room codes, countdowns, selection rings and the newest vote line. It is the one thing asking to be touched or read first.
- **Deep Peacock Ink** (day-on-accent, #052a2d): Text and icons on Rose Sandstone. Also the dark modules of the QR code.

### Secondary
- **Peacock Lacquer** (day-ground, #00474c): The day act and the permanent ground of host and co-host panels.
- **Oxblood Leather** (circle-ground, #430d1a): The Circle of Shaq, from debate through reveal and the endgame votes.
- **Midnight Indigo** (night-ground, #0f1440): Night, on every phone and the TV, whatever the role.
- **Flooded Rose** (innocents-ground, #f3a98f): The Innocents' win. The accent itself floods the room and the system turns light, with Peacock as its new accent.
- **Flooded Vermilion** (traitors-ground, #8f1d10): The Traitors' win. Ivory becomes the accent.
- **Act Bands** (act-day through act-traitors): Mid-tone versions of each act, used only for the 4 px band over the host and co-host top bar and the host's desktop rail. They tell an operator where the room is without changing the panel's ground.

### Tertiary
- **Signal Vermilion** (day-danger, #c5301c): Destructive buttons, the dagger chip and the offline seat dot.
- **Vermilion Ink** (day-danger-ink and day-danger-bright): Danger as text, an urgent countdown in its last 15 seconds, a Traitor's role word and warning-notice hairlines. Each act retunes these so they stay legible on its ground.
- **Soft Rose Notice** (day-notice): The Paused chip, the connecting dot and unconfirmed seats. Not an error, only a hold.
- **Jade** (day-jade): Connected, seated, joined, a correct guess.
- **Ghost Lilac** (day-ghost): Ghost votes, the ghost icon, bot seats.

### Neutral
- **Terrazzo Ivory** (day-ink, #f6efe3): Primary text.
- **Weathered Ink** (day-ink-muted): Helper text, labels and inactive navigation.
- **Nickel** (day-line, #a7c8c0): Hairlines and speed lines, mixed into the ground at a strength set by the frame (45% by default, 32% on cards, 70% on secondary buttons and code fields).
- **Lacquer Surfaces** (day-surface, day-surface-2): Two tonal steps above ground. Surface fills cards and sheets; surface-2 marks hover, disabled and dense game squares.
- **Portrait Tones** (tone-1 through tone-6, with on-tone): Plate fills behind initials when a player has no photo, chosen by a hash of the name so a player keeps one colour.

### Named Rules

**The House Lights Rule.** The act is set once, on the root element, from public game state. No component chooses its own act colour, so every guest screen and the TV match at any moment. Only the root moves, one colour change per act, over 1.4 seconds.

**The Neutral Night Rule.** Colour never reveals a role. At night every phone is the same indigo. A Traitor's screen marks fellow Traitors with a small dot, never the word, and the role word appears only while the lift doors are held open.

**The No Gold Rule.** No gold or amber in the interface palette, ever; rose sandstone does the work gold does elsewhere. Player photos are the guests' own and are exempt.

**The Vermilion Rule.** Vermilion means danger or Traitors and nothing else. It is never a decorative accent.

## Typography

**Display Font:** Limelight (with serif) for signs; Federo for titles
**Body Font:** Jost (with system-ui, sans-serif)

**Character:** Limelight is tall 1920s marquee lettering with heavy thick-and-thin contrast. Federo is a slim Deco roman that gives titles and numbers their elegance without shouting. Jost, a geometric sans of the same period, keeps every instruction plain in low light.

### Hierarchy
- **Sign** (Limelight 400, viewport-scaled, line-height 1.02, uppercase): TV act headlines, such as the Breakfast entrance, and the tower sign, whose letters size to one storey of the tower. Type as structure.
- **Reveal** (Federo 400, 3.4rem, line-height 1): The role word behind the lift doors. Neighbouring big moments use 2.8 to 3.2rem; a phone countdown uses 5rem.
- **Display** (Federo 400, 2.6rem, line-height 1.05, balanced): The single heading on a guest screen.
- **Title** (Federo 400, 1.875rem, line-height 1.25): Sheet titles and confirmations, usually in accent.
- **Card Title** (Federo 400, 1.25rem, accent): Section titles inside cards, and game names on ghost screens.
- **Code** (Federo 400, 1.875rem on phones, tracked 0.18em; viewport-scaled and tracked 0.14em on TV): Room codes, in accent.
- **TV Sub** (Jost 400, viewport-scaled): Supporting lines on the TV, capped at 70vw.
- **Body** (Jost 400, 18 px, line-height 1.45): All reading text. Help text under headings is capped at 34ch.
- **Button** (Jost 600, 18 px): Primary and danger button labels.
- **Label** (Jost 500, 16 px): Field labels, rail items and small buttons.

Big-screen type is written as `min(Nvw, Nrem)` so it holds its proportion on any TV, up to a ceiling. Clock digits sit in fixed-width cells (0.62em, 0.34em for the colon) so the time never jitters.

### Named Rules

**The Three Voices Rule.** Limelight signs, Federo announces, Jost explains. Limelight appears only on the tower and on TV act headlines, never on a phone screen's content or an operating panel. Instructions are never set in Federo.

**The 18 Px Rule.** Reading text on phones is 18 px. The permitted 16 px exceptions are bingo squares, dense ghost-game name labels, notes under portraits, the top bar's room line, small buttons, and control labels and hints. Nothing goes smaller.

## Layout

**Experience, phone.** A single column, up to 28rem wide with 20 px side padding, in full dynamic viewport height and clear of the safe areas. Headings sit high, a flexible spacer opens the ground, and the primary action sits at the thumb. On the guest home, the tower bleeds off the left edge at a storey height of `min(10.6dvh, 26vw)` and the column takes the rest. Viewports under 700 px tall tighten the top padding.

**Experience, TV.** A full-height stage with no scrolling, inside a hairline stepped frame inset 1.4vh, padded 4vw and 4vh. Stages sit inside a fit box that lays them out at natural size and shrinks them to fit, because a TV browser can report as little as 960 x 540. The lobby sets the tower left, QR and code centre, portrait wall right; the tower is dropped in portrait orientation. The Circle is a real ring of portraits, `min(66vh, 44vw)` across. Sizes are in vw and vh rather than fixed units.

**Operate.** Below 1024 px, a single column up to 36rem with a fixed bottom tab bar. From 1024 px, a 13rem rail beside content up to 64rem. A sticky top bar carries the phase, room line and clock.

**Rhythm.** Spacing is a 4 px scale, mostly 8, 12 and 16 px, with 16 px as the usual gap between stacked blocks. Portrait grids run 3 or 4 columns on phones, with 12 px across and 16 px down. Guest targets are at least 48 px and primary buttons at least 56 px.

The corner step scales with its object: 2 to 3 px on bars, chips and toggles, 7 px by default, 8 to 9 px on TV controls and the Circle call, 6% of the width on portraits, and 1.2vh on the TV frame.

### Named Rules

**The One Job Rule.** A guest screen has one primary action, full width, in thumb reach. Empty ground is part of the design; do not fill it.

## Elevation & Depth

The system has no shadows. Depth comes from three things: tonal steps from ground to surface to surface-2, nickel hairlines drawn by the frame, and a 70% black scrim behind sheets. Hierarchy over time comes from strength: the newest vote is drawn at full accent while earlier ones drop to 40% opacity, and ghosted players sit at 45% opacity in greyscale.

### Named Rules

**The No Shadow Rule.** No box, text or drop shadows anywhere. If something needs to stand forward, change its tone or its hairline strength.

## Shapes

**The stepped corner.** Every Experience frame shares one silhouette: two square set-backs at each corner, cut with a clip path. The set-back size is one value, so the same corner works from a 3 px chip to a TV frame. Because a clipped box cannot draw an outside ring, keyboard focus sits inside it (offset -6 px).

**The stepped hairline.** A clipped box cannot have a border either. So the frame paints the line as its own background and a layer one pixel in paints the fill, which keeps the 1 px nickel line following the steps.

**The tower.** A rose fin with a staircase rising on its right shoulder, one letter a storey, the name stacked down its height.

**Triple speed lines.** Three 1 px nickel lines 6 px apart at 60% opacity. At full column width on the guest home, under the top bar, and as a 64 px rule beneath headings.

**The keyhole.** The mark: an accent keyhole inside a hairline stepped plate. Used on TV holding stages and the host home.

**Rounds.** Circles are deliberately rare, which is what gives the vote ring its weight. They appear only as the Circle ring itself, the small fellow-Traitor and seat dots, and the busy spinner. Connection dots are square.

**Plain rectangles.** Radius is zero everywhere. Under `data-surface="operate"` the clip paths come off entirely, so cards, buttons, toggles and portraits in panels are square-cornered, and speed lines are hidden. Text fields, segmented controls, steppers, sheets and bingo and reaction squares are plain rectangles on every surface.

## Components

### Buttons
Confident, flat, and impossible to miss.
- **Shape:** Stepped on Experience, square on Operate. Never rounded.
- **Primary:** Rose fill with deep ink text at 56 px, full width. Hover brightens to 105%.
- **Secondary:** Stepped hairline at 70% strength over surface; hover fills with surface-2.
- **Danger:** Vermilion fill, weight 600. Hover brightens to 110%.
- **Quiet:** Muted text with no fill; underlines and lifts to ink on hover.
- **Medium and small:** 48 px tall at 16 px, auto width.
- **States:** All press to 98% scale. Disabled primary drops to surface-2 with muted text. Busy shows a small spinner beside the label. Focus is a 2 px accent outline.

### Chips
- **Style:** The Paused chip is a 3 px stepped plate in notice colours. The dagger chip is the same form in vermilion.

### Cards / Containers
- **Corner Style:** Stepped on Experience, square on Operate.
- **Background:** Surface, inside a hairline at 32% strength.
- **Shadow Strategy:** None.
- **Internal Padding:** 20 px.
- **Notices:** Plain notices sit on bare surface with muted text and no hairline. Warnings use surface-2 inside a vermilion-ink hairline at 80% strength.

### Inputs / Fields
- **Text field:** Rectangle on ground with a 40% nickel border, 48 px tall, 18 px text and a 16 px label above. Focus turns the border accent.
- **Room code field:** A stepped hairline at 70% strength holding centred, tracked Federo in accent, 64 px tall. Focus raises the hairline to full-strength accent.
- **Toggle:** A 56 by 32 px stepped switch. Off is a ground fill with a nickel block; on is a rose fill with a dark block. The thumb is a rectangle, not a circle.
- **Segmented and stepper:** Rectangular groups in a 40% nickel border with 48 px cells. The selected segment takes the rose fill; a stepper's value is tabular and accent.
- **Caret and selection:** Caret and text selection both use accent.

### Navigation
- **Top bar:** Sticky on ground. Guests see an 18 px Jost title; operators see a Federo title and the act band. A 16 px room line with a square connection dot sits below, and the countdown sits right.
- **Host rail:** Wears the band colour of the current act, which fades over a second. Items are 48 px labels, with the active one a rose block.
- **Mobile tabs:** Fixed to the bottom on ground, with a hairline above, and the active item in accent text.

### Portrait Plate
A photo in a stepped plate, tall at 5:6 and framed high on the face. Small square plates zoom to 150% on the face. Without a photo, a tone fill with Federo initials. Selection adds a 3 px rose ring, and in grids a small stepped check block at the top left. Ghosted players fade to greyscale over one second. Names sit below in Jost, turning accent and semibold when chosen.

### Lift Doors
The hold-to-reveal panel. Two nickel-patterned chevron doors, surface-2 with a hairline where they meet, part sideways over 0.45 seconds while pressed. The secret is rendered only while held, so it is gone before the doors close. A shorter version guards recruit and blackmail offers, labelled "You have a private message", with neutral answer buttons that appear only after the first peek.

### The Ring
The Circle on the TV: portraits seated on a fine circle, with each revealed vote drawn across it as a curve over 0.9 seconds. The newest stroke is accent and thicker, weighted further by a dagger; voter and target wear the selection ring; older strokes fade back. The current names sit in the centre.

### Icons
A small drawn set on a 24 px grid: 1.8 stroke, square caps, no fill, to sit with the stepped corners. Ghost reactions are emoji by design, as content that floats up the TV, and are not part of the icon set.

### Motion
One slow colour change per act (1.4 s), and one exponential ease-out, `cubic-bezier(0.16, 1, 0.3, 1)`, for everything that arrives: sheets rise in 0.42 s, content settles in 0.6 s, TV moments arrive and photo-wall portraits flip in over 0.9 s. Only status loops: the Circle call, the connecting and QR loading pulses, and the busy spinner. All animation and transition is removed under reduced motion.

## Do's and Don'ts

### Do:
- **Do** use the role names (`--ground`, `--surface`, `--accent`, `--ink`) so every component follows the act without knowing it.
- **Do** set the act only through the house lights, on guest screens and the TV, derived from public state.
- **Do** keep host and co-host panels on the peacock ground, showing the act only in the band and rail.
- **Do** put new operator surfaces inside `data-surface="operate"` so their corners and speed lines drop away on their own.
- **Do** build a stepped hairline from the frame and set its strength per use: 32% for cards, 70% for controls, 100% on focus.
- **Do** keep one primary action per guest screen, 56 px tall and within thumb reach.
- **Do** scale TV type as `min(Nvw, Nrem)` and keep stages inside the fit box.
- **Do** use only host-loaded portraits as imagery.
- **Do** keep text contrast at 4.5:1 or better on every act, and pair any colour signal with words or a label.
- **Do** render a secret only while it is held.

### Don't:
- **Don't** use black and gold, or any palette that could be a club, watch or wedding template.
- **Don't** use round avatars in dark cards; a portrait is a stepped plate, tall where there is room.
- **Don't** open a guest screen with a centred logo over a form; the tower sign comes in from the edge.
- **Don't** add shadows or corner radius to any frame, button, card or portrait.
- **Don't** let colour or a word on a phone at night reveal a role to someone glancing over a shoulder; a pick count is allowed, names are not.
- **Don't** use vermilion as decoration.
- **Don't** set Limelight on phone content or operating panels.
- **Don't** set text below 16 px on a phone or panel.
- **Don't** use a logo, image or music from the show.
- **Don't** make the interface chrome depend on Diwali, Halloween or any one festival or date.
