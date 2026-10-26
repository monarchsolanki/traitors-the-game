import { requireUser } from "@/lib/server/auth";
import { loadGame, requireGameHost } from "@/lib/server/games";
import { handle, HttpError, json } from "@/lib/server/http";
import { seatForUser, seatsFor, touchSeat } from "@/lib/server/seats";
import { buildViewResponse, seatInfo } from "@/lib/server/views";

export async function GET(req: Request, ctx: RouteContext<"/api/games/[code]/view">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const as = new URL(req.url).searchParams.get("as") ?? "screen";
    const game = await loadGame(code);
    if (as === "screen") return json(await buildViewResponse(game, { kind: "screen" }));
    const user = await requireUser(req);
    if (as === "host") {
      requireGameHost(game, user.id);
      return json(await buildViewResponse(game, { kind: "host" }, { seats: seatInfo(await seatsFor(game.id)) }));
    }
    if (as !== "player") throw new HttpError(400, "Unknown view.");
    const seat = await seatForUser(game.id, user.id);
    if (!seat) return json(await buildViewResponse(game, { kind: "screen" }, { seated: false }));
    await touchSeat(game.id, seat);
    return json(await buildViewResponse(game, { kind: "player", playerId: seat.player_id }, { seated: true }));
  });
}
