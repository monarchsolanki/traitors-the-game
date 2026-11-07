import { actionRequestSchema, COHOST_ACTIONS, PLAYER_ACTIONS } from "@/lib/game/actions";
import type { Actor, Viewer } from "@/lib/game/types";
import { requestUser, requireUser } from "@/lib/server/auth";
import { loadGame, requireGameHost, runAction } from "@/lib/server/games";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { seatForUser, seatsFor } from "@/lib/server/seats";
import { buildViewResponse, seatInfo } from "@/lib/server/views";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/action">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const parsed = actionRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "That action isn't valid.");
    const body = parsed.data;
    const game = await loadGame(code);

    let actor: Actor;
    let viewer: Viewer = { kind: "screen" };
    let key: string;
    if (body.action.type === "tick") {
      // Anyone may nudge the timer; the engine checks the server deadline and ignores early ticks.
      actor = { kind: "system" };
      key = `tick:${body.key}`;
      const user = await requestUser(req);
      if (user && body.as === "host" && game.hostUserId === user.id) viewer = { kind: "host" };
      if (user && (body.as === "player" || body.as === "cohost")) {
        const seat = await seatForUser(game, user.id);
        if (seat && body.as === "cohost" && game.state.cohostId === seat.player_id) viewer = { kind: "cohost" };
        else if (seat && body.as === "player") viewer = { kind: "player", playerId: seat.player_id };
      }
    } else {
      const user = await requireUser(req);
      key = `${user.id}:${body.key}`;
      if (body.as === "host") {
        requireGameHost(game, user.id);
        actor = { kind: "host" };
        viewer = { kind: "host" };
      } else if (body.as === "player") {
        const seat = await seatForUser(game, user.id);
        if (!seat) throw new HttpError(403, "Tap your photo to take your seat first.");
        if (!PLAYER_ACTIONS.has(body.action.type)) throw new HttpError(403, "Only the host can do that.");
        actor = { kind: "player", playerId: seat.player_id };
        viewer = { kind: "player", playerId: seat.player_id };
      } else if (body.as === "cohost") {
        const seat = await seatForUser(game, user.id);
        if (!seat || game.state.cohostId !== seat.player_id) throw new HttpError(403, "Only the co-host can do that.");
        if (!COHOST_ACTIONS.has(body.action.type)) throw new HttpError(403, "Only the host can do that.");
        actor = { kind: "cohost", playerId: seat.player_id };
        viewer = { kind: "cohost" };
      } else {
        throw new HttpError(400, "Unknown sender.");
      }
    }

    const result = await runAction(game.code, actor, body.action, key, body.expectedVersion);
    const latest = result.ok ? result.game : await loadGame(game.code);
    const extra = viewer.kind === "host" ? { seats: seatInfo(await seatsFor(latest.id)) } : {};
    const view = await buildViewResponse(latest, viewer, extra);
    if (!result.ok) return json({ ...view, error: result.reason, stale: result.stale ?? false }, result.status);
    return json({ ...view, ok: true, duplicate: result.duplicate });
  });
}
