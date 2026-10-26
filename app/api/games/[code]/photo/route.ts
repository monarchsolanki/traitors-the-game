import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/server/auth";
import { loadGame, requireGameHost, runAction } from "@/lib/server/games";
import { handle, HttpError, json } from "@/lib/server/http";
import { adminClient, PHOTO_BUCKET } from "@/lib/server/supabase";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function removeOld(gameId: string, path: string | null) {
  if (path && path.startsWith(`${gameId}/`)) await adminClient().storage.from(PHOTO_BUCKET).remove([path]);
}

/** Host uploads a player's photo (resized on the phone first). Stored privately; screens get signed links. */
export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/photo">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const game = await loadGame(code);
    requireGameHost(game, user.id);
    const form = await req.formData().catch(() => null);
    const playerId = form?.get("playerId");
    const file = form?.get("file");
    if (typeof playerId !== "string" || !(file instanceof Blob)) throw new HttpError(400, "Pick a player and a photo.");
    const player = game.state.players.find((p) => p.id === playerId);
    if (!player) throw new HttpError(404, "That player isn't in this game.");
    const ext = TYPES[file.type];
    if (!ext) throw new HttpError(415, "Use a JPEG, PNG or WebP photo.");
    if (file.size > MAX_BYTES) throw new HttpError(413, "That photo is over 5 MB.");
    const path = `${game.id}/${playerId}-${randomBytes(6).toString("hex")}.${ext}`;
    const { error } = await adminClient()
      .storage.from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const result = await runAction(game.code, { kind: "host" }, { type: "setPhoto", playerId, photoPath: path }, `${user.id}:photo:${path}`);
    if (!result.ok) {
      await removeOld(game.id, path);
      throw new HttpError(result.status, result.reason);
    }
    await removeOld(game.id, player.photoPath);
    return json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/games/[code]/photo">) {
  return handle(async () => {
    const { code } = await ctx.params;
    const user = await requireUser(req);
    const game = await loadGame(code);
    requireGameHost(game, user.id);
    const playerId = new URL(req.url).searchParams.get("playerId");
    const player = game.state.players.find((p) => p.id === playerId);
    if (!player) throw new HttpError(404, "That player isn't in this game.");
    const result = await runAction(game.code, { kind: "host" }, { type: "setPhoto", playerId: player.id, photoPath: null }, `${user.id}:photo-remove:${player.id}:${game.state.version}`);
    if (!result.ok) throw new HttpError(result.status, result.reason);
    await removeOld(game.id, player.photoPath);
    return json({ ok: true });
  });
}
