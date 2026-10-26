# CLAUDE.md — Traitors: The Game

Read `PROJECT_CONTEXT.md` before doing anything. It is the source of truth for every decision, rule, setting and the architecture of this app. The owner is Monarch; he hosts the first game on Saturday 31 October 2026.

## Working rules

- **Rules:** section 5 of `PROJECT_CONTEXT.md` is authoritative. The engine (`lib/game/engine.ts`, `applyGameAction`) enforces it. The UI never decides a rule.
- **Nothing hard-coded:** every number, toggle, name and photo comes from the game settings (`lib/game/settings.ts`), with the defaults in section 4.
- **Secrets:** all state leaves the server through `viewFor(state, viewer)` (`lib/game/view.ts`). Roles, unrevealed ballots, night picks, recruitment offers, Traitor chat and suspect-poll answers never reach a client that may not see them. The big screen gets public state only.
- **Writes:** every state change goes through a server route that calls the engine and saves inside a transaction with a version check. Actions carry idempotency keys.
- **Scope:** build tier by tier (section 11). Don't start a tier until the one before works end to end. Unfinished work at the feature freeze is switched off, never half-shipped.
- **Tests:** every rule gets a unit test; run the tests before each commit. Bot games find broken scenarios; they don't prove balance.
- **Keep the context current:** update `PROJECT_CONTEXT.md` in the same commit as any change to rules, settings, schema, scope or decisions. Add new decisions to its decision log with a date and a reason.
- **Decisions:** ask Monarch before changing a recorded decision. Open decisions are in section 16; each has a safe default, so build with the default and flag it.
- **Secrets in Git:** never commit keys. `.env.local` is git-ignored; `.env.example` lists variable names only. The Supabase secret key is server-only.
- **Paths:** the project folder name contains a space (`Traitors-The Game`). Quote paths in shell commands.
- **Setup help:** Monarch sets up GitHub, Supabase and Vercel through their websites. When a step needs them, walk him through it click by click (section 18).

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server (Turbopack, port 3000) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run simulate` | About 2,700 bot games against the engine (2 to 3 minutes) |
