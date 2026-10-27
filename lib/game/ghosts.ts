import { seededRand, shuffle } from "./random";
import { BINGO_SIDE, REACTION_EMOJI } from "./settings";
import type { GameState, GhostGamesState } from "./types";

/**
 * Ghost games (section 8): pure helpers shared by the engine (which decides) and viewFor (which shows).
 * Score-only: nothing here touches the living game.
 */

export const emptyGhostGames = (): GhostGamesState => ({ bets: [], calls: [], crystal: [], bingo: {}, bingoWinnerId: null });

/** The murder victim before the host reveals it; every screen but the host's still shows them alive. */
export function pendingVictimId(s: GameState): string | null {
  if (s.phase === "FINALE") return null;
  const n = s.nights[s.nights.length - 1];
  return n && n.resolved && !n.revealed ? n.victimId : null;
}

/** A ghost everyone can already see is out (so never the victim of a night that isn't revealed yet). */
export function isVisibleGhost(s: GameState, playerId: string): boolean {
  const p = s.players.find((x) => x.id === playerId);
  return !!s.frozen && !!p && p.status !== "alive" && pendingVictimId(s) !== playerId;
}

const currentRound = (s: GameState) => (s.currentRoundId ? s.rounds.find((r) => r.id === s.currentRoundId) ?? null : null);

/** Banishment bets: during a Circle or the End Game, until the reveal starts. */
export function banishBetsOpen(s: GameState): boolean {
  if (!["CIRCLE_DEBATE", "CIRCLE_VOTE", "ENDGAME_VOTE", "ENDGAME_BANISH"].includes(s.phase)) return false;
  const r = currentRound(s);
  return !r || r.status === "open";
}

/** Murder bets: while the night is on. */
export function murderBetsOpen(s: GameState): boolean {
  const n = s.nights[s.nights.length - 1];
  return s.phase === "NIGHT" && !!n && !n.resolved;
}

/** Crystal Ball: at each Circle, from the debate until voting closes. */
export function crystalOpen(s: GameState): boolean {
  if (s.phase === "CIRCLE_DEBATE") return true;
  const r = currentRound(s);
  return s.phase === "CIRCLE_VOTE" && !!r && r.kind === "circle" && r.status === "open";
}

export function crystalSize(s: GameState): number {
  return Math.max(1, Math.min(s.settings.traitorCount, s.players.length - 1));
}

/** Live reactions float across the big screen during debates only. */
export function reactionsOpen(s: GameState): boolean {
  return s.phase === "CIRCLE_DEBATE" && !s.paused;
}

/** Why this player can't send a Live reaction now, or null if they can. The reaction route asks this. */
export function reactionRefusal(s: GameState, playerId: string, emoji: string): string | null {
  if (!s.settings.ghostGames.liveReactions) return "Live reactions are switched off.";
  if (!isVisibleGhost(s, playerId) || s.phase === "FINALE") return "Live reactions are for ghosts.";
  if (!reactionsOpen(s)) return "Reactions float up during the debate.";
  if (!(REACTION_EMOJI as readonly string[]).includes(emoji)) return "Pick one of the reactions.";
  return null;
}

/** Each ghost's Bingo card: the moments shuffled with the game's seed, first 9. Stable for the game. */
export function bingoCard(s: GameState, playerId: string): string[] {
  return shuffle(s.settings.bingoMoments, seededRand(s.seed, "bingo", playerId)).slice(0, BINGO_SIDE * BINGO_SIDE);
}

/** A full row, column or diagonal. */
export function hasBingoLine(card: readonly string[], marked: readonly string[]): boolean {
  const n = BINGO_SIDE;
  const on = (r: number, c: number) => marked.includes(card[r * n + c]);
  const idx = Array.from({ length: n }, (_, i) => i);
  return (
    idx.some((r) => idx.every((c) => on(r, c))) ||
    idx.some((c) => idx.every((r) => on(r, c))) ||
    idx.every((i) => on(i, i)) ||
    idx.every((i) => on(i, n - 1 - i))
  );
}

export interface GhostScore {
  playerId: string;
  bets: number;
  traitorCalls: number;
  crystalBall: number;
  bingo: number;
  total: number;
}

/**
 * Every eliminated player's ghost score. Traitor calls and Crystal Ball are scored against the roles,
 * so only the host may see this before the final reveal.
 */
export function ghostScores(s: GameState): GhostScore[] {
  const g = s.ghostGames;
  const pts = s.settings.ghostPoints;
  const ids = new Set<string>(s.players.filter((p) => p.status !== "alive").map((p) => p.id));
  g.bets.forEach((b) => ids.add(b.ghostId));
  g.calls.forEach((c) => ids.add(c.ghostId));
  g.crystal.forEach((c) => ids.add(c.ghostId));
  Object.keys(g.bingo).forEach((id) => ids.add(id));
  const isTraitor = (id: string) => s.roles[id] === "traitor";
  const scores = [...ids]
    .filter((id) => s.players.some((p) => p.id === id))
    .map((playerId) => {
      const bets = g.bets
        .filter((b) => b.ghostId === playerId && b.correct)
        .reduce((sum, b) => sum + (b.kind === "banish" ? pts.banishBet : pts.murderBet), 0);
      const traitorCalls = g.calls.filter((c) => c.ghostId === playerId && (c.call === "traitor") === isTraitor(c.playerId)).length * pts.traitorCall;
      const crystalBall = g.crystal
        .filter((c) => c.ghostId === playerId)
        .reduce((sum, c) => sum + c.pickIds.filter(isTraitor).length * pts.crystalBall, 0);
      const bingo = g.bingoWinnerId === playerId ? pts.bingo : 0;
      return { playerId, bets, traitorCalls, crystalBall, bingo, total: bets + traitorCalls + crystalBall + bingo };
    });
  return scores.sort((a, b) => b.total - a.total || a.playerId.localeCompare(b.playerId, "en", { numeric: true }));
}
