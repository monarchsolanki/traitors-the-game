import "server-only";
import { NOT_UNDOABLE, undoState } from "@/lib/game/engine";
import type { Actor, GameState } from "@/lib/game/types";
import type { StoredGame } from "./games";
import { loadGame } from "./games";
import { adminClient } from "./supabase";

interface LedgerRow {
  version_after: number;
  actor: Actor;
  action: { type: string; restoredVersion?: number };
  created_at: string;
  state_after: GameState;
}

export type UndoPlan =
  | { available: true; summary: string; target: number; targetState: GameState; targetSavedAt: number }
  | { available: false; reason: string };

async function ledgerRow(gameId: string, version: number): Promise<LedgerRow | null> {
  const { data, error } = await adminClient()
    .from("game_actions")
    .select("version_after, actor, action, created_at, state_after")
    .eq("game_id", gameId)
    .eq("version_after", version)
    .maybeSingle();
  if (error) throw error;
  return (data as LedgerRow | null) ?? null;
}

/**
 * Which step an undo would take back. Undo walks back through the host's (and the timer's) steps;
 * it stops at a player's move, so it never silently erases someone's vote or pick.
 */
export async function undoPlan(game: StoredGame): Promise<UndoPlan> {
  const v = game.state.version;
  if (game.state.finale?.revealed) return { available: false, reason: "The result is revealed, so undo is off." };
  const last = await ledgerRow(game.id, v);
  if (!last) return { available: false, reason: "Nothing to undo yet." };
  const base = last.action.type === "undo" ? last.action.restoredVersion ?? 0 : v;
  if (base < 2) return { available: false, reason: "Nothing earlier to undo." };
  const step = base === v ? last : await ledgerRow(game.id, base);
  if (!step) return { available: false, reason: "Nothing earlier to undo." };
  if (step.actor.kind === "player") {
    return { available: false, reason: "A player acted last, so undo would erase their move. Use the Fix tab instead." };
  }
  if (NOT_UNDOABLE.has(step.action.type)) {
    return { available: false, reason: "The last step changed a seat, PIN or photo; fix that in the Players tab instead." };
  }
  const target = await ledgerRow(game.id, base - 1);
  if (!target) return { available: false, reason: "Nothing earlier to undo." };
  const summary = step.state_after.log[step.state_after.log.length - 1]?.summary ?? step.action.type;
  return { available: true, summary, target: base - 1, targetState: target.state_after, targetSavedAt: Date.parse(target.created_at) };
}

export type UndoResult = { ok: true; game: StoredGame } | { ok: false; status: number; reason: string; stale?: boolean };

export async function applyUndo(code: string, key: string, expectedVersion: number, reason: string): Promise<UndoResult> {
  const game = await loadGame(code);
  const { data: dup, error: dupErr } = await adminClient()
    .from("game_actions")
    .select("id")
    .eq("game_id", game.id)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (dupErr) throw dupErr;
  if (dup) return { ok: true, game };
  if (game.state.version !== expectedVersion) {
    return { ok: false, status: 409, stale: true, reason: "Your screen was a step behind. It has refreshed; check and try again." };
  }
  if (!reason.trim()) return { ok: false, status: 422, reason: "Give a reason; it goes in the action log." };
  const plan = await undoPlan(game);
  if (!plan.available) return { ok: false, status: 422, reason: plan.reason };
  const next = undoState(game.state, plan.targetState, {
    at: Date.now(),
    reason,
    summary: plan.summary,
    targetSavedAt: plan.targetSavedAt,
  });
  const { data, error } = await adminClient().rpc("apply_game_action", {
    p_game_id: game.id,
    p_expected_version: game.state.version,
    p_idempotency_key: key,
    p_actor: { kind: "host" },
    p_action: { type: "undo", restoredVersion: plan.target, reason },
    p_state: next,
  });
  if (error) throw error;
  const outcome = (data as { result: string }).result;
  if (outcome === "stale") return { ok: false, status: 409, stale: true, reason: "The game moved on. Check and try again." };
  return { ok: true, game: { ...game, state: next } };
}
