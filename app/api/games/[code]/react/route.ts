import { reactionRefusal } from "@/lib/game/ghosts";
import { requireUser } from "@/lib/server/auth";
import { loadGame } from "@/lib/server/games";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { seatForUser } from "@/lib/server/seats";
import { adminClient } from "@/lib/server/supabase";

const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 30;
const KEEP_MS = 60 * 60 * 1000;

/**
 * A ghost floats an emoji across the big screen (Live reactions, section 8). Only the room code, the
 * emoji and the time are stored, so the big screen never learns who sent it. Over the cap, quietly dropped.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/react">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const body = (await readJson(req)) as { emoji?: unknown } | null;
    const game = await loadGame(code);
    const seat = await seatForUser(game.id, user.id);
    if (!seat) throw new HttpError(403, "Tap your photo to take your seat first.");
    const emoji = typeof body?.emoji === "string" ? body.emoji : "";
    const refusal = reactionRefusal(game.state, seat.player_id, emoji);
    if (refusal) throw new HttpError(422, refusal);
    const db = adminClient();
    const { count, error: countError } = await db
      .from("game_reactions")
      .select("id", { count: "exact", head: true })
      .eq("code", game.code)
      .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_PER_WINDOW) return json({ ok: false, busy: true });
    const { error } = await db.from("game_reactions").insert({ code: game.code, emoji });
    if (error) throw error;
    await db.from("game_reactions").delete().eq("code", game.code).lt("created_at", new Date(Date.now() - KEEP_MS).toISOString());
    return json({ ok: true });
  });
}
