import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { applyGameAction, createGame } from "@/lib/game/engine";
import type { ActionPayload, Actor, GameState } from "@/lib/game/types";
import { HttpError } from "./http";
import { adminClient } from "./supabase";

export interface StoredGame {
  id: string;
  code: string;
  hostUserId: string;
  state: GameState;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export function normaliseCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new HttpError(404, "That room code doesn't exist.");
  return code;
}

export async function loadGame(rawCode: string): Promise<StoredGame> {
  const code = normaliseCode(rawCode);
  const { data, error } = await adminClient()
    .from("games")
    .select("id, code, host_user_id, state")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "That room code doesn't exist.");
  return { id: data.id, code: data.code, hostUserId: data.host_user_id, state: data.state as GameState };
}

export function requireGameHost(game: StoredGame, userId: string): void {
  if (game.hostUserId !== userId) throw new HttpError(403, "Only this game's host can do that.");
}

export async function createStoredGame(hostUserId: string): Promise<StoredGame> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const state = createGame({ code, seed: randomBytes(16).toString("hex"), at: Date.now() });
    const { data, error } = await adminClient().rpc("create_game", { p_code: code, p_host: hostUserId, p_state: state });
    if (!error) return { id: data as string, code, hostUserId, state };
    if (error.code !== "23505") throw error;
  }
  throw new HttpError(503, "Couldn't find a free room code. Try again.");
}

export async function listHostGames(hostUserId: string) {
  const { data, error } = await adminClient()
    .from("games")
    .select("code, phase, day, status, created_at, updated_at")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export type RunResult =
  | { ok: true; game: StoredGame; duplicate: boolean }
  | { ok: false; status: number; reason: string; stale?: boolean };

async function alreadyApplied(gameId: string, key: string): Promise<boolean> {
  const { data, error } = await adminClient()
    .from("game_actions")
    .select("id")
    .eq("game_id", gameId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Loads the game, runs the engine and saves with an optimistic version check (section 9.3).
 * With expectedVersion (host buttons), a changed game is refused as stale so a double tap can't
 * advance twice. Without it (player actions, ticks, bots), a stale save is retried on the newer
 * state and the engine decides again.
 */
export async function runAction(
  code: string,
  actor: Actor,
  payload: ActionPayload,
  key: string,
  expectedVersion?: number,
): Promise<RunResult> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.random() * Math.min(400, 25 * attempt)));
    const game = await loadGame(code);
    if (await alreadyApplied(game.id, key)) return { ok: true, game, duplicate: true };
    if (expectedVersion !== undefined && game.state.version !== expectedVersion) {
      return { ok: false, status: 409, stale: true, reason: "Your screen was a step behind. It has refreshed; check and try again." };
    }
    const result = applyGameAction(game.state, { ...payload, actor, at: Date.now() } as never);
    if (!result.ok) return { ok: false, status: 422, reason: result.reason };
    const { data, error } = await adminClient().rpc("apply_game_action", {
      p_game_id: game.id,
      p_expected_version: game.state.version,
      p_idempotency_key: key,
      p_actor: actor,
      p_action: payload,
      p_state: result.nextState,
    });
    if (error) throw error;
    const outcome = (data as { result: string }).result;
    if (outcome === "applied") return { ok: true, game: { ...game, state: result.nextState }, duplicate: false };
    if (outcome === "duplicate") return { ok: true, game: await loadGame(code), duplicate: true };
    // Stale: go round again. A copy of this same request that just landed counts as a duplicate;
    // otherwise a host tap (expectedVersion) is refused as stale at the top of the loop.
  }
  return { ok: false, status: 503, reason: "The game is busy right now. Try again." };
}

/** Like runAction, but throws on failure. For server-driven sequences (bots, seat claims). */
export async function runActionOrThrow(code: string, actor: Actor, payload: ActionPayload, key: string): Promise<StoredGame> {
  const r = await runAction(code, actor, payload, key);
  if (!r.ok) throw new HttpError(r.status, r.reason);
  return r.game;
}
