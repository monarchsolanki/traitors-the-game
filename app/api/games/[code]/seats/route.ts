import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { loadGame, requireGameHost } from "@/lib/server/games";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { fillBots, resetSeat, seatsFor, unlockSeat } from "@/lib/server/seats";
import { buildViewResponse, seatInfo } from "@/lib/server/views";

const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("unlock"), playerId: z.string().min(1).max(40) }),
  z.object({ op: z.literal("reset"), playerId: z.string().min(1).max(40), key: z.string().min(8).max(100) }),
  z.object({ op: z.literal("fillBots") }),
]);

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/seats">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "That seat request isn't valid.");
    let game = await loadGame(code);
    requireGameHost(game, user.id);
    const op = parsed.data;
    if (op.op === "unlock") await unlockSeat(game, op.playerId);
    if (op.op === "reset") game = await resetSeat(game, op.playerId, `${user.id}:${op.key}`);
    if (op.op === "fillBots") await fillBots(game);
    game = await loadGame(code);
    return json({ ok: true, ...(await buildViewResponse(game, { kind: "host" }, { seats: seatInfo(await seatsFor(game.id)) })) });
  });
}
