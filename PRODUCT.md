# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Guests (players):** a dozen friends in one room, at night, drinks in hand, on their own phones. Many are not technical. They open a link or scan a code, tap their photo and play. Nothing is installed.
- **The host:** Monarch, sitting out as a player. Runs every phase from one control panel on a Mac, sometimes a phone, while also holding the room's attention.
- **The co-host:** a guest the host picks. Runs missions, rewards and the big-screen message from their own phone. Never sees roles, picks or who holds what.
- **The room:** everyone reads the big screen on a TV across the room at the same moment. It can report a very small size (960 x 540).

## Product Purpose

Runs an in-person game of The Traitors, based on the Indian version of the show. It replaces shoulder taps, paper ballots and secret rooms: phones hold each player's secret, the TV stages what the room may know, and the host controls the pace.

Success means one complete, reliable game on the night, with no accidental leak of a secret. Priorities, in order: reliable game, no leaks, everything customisable by the host, drama and polish.

## Positioning

One room, one secret on every phone. The people are physically together; only the secrets are digital. The game is private by construction: a closed guest list of photos the host loaded, entered with a room code and a PIN.

The owner wants it to feel exclusive, like a private invitation-only event, and rooted in Indian culture without being tied to Diwali or any one festival or date.

## Operating Context

- The first game ran at a villa party on 31 October 2026. The app now serves any private game night.
- Guests read phones in low light, at a glance, often beside someone looking over their shoulder.
- The TV and the Mac are separate screens. The TV runs only the big screen, which needs no sign-in and never shows a secret.
- The show is hosted by Karan Johar at a palace in Rajasthan; the group watches it. The app uses its format and none of its logos, music or images.
- Physical party games (missions) happen in the room, and the app records their results.

## Capabilities and Constraints

- Next.js 16, Supabase, Vercel; phone-first web. Pushing to `main` deploys the live app.
- `PROJECT_CONTEXT.md` is the source of truth for rules, settings and decisions. The engine decides every rule, never the UI.
- Terms stay as they are: Circle of Shaq, Traitor, Innocent, shield, dagger, ghost, Bhoot Bets, Crystal Ball, Bhoot Bingo, breakfast, banish.
- Secrets leave the server only through `viewFor`. No screen may show what its viewer may not see.
- **Glance safety:** at night every phone looks alike at a glance; a Traitor's screen marks fellow Traitors with a small dot, never the word, and shows a pick count, never names. Secret screens stay neutral until held.
- Big-screen stages must fit any TV through `components/screen/FitBox.tsx`.
- One screen, one job for guests: a single primary action in thumb reach, plain words, tap targets at least 48 px, primary buttons at least 56 px.

## Brand Commitments

- Name: Traitors: The Game.
- Rooted in Indian culture; no longer Diwali-led (owner, 3 November 2026). No Halloween.
- Generic luxury is the thing the owner rejected: black and gold that could be any club, watch or wedding template.
- Plain words a non-technical guest understands. Owner's earlier brief: simple mobile UI that non-technical guests can use.
- Host-loaded player photos are the only imagery; no logos or images from the show.

## Evidence on Hand

- Real player portraits in `PHOTOS/` (festive miniature-style portraits of the guest list).
- The default roster, mission catalogue and narrator lines in `lib/game/settings.ts`.
- No testimonials, press or commercial claims exist. Do not invent any.

## Product Principles

1. The game comes first: nothing decorative may slow a vote or hide what to tap.
2. A secret is sacred: when in doubt, show less.
3. Everyone belongs here: exclusivity comes from being on the list, never from being hard to use.
4. The host runs the night: precise controls, no surprises, everything undoable and logged.
5. The room shares the drama: the TV is theatre, readable from across a villa.

## Accessibility & Inclusion

Text contrast at least 4.5:1. Colour is never the only signal. Every animation respects reduced-motion settings. Body text at least 18 px on phones; bingo squares, dense ghost-game name labels, notes under portraits, the top bar's room line, small buttons, and control labels and hints are 16 px.
