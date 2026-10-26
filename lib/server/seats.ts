import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { StoredGame } from "./games";
import { runActionOrThrow } from "./games";
import { HttpError } from "./http";
import { adminClient } from "./supabase";
import type { RequestUser } from "./auth";

export interface SeatRow {
  player_id: string;
  user_id: string | null;
  pin_hash: string | null;
  failed_attempts: number;
  locked: boolean;
  last_seen: string | null;
  is_bot: boolean;
}

const SEAT_COLUMNS = "player_id, user_id, pin_hash, failed_attempts, locked, last_seen, is_bot";

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(pin, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function validPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export async function seatsFor(gameId: string): Promise<SeatRow[]> {
  const { data, error } = await adminClient().from("seats").select(SEAT_COLUMNS).eq("game_id", gameId);
  if (error) throw error;
  return data as SeatRow[];
}

export async function seatForUser(gameId: string, userId: string): Promise<SeatRow | null> {
  const { data, error } = await adminClient()
    .from("seats")
    .select(SEAT_COLUMNS)
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as SeatRow | null) ?? null;
}

async function seatRow(gameId: string, playerId: string): Promise<SeatRow | null> {
  const { data, error } = await adminClient()
    .from("seats")
    .select(SEAT_COLUMNS)
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return (data as SeatRow | null) ?? null;
}

/** Records that this phone was seen, at most every 30 seconds (for connection badges). */
export async function touchSeat(gameId: string, seat: SeatRow): Promise<void> {
  if (seat.last_seen && Date.now() - Date.parse(seat.last_seen) < 30_000) return;
  await adminClient()
    .from("seats")
    .update({ last_seen: new Date().toISOString() })
    .eq("game_id", gameId)
    .eq("player_id", seat.player_id);
}

/**
 * Tap your photo and enter a PIN (section 9.5). An open seat is claimed with a new PIN; a claimed
 * seat is rejoined on this phone with the right PIN. Wrong PINs count towards the lock.
 */
export async function claimOrRejoin(
  game: StoredGame,
  user: RequestUser,
  playerId: string,
  pin: string,
): Promise<{ rejoined: boolean }> {
  const player = game.state.players.find((p) => p.id === playerId);
  if (!player) throw new HttpError(404, "That player isn't in this game.");
  const mine = await seatForUser(game.id, user.id);
  if (mine && mine.player_id !== playerId) {
    const other = game.state.players.find((p) => p.id === mine.player_id);
    throw new HttpError(409, `This phone already holds ${other?.displayName ?? "another"}'s seat. Ask the host to reset it.`);
  }
  const db = adminClient();
  const seat = await seatRow(game.id, playerId);

  if (!player.seatClaimed) {
    if (seat?.is_bot) throw new HttpError(409, "A bot holds that seat. Ask the host to reset it.");
    const row = {
      game_id: game.id,
      player_id: playerId,
      user_id: user.id,
      pin_hash: hashPin(pin),
      failed_attempts: 0,
      locked: false,
      is_bot: false,
      last_seen: new Date().toISOString(),
    };
    if (!seat) {
      const { error } = await db.from("seats").insert(row);
      if (error && error.code === "23505") throw new HttpError(409, "Someone just took that seat. Ask the host if it's yours.");
      if (error) throw error;
    } else {
      const { data, error } = await db
        .from("seats")
        .update(row)
        .eq("game_id", game.id)
        .eq("player_id", playerId)
        .is("pin_hash", null)
        .select("player_id");
      if (error) throw error;
      if (!data?.length) throw new HttpError(409, "Someone just took that seat. Ask the host if it's yours.");
    }
    try {
      await runActionOrThrow(game.code, { kind: "player", playerId }, { type: "claimSeat" }, `claim:${playerId}:${user.id}`);
    } catch (err) {
      await db
        .from("seats")
        .update({ user_id: null, pin_hash: null })
        .eq("game_id", game.id)
        .eq("player_id", playerId)
        .eq("user_id", user.id);
      throw err;
    }
    return { rejoined: false };
  }

  if (!seat || seat.is_bot) throw new HttpError(409, "That seat is taken. Ask the host to reset it if it's yours.");
  if (!seat.pin_hash) throw new HttpError(409, "That seat has no PIN yet. Ask the host to reset it.");
  if (seat.locked) throw new HttpError(423, "Too many wrong PINs. Ask the host to unlock this seat.");
  if (!verifyPin(pin, seat.pin_hash)) {
    const failed = seat.failed_attempts + 1;
    const max = game.state.settings.pinMaxAttempts;
    const locked = failed >= max;
    await db
      .from("seats")
      .update({ failed_attempts: failed, locked })
      .eq("game_id", game.id)
      .eq("player_id", playerId);
    throw new HttpError(
      401,
      locked ? "Wrong PIN. The seat is now locked; ask the host to unlock it." : `Wrong PIN. ${max - failed} ${max - failed === 1 ? "try" : "tries"} left.`,
    );
  }
  const { error } = await db
    .from("seats")
    .update({ user_id: user.id, failed_attempts: 0, last_seen: new Date().toISOString() })
    .eq("game_id", game.id)
    .eq("player_id", playerId);
  if (error) throw error;
  return { rejoined: true };
}

export async function unlockSeat(game: StoredGame, playerId: string): Promise<void> {
  const { error } = await adminClient()
    .from("seats")
    .update({ locked: false, failed_attempts: 0 })
    .eq("game_id", game.id)
    .eq("player_id", playerId);
  if (error) throw error;
}

/** Clears the phone, PIN and bot flag, then resets the seat in the engine. */
export async function resetSeat(game: StoredGame, playerId: string, key: string): Promise<StoredGame> {
  const { error } = await adminClient().from("seats").delete().eq("game_id", game.id).eq("player_id", playerId);
  if (error) throw error;
  return runActionOrThrow(game.code, { kind: "host" }, { type: "resetSeat", playerId }, key);
}

/** Fills every open seat with a bot and confirms it, so the host can play a whole game alone. */
export async function fillBots(game: StoredGame): Promise<number> {
  const open = game.state.players.filter((p) => !p.seatClaimed);
  for (const p of open) {
    const { error } = await adminClient()
      .from("seats")
      .upsert({ game_id: game.id, player_id: p.id, user_id: null, pin_hash: null, is_bot: true, failed_attempts: 0, locked: false });
    if (error) throw error;
    await runActionOrThrow(game.code, { kind: "player", playerId: p.id }, { type: "claimSeat" }, `bot-claim:${p.id}:${game.state.version}`);
    await runActionOrThrow(game.code, { kind: "host" }, { type: "confirmSeat", playerId: p.id }, `bot-confirm:${p.id}:${game.state.version}`);
  }
  return open.length;
}
