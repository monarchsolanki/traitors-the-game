import { requireUser } from "@/lib/server/auth";
import { runBots } from "@/lib/server/bots";
import { loadGame, requireGameHost } from "@/lib/server/games";
import { handle, json } from "@/lib/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/bots">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const game = await loadGame(code);
    requireGameHost(game, user.id);
    const { moves } = await runBots(game);
    return json({ ok: true, moves });
  });
}
