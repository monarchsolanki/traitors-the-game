import { requireUser } from "@/lib/server/auth";
import { loadGame, requireGameHost } from "@/lib/server/games";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { applyPresetToGame } from "@/lib/server/presets";
import { seatsFor } from "@/lib/server/seats";
import { buildViewResponse, seatInfo } from "@/lib/server/views";

/** Applies a saved preset's settings and missions to this game, in the lobby: { presetId, key }. */
export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/preset">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const body = (await readJson(req)) as { presetId?: unknown; key?: unknown } | null;
    if (typeof body?.presetId !== "string" || typeof body.key !== "string" || body.key.length < 8) {
      throw new HttpError(400, "Pick a preset.");
    }
    const game = await loadGame(code);
    requireGameHost(game, user.id);
    const result = await applyPresetToGame(user.id, game, body.presetId, `${user.id}:${body.key}`);
    const latest = result.ok ? result.game : await loadGame(game.code);
    const view = await buildViewResponse(latest, { kind: "host" }, { seats: seatInfo(await seatsFor(latest.id)) });
    if (!result.ok) return json({ ...view, error: result.reason }, result.status);
    return json({ ...view, ok: true });
  });
}
