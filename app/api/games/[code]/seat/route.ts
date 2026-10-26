import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { loadGame } from "@/lib/server/games";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { claimOrRejoin, validPin } from "@/lib/server/seats";

const body = z.object({ playerId: z.string().min(1).max(40), pin: z.string() });

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/seat">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Pick your photo and enter a PIN.");
    if (!validPin(parsed.data.pin)) throw new HttpError(400, "The PIN is 4 digits.");
    const game = await loadGame(code);
    const { rejoined } = await claimOrRejoin(game, user, parsed.data.playerId, parsed.data.pin);
    return json({ ok: true, rejoined });
  });
}
