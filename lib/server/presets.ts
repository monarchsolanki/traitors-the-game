import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { DEFAULT_SETTINGS, type GameSettings, type MissionTemplate } from "@/lib/game/settings";
import { createStoredGame, loadGame, runAction, runActionOrThrow, type StoredGame } from "./games";
import { HttpError } from "./http";
import { adminClient, PHOTO_BUCKET } from "./supabase";

/**
 * Saved presets (section 4.3, tier 2): a game's settings, roster and mission catalogue, kept for the
 * next game. Photos are copied into the preset's own folder, so a preset outlives the game it came from.
 */
export interface PresetRosterEntry {
  name: string;
  displayName: string;
  photoPath: string | null;
}

interface PresetRow {
  id: string;
  name: string;
  settings: GameSettings;
  roster: PresetRosterEntry[];
  missions: MissionTemplate[];
  created_at: string;
}

const extOf = (path: string) => path.split(".").pop() || "jpg";

async function removePhotos(roster: PresetRosterEntry[]) {
  const paths = roster.map((r) => r.photoPath).filter((p): p is string => !!p && p.startsWith("presets/"));
  if (paths.length) await adminClient().storage.from(PHOTO_BUCKET).remove(paths);
}

export async function listPresets(userId: string) {
  const { data, error } = await adminClient()
    .from("presets")
    .select("id, name, roster, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Pick<PresetRow, "id" | "name" | "roster" | "created_at">[]).map((p) => ({
    id: p.id,
    name: p.name,
    players: p.roster.length,
    photos: p.roster.filter((r) => r.photoPath).length,
    createdAt: p.created_at,
  }));
}

async function getPreset(userId: string, id: string): Promise<PresetRow> {
  const { data, error } = await adminClient()
    .from("presets")
    .select("id, name, settings, roster, missions, created_at")
    .eq("owner_user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "That preset doesn't exist.");
  return data as PresetRow;
}

/** Saves (or replaces, by name) a preset from a game. */
export async function savePreset(userId: string, game: StoredGame, rawName: string): Promise<{ id: string }> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new HttpError(400, "Name the preset (up to 80 characters).");
  const db = adminClient();
  const { data: existing, error: findError } = await db
    .from("presets")
    .select("id, roster")
    .eq("owner_user_id", userId)
    .eq("name", name)
    .maybeSingle();
  if (findError) throw findError;
  const old = existing as Pick<PresetRow, "id" | "roster"> | null;
  const id = old?.id ?? randomUUID();
  const roster: PresetRosterEntry[] = [];
  for (const p of game.state.players) {
    let photoPath: string | null = null;
    if (p.photoPath) {
      const to = `presets/${id}/${p.id}-${randomBytes(4).toString("hex")}.${extOf(p.photoPath)}`;
      const { error } = await db.storage.from(PHOTO_BUCKET).copy(p.photoPath, to);
      if (!error) photoPath = to;
    }
    roster.push({ name: p.name, displayName: p.displayName, photoPath });
  }
  const row = { owner_user_id: userId, name, settings: game.state.settings, roster, missions: game.state.missionCatalogue };
  if (old) {
    const { error } = await db.from("presets").update(row).eq("id", id);
    if (error) throw error;
    await removePhotos(old.roster);
  } else {
    const { error } = await db.from("presets").insert({ id, ...row });
    if (error) throw error;
  }
  return { id };
}

export async function deletePreset(userId: string, id: string): Promise<void> {
  const preset = await getPreset(userId, id);
  const { error } = await adminClient().from("presets").delete().eq("id", preset.id);
  if (error) throw error;
  await removePhotos(preset.roster);
}

/** A new game from a preset: its roster with photos copied into the game, its settings and missions. */
export async function createGameFromPreset(userId: string, presetId: string): Promise<StoredGame> {
  const preset = await getPreset(userId, presetId);
  let game: StoredGame;
  try {
    game = await createStoredGame(userId, {
      roster: preset.roster.map((r) => ({ name: r.name, displayName: r.displayName })),
      settings: { ...DEFAULT_SETTINGS, ...preset.settings },
      missions: preset.missions,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "That preset can't start a game. Open it in a new game and fix its settings.");
  }
  for (let i = 0; i < preset.roster.length; i++) {
    const from = preset.roster[i].photoPath;
    const player = game.state.players[i];
    if (!from || !player) continue;
    const to = `${game.id}/${player.id}-${randomBytes(6).toString("hex")}.${extOf(from)}`;
    const { error } = await adminClient().storage.from(PHOTO_BUCKET).copy(from, to);
    if (error) continue;
    await runActionOrThrow(game.code, { kind: "host" }, { type: "setPhoto", playerId: player.id, photoPath: to }, `preset-photo:${game.id}:${player.id}`);
  }
  return loadGame(game.code);
}

/** Applies a preset's settings and missions to a game still in the lobby; the roster stays as it is. */
export async function applyPresetToGame(userId: string, game: StoredGame, presetId: string, key: string) {
  const preset = await getPreset(userId, presetId);
  return runAction(
    game.code,
    { kind: "host" },
    { type: "applyPreset", settings: { ...DEFAULT_SETTINGS, ...preset.settings }, missions: preset.missions },
    key,
  );
}
