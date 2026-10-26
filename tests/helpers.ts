import { expect } from "vitest";
import { applyGameAction, createGame } from "@/lib/game/engine";
import type { GameSettings } from "@/lib/game/settings";
import type { ActionPayload, Actor, GameState, Player, Role } from "@/lib/game/types";

export const T0 = 1_800_000_000_000;
export const HOST: Actor = { kind: "host" };
export const SYSTEM: Actor = { kind: "system" };
export const as = (playerId: string): Actor => ({ kind: "player", playerId });

export function roster(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `Player ${i + 1}`, displayName: `P${i + 1}` }));
}

/** A small driver around the pure engine for tests. */
export class G {
  state: GameState;
  now: number;

  constructor(state: GameState, now = T0) {
    this.state = state;
    this.now = now;
  }

  try(actor: Actor, payload: ActionPayload) {
    this.now += 1000;
    return applyGameAction(this.state, { ...payload, actor, at: this.now } as never);
  }

  do(actor: Actor, payload: ActionPayload): GameState {
    const r = this.try(actor, payload);
    if (!r.ok) throw new Error(`${payload.type} rejected: ${r.reason}`);
    expect(r.nextState.version).toBe(this.state.version + 1);
    this.state = r.nextState;
    return this.state;
  }

  /** Expects a rejection and returns its reason; state is unchanged. */
  no(actor: Actor, payload: ActionPayload): string {
    const before = this.state;
    const r = this.try(actor, payload);
    if (r.ok) throw new Error(`${payload.type} should have been rejected`);
    expect(this.state).toBe(before);
    return r.reason;
  }

  host(payload: ActionPayload) {
    return this.do(HOST, payload);
  }

  by(playerId: string, payload: ActionPayload) {
    return this.do(as(playerId), payload);
  }

  /** Moves past the current deadline and ticks. */
  expire() {
    const d = this.state.deadline;
    if (d === null) throw new Error("No deadline to expire");
    this.now = Math.max(this.now, d);
    return this.do(SYSTEM, { type: "tick" });
  }

  p(id: string): Player {
    return this.state.players.find((p) => p.id === id)!;
  }

  get phase() {
    return this.state.phase;
  }

  alive(): string[] {
    return this.state.players.filter((p) => p.status === "alive").map((p) => p.id);
  }

  round() {
    return this.state.rounds.find((r) => r.id === this.state.currentRoundId)!;
  }

  lastRound() {
    return this.state.rounds[this.state.rounds.length - 1];
  }

  night() {
    return this.state.nights[this.state.nights.length - 1];
  }

  items(holderId: string, type?: "shield" | "dagger") {
    return this.state.items.filter((i) => i.holderId === holderId && (!type || i.type === type));
  }

  /** Test-only: set exact roles after dealing so tests are deterministic. */
  setRoles(traitors: string[]) {
    const roles: Record<string, Role> = {};
    for (const p of this.state.players) roles[p.id] = traitors.includes(p.id) ? "traitor" : "innocent";
    this.state = { ...this.state, roles };
  }

  // ---- common sequences ----

  seatAll() {
    for (const p of this.state.players) {
      if (!p.seatClaimed) this.by(p.id, { type: "claimSeat" });
      if (!this.p(p.id).seatConfirmed) this.host({ type: "confirmSeat", playerId: p.id });
    }
  }

  circle() {
    this.host({ type: "openCircle" });
    this.host({ type: "openVoting" });
  }

  /** Every listed voter votes; anyone not listed abstains. Then locks if still open. */
  vote(ballots: Record<string, string>, daggers: string[] = []) {
    for (const [voter, target] of Object.entries(ballots)) {
      if (this.state.phase !== "CIRCLE_VOTE" && this.state.phase !== "ENDGAME_BANISH") break;
      if (this.round()?.status !== "open") break;
      this.by(voter, { type: "castVote", targetId: target, useDagger: daggers.includes(voter) });
    }
    const r = this.round();
    if (r && r.status === "open") this.host({ type: "lockVoting" });
  }

  reveal() {
    this.host({ type: "finishReveal" });
  }

  /** Everyone alive votes for `target`, except `target`, who votes for `fallback`. */
  banish(target: string, fallback?: string) {
    const ballots: Record<string, string> = {};
    for (const id of this.alive()) {
      if (id === target) ballots[id] = fallback ?? this.alive().find((x) => x !== target)!;
      else ballots[id] = target;
    }
    this.vote(ballots);
    this.reveal();
  }

  /** Each living Traitor picks the given target. */
  pickAll(target: string) {
    const traitors = this.alive().filter((id) => this.state.roles[id] === "traitor");
    for (const t of traitors) {
      if (this.state.phase !== "NIGHT") break;
      this.by(t, { type: "nightPick", targetId: target === t ? this.alive().find((x) => x !== t)! : target });
    }
  }
}

export function lobby(n = 12, settings: Partial<GameSettings> = {}): G {
  return new G(createGame({ code: "TEST", seed: "seed-1", at: T0, roster: roster(n), settings }));
}

/** A dealt game with exact Traitors (default p1, p2, p3), now in ROLES. */
export function dealt(n = 12, o: { settings?: Partial<GameSettings>; traitors?: string[] } = {}): G {
  const g = lobby(n, o.settings);
  g.seatAll();
  g.host({ type: "dealRoles" });
  g.setRoles(o.traitors ?? ["p1", "p2", "p3"].slice(0, g.state.settings.traitorCount));
  return g;
}
