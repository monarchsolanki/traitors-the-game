import { requireListedHost } from "@/lib/server/auth";
import { loadGame, requireGameHost } from "@/lib/server/games";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { deletePreset, listPresets, savePreset } from "@/lib/server/presets";

/** The host's saved presets. */
export async function GET(req: Request) {
  return handle(async () => {
    const host = await requireListedHost(req);
    return json({ presets: await listPresets(host.id) });
  });
}

/** Saves one of the host's games as a preset: { code, name }. */
export async function POST(req: Request) {
  return handle(async () => {
    const host = await requireListedHost(req);
    const body = (await readJson(req)) as { code?: unknown; name?: unknown } | null;
    if (typeof body?.code !== "string" || typeof body.name !== "string") throw new HttpError(400, "Pick a game and a name.");
    const game = await loadGame(body.code);
    requireGameHost(game, host.id);
    return json(await savePreset(host.id, game, body.name), 201);
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const host = await requireListedHost(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "Pick a preset.");
    await deletePreset(host.id, id);
    return json({ ok: true });
  });
}
