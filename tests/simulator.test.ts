import { describe, expect, it } from "vitest";
import type { GameSettings } from "@/lib/game/settings";
import { simulate, type SimResult } from "@/lib/game/simulator";

/** Games per (player count × profile). `npm test` runs a quick sweep; `npm run simulate` runs thousands. */
const PER = Number(process.env.SIM_GAMES_PER ?? 3);

const COUNTS = [5, 10, 11, 12, 20];

const PROFILES: Array<{ name: string; settings: (n: number) => Partial<GameSettings>; mission: number; shield: number; chaos: number }> = [
  { name: "party defaults", settings: (n) => ({ traitorCount: Math.min(3, Math.floor(n / 3)) }), mission: 0.6, shield: 0.5, chaos: 0 },
  {
    name: "party defaults with every ghost game on",
    settings: (n) => ({ traitorCount: Math.min(3, Math.floor(n / 3)), ghostGames: { bhootBets: true, crystalBall: true, liveReactions: true, bhootBingo: true } }),
    mission: 0.6,
    shield: 0.5,
    chaos: 0,
  },
  { name: "no missions", settings: (n) => ({ traitorCount: Math.min(3, Math.floor(n / 3)) }), mission: 0, shield: 0, chaos: 0 },
  { name: "shields everywhere, low threshold (long games)", settings: (n) => ({ traitorCount: Math.max(1, Math.floor(n / 6)), endCondition: "endgameVote", endGameThreshold: 2 }), mission: 1, shield: 1, chaos: 0 },
  { name: "high threshold (short games)", settings: (n) => ({ traitorCount: 1, endCondition: "endgameVote", endGameThreshold: n - 1 }), mission: 0.3, shield: 0.5, chaos: 0 },
  {
    name: "unanimous, no Traitor-on-Traitor, dagger 3, spin ties",
    settings: (n) => ({ traitorCount: Math.floor(n / 3), murderRule: "unanimous", allowTraitorOnTraitor: false, daggerWeight: 3, tieRule: "spin" }),
    mission: 0.8,
    shield: 0.3,
    chaos: 0,
  },
  {
    name: "recruitment, host decides ties, roles revealed, no ghost vote",
    settings: (n) => ({ traitorCount: Math.max(1, Math.floor(n / 4)), recruitment: "lastTraitor", tieRule: "hostDecides", revealOnElimination: true, ghostVote: false }),
    mission: 0.5,
    shield: 0.5,
    chaos: 0,
  },
  {
    name: "chat and poll off, eliminated don't win",
    settings: (n) => ({ traitorCount: Math.min(2, Math.floor(n / 3)), traitorChat: false, suspectPoll: false, eliminatedWinWithTeam: false }),
    mission: 0.5,
    shield: 0.5,
    chaos: 0,
  },
  {
    name: "chaos: host overrides, pauses, players leaving",
    settings: (n) => ({ traitorCount: Math.floor(n / 3), recruitment: "lastTraitor", ghostGames: { bhootBets: true, crystalBall: true, liveReactions: false, bhootBingo: true } }),
    mission: 0.6,
    shield: 0.5,
    chaos: 0.08,
  },
  {
    name: "heavy chaos with unanimous and host ties",
    settings: (n) => ({ traitorCount: Math.max(1, Math.floor(n / 4)), murderRule: "unanimous", tieRule: "hostDecides", recruitment: "lastTraitor", endCondition: "endgameVote", endGameThreshold: 2 }),
    mission: 0.7,
    shield: 0.6,
    chaos: 0.2,
  },
];

describe("bot simulator: finds stuck phases, invalid states and impossible endings (not balance)", () => {
  const all: SimResult[] = [];

  for (const profile of PROFILES) {
    for (const n of COUNTS) {
      it(`${profile.name}, ${n} players × ${PER}`, () => {
        for (let i = 0; i < PER; i++) {
          const r = simulate({
            players: n,
            seed: `${profile.name}-${n}-${i}`,
            settings: profile.settings(n),
            missionRate: profile.mission,
            shieldRate: profile.shield,
            chaos: profile.chaos,
          });
          all.push(r);
          expect(r.days).toBeGreaterThanOrEqual(1);
        }
      }, 120_000);
    }
  }

  it("covers short and long games, both winners, and every phase", () => {
    const days = all.map((r) => r.days);
    const phases = new Set(all.flatMap((r) => r.phases));
    const winners = new Set(all.map((r) => r.winner));
    console.log(
      `Simulated ${all.length} games. Days: min ${Math.min(...days)}, max ${Math.max(...days)}, ` +
        `mean ${(days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)}. ` +
        `Traitors won ${all.filter((r) => r.winner === "traitors").length}, Innocents ${all.filter((r) => r.winner === "innocents").length}.`,
    );
    expect(Math.min(...days)).toBeLessThanOrEqual(2);
    expect(Math.max(...days)).toBeGreaterThanOrEqual(10);
    expect(winners).toEqual(new Set(["traitors", "innocents"]));
    for (const p of ["MISSION", "CIRCLE_REVEAL", "NIGHT", "MURDER_REVEAL", "ENDGAME_VOTE", "ENDGAME_BANISH", "FINALE"]) {
      expect(phases.has(p as never)).toBe(true);
    }
  });
});
