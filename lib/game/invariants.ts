import { resolveEndGameThreshold } from "./settings";
import { PHASES, type GameState } from "./types";

/** Checks that a state is possible under section 5. Returns a list of problems; empty means fine. */
export function checkInvariants(s: GameState, prev: GameState | null = null): string[] {
  const out: string[] = [];
  const bad = (m: string) => out.push(m);
  const alive = s.players.filter((p) => p.status === "alive");
  const aliveTraitors = alive.filter((p) => s.roles[p.id] === "traitor");
  const round = s.currentRoundId ? s.rounds.find((r) => r.id === s.currentRoundId) : null;
  const night = s.nights[s.nights.length - 1];

  if (!PHASES.includes(s.phase)) bad(`unknown phase ${s.phase}`);
  if (prev) {
    if (s.version !== prev.version + 1) bad("version didn't go up by one");
    if (s.day < prev.day) bad("day went backwards");
    if (prev.phase === "FINALE" && s.phase !== "FINALE") bad("left the finale");
    if (prev.endgameStarted && !s.endgameStarted) bad("End Game un-started");
  }
  if (s.currentRoundId && !round) bad("current round missing");
  if (round && round.status === "done") bad("current round already done");
  if (s.paused && s.deadline !== null) bad("paused with a running deadline");

  if (s.frozen) {
    for (const p of s.players) if (!s.roles[p.id]) bad(`${p.id} has no role`);
    if (s.day < 1) bad("dealt but day < 1");
    const t = s.settings.endGameThreshold;
    if (typeof t !== "number") bad("threshold not resolved at dealing");
    else if (t !== resolveEndGameThreshold(s.settings, s.frozen.startingPlayerCount)) bad("threshold mismatch");
  } else if (s.phase !== "LOBBY") bad("left the lobby without dealing");

  // Items (section 5.6)
  for (const p of s.players) {
    for (const type of ["shield", "dagger"] as const) {
      const held = s.items.filter((i) => i.holderId === p.id && i.type === type && i.state === "held");
      if (held.length > 1) bad(`${p.id} holds ${held.length} ${type}s`);
      if (held.length && p.status !== "alive") bad(`ghost ${p.id} still holds a ${type}`);
    }
  }
  if (night?.resolved && s.items.some((i) => i.type === "shield" && i.state === "held" && i.awardedDay <= night.day)) {
    bad("a shield survived the night");
  }
  for (const i of s.items) if (!["held", "used", "expired", "lost"].includes(i.state)) bad(`bad item state ${i.state}`);

  // Ballots (section 5.5)
  const ghostBallots = new Map<string, number>();
  for (const r of s.rounds) {
    const voters = r.ballots.map((b) => b.voterId);
    if (new Set(voters).size !== voters.length) bad(`round ${r.id} has two ballots from one voter`);
    for (const b of r.ballots) {
      if (b.targetId && b.targetId === b.voterId) bad("someone voted for themselves");
      if (b.usedDagger && b.weight !== 2 && b.weight !== 3) bad("dagger ballot with a wrong weight");
      if (b.usedDagger && r.kind !== "circle") bad(`dagger used in a ${r.kind}`);
      if (b.ghost && (r.kind === "endgame" || r.kind === "reward")) bad(`ghost vote in a ${r.kind}`);
      if (!b.usedDagger && b.weight !== 1) bad("plain ballot weighs more than 1");
      if (b.ghost) ghostBallots.set(b.voterId, (ghostBallots.get(b.voterId) ?? 0) + 1);
    }
  }
  for (const [id, n] of ghostBallots) {
    if (n > 1) bad(`${id} cast ${n} ghost votes`);
    if (!s.players.find((p) => p.id === id)?.ghostVoteUsed) bad(`${id} has a ghost ballot but no ghost vote used`);
  }

  // Phase consistency (section 5.1)
  const kindIs = (...k: string[]) => round && k.includes(round.kind);
  switch (s.phase) {
    case "CIRCLE_VOTE":
      if (!round || round.status !== "open" || !kindIs("circle", "revote")) bad("CIRCLE_VOTE without an open Circle round");
      break;
    case "CIRCLE_REVEAL":
      // With no round left, the result is in and the screens hold it until the host starts the night.
      if (round ? !["revealing", "tied"].includes(round.status) || !kindIs("circle", "revote") : !s.rounds.some((r) => (r.kind === "circle" || r.kind === "revote") && r.status === "done" && r.day === s.day)) {
        bad("CIRCLE_REVEAL without a round to reveal or a result to show");
      }
      break;
    case "ENDGAME_VOTE":
      if (!round || !kindIs("endgame")) bad("ENDGAME_VOTE without an End Game round");
      break;
    case "ENDGAME_BANISH":
      if (!round || !kindIs("endgameBanish", "endgameRevote")) bad("ENDGAME_BANISH without a banishment round");
      break;
    case "NIGHT":
      if (!night || night.resolved) bad("NIGHT without an open night");
      if (round) bad("a vote round open at night");
      break;
    case "MURDER_REVEAL":
      if (!night || !night.resolved) bad("breakfast before the night ended");
      break;
    case "MISSION":
      if (!s.currentMissionId) bad("MISSION without a mission");
      break;
    case "PRIVATE_TALKS":
      if (round) bad("a vote round open during private talks");
      if (s.currentMissionId) bad("a mission still open during private talks");
      break;
  }
  if (s.endgameStarted && !["ENDGAME_VOTE", "ENDGAME_BANISH", "FINALE"].includes(s.phase)) {
    bad(`back to ${s.phase} after the End Game started`);
  }

  // Ghost games, co-host and catalogue (Step 5)
  const ids = new Set(s.players.map((p) => p.id));
  const g = s.ghostGames;
  const openBets = new Set<string>();
  for (const b of g.bets) {
    if (!ids.has(b.ghostId) || (b.pick !== null && !ids.has(b.pick))) bad(`bet ${b.id} names someone not in the game`);
    if (b.correct !== null && !b.settled) bad(`bet ${b.id} has a result but isn't settled`);
    if (!b.settled) {
      const k = `${b.ghostId}:${b.kind}`;
      if (openBets.has(k)) bad(`${b.ghostId} has two open ${b.kind} bets`);
      openBets.add(k);
    }
  }
  const calls = new Set<string>();
  for (const c of g.calls) {
    const k = `${c.ghostId}:${c.playerId}`;
    if (calls.has(k) || c.ghostId === c.playerId) bad(`bad Traitor call ${k}`);
    calls.add(k);
  }
  const guesses = new Set<string>();
  for (const c of g.crystal) {
    const k = `${c.ghostId}:${c.day}`;
    if (guesses.has(k) || new Set(c.pickIds).size !== c.pickIds.length || c.pickIds.includes(c.ghostId)) bad(`bad Crystal Ball guess ${k}`);
    guesses.add(k);
  }
  if (g.bingoWinnerId && g.bingo[g.bingoWinnerId]?.lineAt == null) bad("Bingo winner without a line");
  if (s.cohostId && !ids.has(s.cohostId)) bad("co-host isn't in the game");
  const names = s.missionCatalogue.map((t) => t.name.toLowerCase());
  if (new Set(names).size !== names.length || new Set(s.missionCatalogue.map((t) => t.id)).size !== names.length) {
    bad("duplicate mission in the catalogue");
  }

  // End conditions (sections 5.2, 5.3)
  if (s.phase === "FINALE") {
    if (!s.finale) bad("FINALE without a result");
    else {
      const expected = aliveTraitors.length > 0 ? "traitors" : "innocents";
      if (s.finale.winner !== expected) bad(`winner ${s.finale.winner}, expected ${expected}`);
      const lastEnd = [...s.rounds].reverse().find((r) => r.kind === "endgame");
      const legit =
        s.finale.early ||
        aliveTraitors.length === 0 ||
        alive.length <= 2 ||
        (s.settings.endCondition === "parity" && aliveTraitors.length >= alive.length - aliveTraitors.length) ||
        lastEnd?.result?.outcome === "end";
      if (!legit) bad("finale reached without an end condition");
    }
  } else if (s.frozen) {
    if (aliveTraitors.length === 0) bad("no Traitors alive but the game goes on");
    const unrevealedMurder = s.phase === "MURDER_REVEAL" && night && !night.revealed;
    if (alive.length <= 2 && !unrevealedMurder) bad("2 or fewer alive but the game goes on");
    if (s.settings.endCondition === "parity" && aliveTraitors.length >= alive.length - aliveTraitors.length && !unrevealedMurder) {
      bad("the Traitors equal the Innocents but the game goes on");
    }
    if (s.settings.endCondition === "parity" && (s.endgameStarted || s.phase === "ENDGAME_VOTE" || s.phase === "ENDGAME_BANISH")) {
      bad("an End Game vote under the Mafia rule");
    }
  }
  return out;
}
