import "server-only";
import type { SeatInfo, ViewResponse } from "@/lib/game/api-types";
import type { Viewer } from "@/lib/game/types";
import { viewFor } from "@/lib/game/view";
import type { StoredGame } from "./games";
import type { SeatRow } from "./seats";
import { adminClient, PHOTO_BUCKET } from "./supabase";

const SIGNED_SECONDS = 3600;
const signedCache = new Map<string, { url: string; expires: number }>();

async function signPhotos(game: StoredGame): Promise<Record<string, string>> {
  const now = Date.now();
  const paths = [
    ...new Set(
      game.state.players
        .map((p) => p.photoPath)
        .filter((p): p is string => !!p && p.startsWith(`${game.id}/`)),
    ),
  ];
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const path of paths) {
    const hit = signedCache.get(path);
    if (hit && hit.expires > now + 10 * 60_000) out[path] = hit.url;
    else missing.push(path);
  }
  if (missing.length) {
    const { data, error } = await adminClient().storage.from(PHOTO_BUCKET).createSignedUrls(missing, SIGNED_SECONDS);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) {
        out[item.path] = item.signedUrl;
        signedCache.set(item.path, { url: item.signedUrl, expires: now + SIGNED_SECONDS * 1000 });
      }
    }
  }
  return out;
}

export function seatInfo(rows: SeatRow[]): SeatInfo[] {
  return rows.map((r) => ({
    playerId: r.player_id,
    bound: !!r.user_id,
    isBot: r.is_bot,
    locked: r.locked,
    failedAttempts: r.failed_attempts,
    lastSeen: r.last_seen,
  }));
}

export async function buildViewResponse(
  game: StoredGame,
  viewer: Viewer,
  extra: Partial<Pick<ViewResponse, "seated" | "seats">> = {},
): Promise<ViewResponse> {
  return {
    view: viewFor(game.state, viewer),
    serverNow: Date.now(),
    photoUrls: await signPhotos(game),
    ...extra,
  };
}
