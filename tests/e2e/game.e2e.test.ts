import { afterAll, describe, expect, it } from "vitest";
import { checkInvariants } from "@/lib/game/invariants";
import { allViewers, findLeaks } from "@/lib/game/leaks";
import { seededRand } from "@/lib/game/random";
import { hostProgress } from "@/lib/game/simulator";
import type { ActionPayload, GameState } from "@/lib/game/types";
import { runBots } from "@/lib/server/bots";
import { createStoredGame, loadGame, runAction } from "@/lib/server/games";
import { fillBots, seatsFor } from "@/lib/server/seats";
import { adminClient } from "@/lib/server/supabase";
import { buildViewResponse } from "@/lib/server/views";

/**
 * Runs against the real Supabase project (npm run e2e). Creates games owned by the first host,
 * then deletes them unless E2E_KEEP=1.
 */
const created: string[] = [];
const HOST = { kind: "host" } as const;

async function hostUserId(): Promise<string> {
  const { data, error } = await adminClient().from("hosts").select("user_id").limit(1).single();
  if (error) throw error;
  return data.user_id as string;
}

async function newGame() {
  const g = await createStoredGame(await hostUserId());
  created.push(g.code);
  return g;
}

async function ledgerIsContiguous(gameId: string, version: number) {
  const { data, error } = await adminClient()
    .from("game_actions")
    .select("version_before, version_after")
    .eq("game_id", gameId)
    .order("version_after");
  if (error) throw error;
  expect(data.map((r) => r.version_after)).toEqual(Array.from({ length: version }, (_, i) => i + 1));
  const { data: ping } = await adminClient().from("game_pings").select("version").eq("code", (await gameCode(gameId))).single();
  expect(ping!.version).toBe(version);
}

async function gameCode(gameId: string) {
  const { data } = await adminClient().from("games").select("code").eq("id", gameId).single();
  return data!.code as string;
}

afterAll(async () => {
  if (process.env.E2E_KEEP) return;
  for (const code of created) await adminClient().from("games").delete().eq("code", code);
});

describe("saving through the database (section 9.3)", () => {
  it("is idempotent, refuses stale host taps, and lets concurrent players both land", async () => {
    const g = await newGame();
    const patch = (debateSeconds: number): ActionPayload => ({ type: "updateSettings", patch: { debateSeconds } });

    const first = await runAction(g.code, HOST, patch(300), "e2e-idem-0001");
    expect(first.ok && !first.duplicate).toBe(true);
    const again = await runAction(g.code, HOST, patch(300), "e2e-idem-0001");
    expect(again.ok && again.duplicate).toBe(true);
    expect((await loadGame(g.code)).state.version).toBe(1);

    const stale = await runAction(g.code, HOST, patch(360), "e2e-stale-0001", 0);
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.stale).toBe(true);

    const v = (await loadGame(g.code)).state.version;
    const [a, b] = await Promise.all([
      runAction(g.code, HOST, patch(420), "e2e-race-0001", v),
      runAction(g.code, HOST, patch(480), "e2e-race-0002", v),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);

    const [c, d] = await Promise.all([
      runAction(g.code, HOST, patch(540), "e2e-both-0001"),
      runAction(g.code, HOST, patch(600), "e2e-both-0002"),
    ]);
    expect(c.ok && d.ok).toBe(true);

    const end = (await loadGame(g.code)).state;
    expect(end.version).toBe(4);
    await ledgerIsContiguous(g.id, end.version);
  });

  it("rejects an invalid move without saving", async () => {
    const g = await newGame();
    const r = await runAction(g.code, HOST, { type: "dealRoles" }, "e2e-invalid-0001");
    expect(r.ok).toBe(false);
    expect((await loadGame(g.code)).state.version).toBe(0);
  });
});

describe("a full game with 12 bots, through the database", () => {
  it("reaches the final reveal with valid states and no leaks at every step", async () => {
    const created0 = await newGame();
    await fillBots(created0);
    let game = await loadGame(created0.code);
    expect(game.state.players.every((p) => p.seatClaimed && p.seatConfirmed)).toBe(true);
    expect((await seatsFor(game.id)).filter((s) => s.is_bot)).toHaveLength(12);

    const rand = seededRand("e2e", game.code);
    const phases = new Set<string>();
    let prev: GameState | null = null;
    for (let step = 0; step < 800 && game.state.phase !== "FINALE"; step++) {
      let moved = false;
      for (const m of hostProgress(game.state, rand, { missionRate: 0.5, shieldRate: 0.5 })) {
        const r = await runAction(game.code, HOST, m, `e2e-host-${game.state.version}-${m.type}`);
        if (r.ok) {
          moved = true;
          break;
        }
      }
      if (!moved) moved = (await runBots(game, 4)).moves > 0;
      if (!moved) {
        for (const f of [{ type: "lockVoting" }, { type: "lockRewardVote" }, { type: "resolveNight" }, { type: "finishReveal" }] as ActionPayload[]) {
          if ((await runAction(game.code, HOST, f, `e2e-force-${game.state.version}-${f.type}`)).ok) {
            moved = true;
            break;
          }
        }
      }
      expect(moved, `stuck in ${game.state.phase}`).toBe(true);
      prev = game.state;
      game = await loadGame(game.code);
      phases.add(game.state.phase);
      expect(checkInvariants(game.state)).toEqual([]);
      expect(game.state.version).toBeGreaterThan(prev.version);
      if (step % 15 === 0) {
        for (const viewer of allViewers(game.state)) {
          expect(findLeaks(game.state, viewer)).toEqual([]);
          await buildViewResponse(game, viewer);
        }
      }
    }
    expect(game.state.phase).toBe("FINALE");
    for (const p of ["ROLES", "CIRCLE_VOTE", "CIRCLE_REVEAL", "NIGHT", "MURDER_REVEAL"]) expect(phases.has(p)).toBe(true);
    await ledgerIsContiguous(game.id, game.state.version);
    console.log(
      `E2E game ${game.code}: ${game.state.version} actions, ${game.state.day} days, ${game.state.finale!.winner} won (${game.state.finale!.reason})`,
    );
  });
});

describe("undo through the database (owner, 27 October)", () => {
  it("walks back host steps, stops at a player's move, undoes a win, and is off after the reveal", async () => {
    const { undoPlan, applyUndo } = await import("@/lib/server/undo");
    const g = await newGame();
    await fillBots(g);
    const key = (s: string) => `e2e-undo-${s}-${Date.now()}`;
    let game = await loadGame(g.code);
    expect((await runAction(g.code, HOST, { type: "dealRoles" }, key("deal"))).ok).toBe(true);
    expect((await runAction(g.code, HOST, { type: "openCircle" }, key("circle"))).ok).toBe(true);
    game = await loadGame(g.code);
    expect(game.state.phase).toBe("CIRCLE_DEBATE");

    // Undo the Circle, then undo the deal.
    let r = await applyUndo(g.code, key("u1"), game.state.version, "Too early");
    expect(r.ok).toBe(true);
    game = await loadGame(g.code);
    expect(game.state.phase).toBe("ROLES");
    r = await applyUndo(g.code, key("u2"), game.state.version, "Re-deal");
    expect(r.ok).toBe(true);
    game = await loadGame(g.code);
    expect(game.state.phase).toBe("LOBBY");

    // A player's move stops undo.
    await runAction(g.code, HOST, { type: "dealRoles" }, key("deal2"));
    await runAction(g.code, { kind: "player", playerId: "p1" }, { type: "acknowledgeRole" }, key("ack"));
    game = await loadGame(g.code);
    const blocked = await undoPlan(game);
    expect(blocked.available).toBe(false);

    // Undo a win before it's revealed; then it's off after a reveal.
    await runAction(g.code, HOST, { type: "endGameEarly", reason: "Test" }, key("end"));
    game = await loadGame(g.code);
    expect(game.state.phase).toBe("FINALE");
    r = await applyUndo(g.code, key("u3"), game.state.version, "Keep playing");
    expect(r.ok).toBe(true);
    game = await loadGame(g.code);
    expect(game.state.phase).toBe("ROLES");
    expect(game.state.finale).toBeNull();
    await runAction(g.code, HOST, { type: "endGameEarly", reason: "Test" }, key("end2"));
    await runAction(g.code, HOST, { type: "revealFinale" }, key("reveal"));
    game = await loadGame(g.code);
    expect((await undoPlan(game)).available).toBe(false);

    // A stale undo is refused.
    const stale = await applyUndo(g.code, key("u4"), game.state.version - 1, "Old screen");
    expect(stale.ok).toBe(false);
    await ledgerIsContiguous(game.id, game.state.version);
  });
});
