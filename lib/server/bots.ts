import "server-only";
import { randomBytes } from "node:crypto";
import { shuffle } from "@/lib/game/random";
import { botMove } from "@/lib/game/simulator";
import type { StoredGame } from "./games";
import { runAction } from "./games";
import { seatsFor } from "./seats";

const BOT_CHAT = [
  "Who are we picking tonight?",
  "Let's keep it quiet at the Circle.",
  "I think they suspect me. Help me out tomorrow.",
  "Agreed.",
  "Not them, they're too obvious.",
];

/** Lets each bot seat make a move or two. The host's screen calls this while bots are on. */
export async function runBots(game: StoredGame, maxMoves = 3): Promise<{ moves: number; game: StoredGame }> {
  const bots = (await seatsFor(game.id)).filter((s) => s.is_bot).map((s) => s.player_id);
  let current = game;
  let moves = 0;
  for (let i = 0; i < maxMoves * 3 && moves < maxMoves && bots.length; i++) {
    const candidates = shuffle(bots, Math.random)
      .map((id) => ({ id, move: botMove(current.state, id, Math.random, { chatLines: BOT_CHAT }) }))
      .filter((c) => c.move);
    if (!candidates.length) break;
    const { id, move } = candidates[0];
    const r = await runAction(
      current.code,
      { kind: "player", playerId: id },
      move!,
      `bot:${id}:${current.state.version}:${randomBytes(4).toString("hex")}`,
    );
    if (r.ok) {
      current = r.game;
      moves++;
    }
  }
  return { moves, game: current };
}
