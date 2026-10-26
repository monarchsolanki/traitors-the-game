import { describe, it } from "vitest";
import { seededRand } from "@/lib/game/random";
import { hostProgress } from "@/lib/game/simulator";
import type { ActionPayload } from "@/lib/game/types";
import { runBots } from "@/lib/server/bots";
import { createStoredGame, loadGame, runAction, runActionOrThrow } from "@/lib/server/games";
import { adminClient } from "@/lib/server/supabase";

/**
 * A manual test driver, skipped unless E2E_DRIVE is set. Used to play the host side while a person
 * (or the browser) plays a seat:
 *   E2E_DRIVE=create E2E_OPEN=p1          new game, bots in every seat except the listed ones
 *   E2E_DRIVE=host E2E_CODE=X E2E_ACTION='{"type":"dealRoles"}'
 *   E2E_DRIVE=bots E2E_CODE=X E2E_MOVES=20
 *   E2E_DRIVE=delete E2E_CODE=X
 */
const mode = process.env.E2E_DRIVE;

describe.skipIf(!mode)("manual driver", () => {
  it(`drive: ${mode}`, async () => {
    const db = adminClient();
    if (mode === "create") {
      const { data } = await db.from("hosts").select("user_id").limit(1).single();
      const game = await createStoredGame(data!.user_id);
      const open = (process.env.E2E_OPEN ?? "").split(",").filter(Boolean);
      for (const p of game.state.players.filter((x) => !open.includes(x.id))) {
        await db.from("seats").upsert({ game_id: game.id, player_id: p.id, is_bot: true });
        await runActionOrThrow(game.code, { kind: "player", playerId: p.id }, { type: "claimSeat" }, `drv-claim-${p.id}`);
        await runActionOrThrow(game.code, { kind: "host" }, { type: "confirmSeat", playerId: p.id }, `drv-confirm-${p.id}`);
      }
      console.log(`DRIVE code=${game.code}`);
      return;
    }
    const code = process.env.E2E_CODE!;
    if (mode === "host") {
      const action = JSON.parse(process.env.E2E_ACTION!) as ActionPayload;
      const r = await runAction(code, { kind: "host" }, action, `drv-host-${Date.now()}`);
      console.log(`DRIVE ${action.type}: ${r.ok ? "ok" : r.reason}`);
    }
    if (mode === "bots") {
      let game = await loadGame(code);
      let total = 0;
      for (let i = 0; i < Number(process.env.E2E_MOVES ?? 10); i++) {
        const r = await runBots(game, 1);
        if (!r.moves) break;
        total += r.moves;
        game = r.game;
      }
      console.log(`DRIVE bots moved ${total}`);
    }
    if (mode === "autoplay") {
      // Plays the game to the end: host moves from the simulator, bots for everyone else.
      const rand = seededRand("autoplay", code);
      let game = await loadGame(code);
      for (let step = 0; step < 800 && game.state.phase !== "FINALE"; step++) {
        let moved = false;
        for (const m of hostProgress(game.state, rand, { missionRate: 0.5, shieldRate: 0.5 })) {
          if ((await runAction(code, { kind: "host" }, m, `drv-auto-${game.state.version}-${m.type}`)).ok) {
            moved = true;
            break;
          }
        }
        if (!moved) moved = (await runBots(game, 4)).moves > 0;
        if (!moved) {
          for (const f of [{ type: "lockVoting" }, { type: "lockRewardVote" }, { type: "resolveNight" }, { type: "finishReveal" }] as ActionPayload[]) {
            if ((await runAction(code, { kind: "host" }, f, `drv-force-${game.state.version}-${f.type}`)).ok) break;
          }
        }
        game = await loadGame(code);
      }
      console.log(`DRIVE autoplay finished: ${game.state.finale?.winner ?? "unfinished"} after ${game.state.day} days`);
    }
    if (mode === "delete") {
      await db.from("games").delete().eq("code", code);
      console.log(`DRIVE deleted ${code}`);
    }
    const g = await loadGame(code).catch(() => null);
    if (g) console.log(`DRIVE phase=${g.state.phase} day=${g.state.day} version=${g.state.version} round=${g.state.currentRoundId ?? "-"}`);
  });
});
