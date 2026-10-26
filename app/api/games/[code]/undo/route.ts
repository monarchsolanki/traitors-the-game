import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { loadGame, requireGameHost } from "@/lib/server/games";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { seatsFor } from "@/lib/server/seats";
import { applyUndo, undoPlan } from "@/lib/server/undo";
import { buildViewResponse, seatInfo } from "@/lib/server/views";

/** What an undo would take back right now (host only). */
export async function GET(req: Request, ctx: RouteContext<"/api/games/[code]/undo">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const game = await loadGame(code);
    requireGameHost(game, user.id);
    const plan = await undoPlan(game);
    return json(plan.available ? { available: true, summary: plan.summary } : { available: false, reason: plan.reason });
  });
}

const body = z.object({ key: z.string().min(8).max(100), expectedVersion: z.number().int().min(0), reason: z.string().max(300) });

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/undo">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "That undo request isn't valid.");
    const game = await loadGame(code);
    requireGameHost(game, user.id);
    const result = await applyUndo(game.code, `${user.id}:${parsed.data.key}`, parsed.data.expectedVersion, parsed.data.reason);
    const latest = result.ok ? result.game : await loadGame(game.code);
    const view = await buildViewResponse(latest, { kind: "host" }, { seats: seatInfo(await seatsFor(latest.id)) });
    if (!result.ok) return json({ ...view, error: result.reason, stale: result.stale ?? false }, result.status);
    return json({ ...view, ok: true });
  });
}
