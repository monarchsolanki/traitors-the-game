import { describe, it } from "vitest";
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
    if (mode === "delete") {
      await db.from("games").delete().eq("code", code);
      console.log(`DRIVE deleted ${code}`);
    }
    const g = await loadGame(code).catch(() => null);
    if (g) console.log(`DRIVE phase=${g.state.phase} day=${g.state.day} version=${g.state.version} round=${g.state.currentRoundId ?? "-"}`);
  });
});
