import { requireListedHost } from "@/lib/server/auth";
import { createStoredGame, deleteStoredGame, listHostGames, loadGame, requireGameHost } from "@/lib/server/games";
import { handle, HttpError, json } from "@/lib/server/http";
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

/** Deletes one of this host's games for good: ?code=ABCDE. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const host = await requireListedHost(req);
    const code = new URL(req.url).searchParams.get("code");
    if (!code) throw new HttpError(400, "Pick a game.");
    const game = await loadGame(code);
    requireGameHost(game, host.id);
    await deleteStoredGame(game);
    return json({ ok: true });
  });
}
