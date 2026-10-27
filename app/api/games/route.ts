import { requireListedHost } from "@/lib/server/auth";
import { createStoredGame, listHostGames } from "@/lib/server/games";
import { handle, json } from "@/lib/server/http";
import { createGameFromPreset } from "@/lib/server/presets";

export async function GET(req: Request) {
  return handle(async () => {
    const host = await requireListedHost(req);
    return json({ games: await listHostGames(host.id) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const host = await requireListedHost(req);
    const body = (await req.json().catch(() => null)) as { presetId?: unknown } | null;
    const game = typeof body?.presetId === "string" ? await createGameFromPreset(host.id, body.presetId) : await createStoredGame(host.id);
    return json({ code: game.code }, 201);
  });
}
