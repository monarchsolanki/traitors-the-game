import { COHOST_ACTIONS } from "./actions";
import { applyGameAction, createGame } from "./engine";
import { banishBetsOpen, bingoCard, crystalOpen, crystalSize, isVisibleGhost, murderBetsOpen } from "./ghosts";
import { checkInvariants } from "./invariants";
import { allViewers, findLeaks } from "./leaks";
import { pickOne, seededRand, shuffle, type Rand } from "./random";
import type { GameSettings } from "./settings";
import type { ActionPayload, Actor, GameState, ItemType, Phase, Team } from "./types";

const HOST: Actor = { kind: "host" };
const SYSTEM: Actor = { kind: "system" };
const asPlayer = (playerId: string): Actor => ({ kind: "player", playerId });

const MISSION_NAMES = ["Dumb Charades", "Mystery Box", "Antakshari", "Ring Toss", "Hidden Diya Hunt", "Buzzer Quiz"];

function sample<T>(items: readonly T[], min: number, max: number, rand: Rand): T[] {
  const n = Math.min(items.length, min + Math.floor(rand() * (max - min + 1)));
  return shuffle(items, rand).slice(0, n);
}

const aliveIds = (s: GameState) => s.players.filter((p) => p.status === "alive").map((p) => p.id);
const currentRound = (s: GameState) => (s.currentRoundId ? s.rounds.find((r) => r.id === s.currentRoundId) ?? null : null);
const lastNight = (s: GameState) => s.nights[s.nights.length - 1] ?? null;

/**
 * A random but legal-looking move for one player, or null if they have nothing to do.
 * Used by the simulator now and by bot seats later. Bots don't persuade, so this proves nothing about balance.
 */
export function botMove(
  s: GameState,
  playerId: string,
  rand: Rand,
  o: { endChance?: number; chatLines?: readonly string[] } = {},
): ActionPayload | null {
  const p = s.players.find((x) => x.id === playerId);
  if (!p || s.phase === "FINALE") return null;
  if (!p.seatClaimed) return { type: "claimSeat" };
  if (s.frozen && !s.roleSeen[playerId] && rand() < 0.5) return { type: "acknowledgeRole" };
  if (s.paused) return null;
  const alive = aliveIds(s);
  const others = alive.filter((id) => id !== playerId);
  const isAlive = p.status === "alive";
  const round = currentRound(s);
  if (round && round.status === "open" && !round.ballots.some((b) => b.voterId === playerId)) {
    if (round.kind === "reward") {
      if (round.eligibleVoterIds.includes(playerId)) {
        const c = round.candidateIds.filter((id) => id !== playerId);
        if (c.length) return { type: "castRewardVote", targetId: pickOne(c, rand) };
      }
    } else if (round.kind === "endgame") {
      if (isAlive && round.eligibleVoterIds.includes(playerId)) {
        return { type: "castEndgameVote", choice: rand() < (o.endChance ?? 0.75) ? "end" : "banish" };
      }
    } else {
      const candidates = round.candidateIds.filter((id) => id !== playerId && alive.includes(id));
      if (candidates.length) {
        if (isAlive && round.eligibleVoterIds.includes(playerId)) {
          const hasDagger = s.items.some((i) => i.holderId === playerId && i.type === "dagger" && i.state === "held");
          return {
            type: "castVote",
            targetId: pickOne(candidates, rand),
            useDagger: round.kind === "circle" && hasDagger && rand() < 0.6,
          };
        }
        if (!isAlive && round.ghostVoterIds.includes(playerId) && !p.ghostVoteUsed && rand() < 0.35) {
          return { type: "castVote", targetId: pickOne(candidates, rand) };
        }
      }
    }
  }
  if (!isAlive && s.frozen && rand() < 0.3) {
    const m = ghostGameMove(s, playerId, alive, rand);
    if (m) return m;
  }
  const night = s.phase === "NIGHT" && lastNight(s) && !lastNight(s)!.resolved ? lastNight(s)! : null;
  if (night && isAlive) {
    if (night.recruit?.targetId === playerId && !night.recruit.answer) return { type: "answerRecruit", accept: rand() < 0.5 };
    if (s.roles[playerId] === "traitor") {
      if (s.settings.traitorChat && rand() < 0.15) {
        const text = o.chatLines?.length ? pickOne(o.chatLines, rand) : `chat-${playerId}-${Math.floor(rand() * 1e9)}`;
        return { type: "sendChat", text };
      }
      if (night.recruit || !others.length) return null;
      if (!night.picks[playerId] || rand() < 0.1) {
        const traitorsAlive = alive.filter((id) => s.roles[id] === "traitor");
        const innocents = others.filter((id) => s.roles[id] === "innocent");
        const recruitable = innocents.filter((id) => !night.refused.some((r) => r.targetId === id));
        const canOffer = night.refused.length < s.settings.recruitOffersPerNight;
        const blackmail = night.blackmail && traitorsAlive.length === 1;
        if (recruitable.length && (blackmail || (s.settings.recruitment === "lastTraitor" && traitorsAlive.length === 1 && canOffer && rand() < 0.4))) {
          return { type: "nightPick", targetId: pickOne(recruitable, rand), mode: "recruit" };
        }
        if (blackmail) return null;
        const pool = s.settings.allowTraitorOnTraitor ? others : innocents;
        if (!pool.length) return null;
        return { type: "nightPick", targetId: pickOne(pool, rand) };
      }
    } else if (s.settings.suspectPoll && !night.suspectAnswers[playerId] && others.length) {
      return { type: "suspectAnswer", targetId: pickOne(others, rand) };
    }
  }
  return null;
}

/** A ghost plays a side game. The engine refuses what isn't allowed (a hidden victim, a Traitor ghost). */
function ghostGameMove(s: GameState, playerId: string, alive: string[], rand: Rand): ActionPayload | null {
  const on = s.settings.ghostGames;
  const g = s.ghostGames;
  const waiting = (kind: "banish" | "murder") => g.bets.some((b) => b.ghostId === playerId && b.kind === kind && !b.settled);
  const roll = rand();
  if (on.bhootBets && roll < 0.4) {
    if (banishBetsOpen(s) && !waiting("banish") && alive.length) return { type: "ghostBet", kind: "banish", targetId: pickOne(alive, rand) };
    if (murderBetsOpen(s) && !waiting("murder") && alive.length) {
      return { type: "ghostBet", kind: "murder", targetId: rand() < 0.2 ? null : pickOne(alive, rand) };
    }
    const out = s.players.filter((x) => x.id !== playerId && x.status !== "alive" && !g.calls.some((c) => c.ghostId === playerId && c.playerId === x.id));
    if (out.length) return { type: "traitorCall", playerId: pickOne(out, rand).id, call: rand() < 0.5 ? "traitor" : "innocent" };
  }
  if (on.crystalBall && roll < 0.7 && crystalOpen(s) && !g.crystal.some((c) => c.ghostId === playerId && c.day === s.day)) {
    const others = s.players.filter((x) => x.id !== playerId).map((x) => x.id);
    return { type: "crystalBall", playerIds: shuffle(others, rand).slice(0, crystalSize(s)) };
  }
  if (on.bhootBingo) {
    const marked = g.bingo[playerId]?.marked ?? [];
    const free = bingoCard(s, playerId).filter((m) => !marked.includes(m));
    if (free.length) return { type: "markBingo", moment: pickOne(free, rand) };
  }
  return null;
}

export function hostProgress(s: GameState, rand: Rand, o: Required<Pick<SimOptions, "missionRate" | "shieldRate">>): ActionPayload[] {
  const alive = aliveIds(s);
  // The host chooses a blackmail night now and then, for a night with a lone Traitor.
  if (s.frozen && s.phase !== "FINALE" && !s.blackmailNext && rand() < 0.02) return [{ type: "setBlackmail", on: true }];
  const missionsToday = s.missions.filter((m) => m.day === s.day).length;
  const startMission = (): ActionPayload => ({
    type: "startMission",
    name: pickOne(MISSION_NAMES, rand),
    kind: rand() < 0.5 ? "team" : "individual",
    winRule: "Fastest wins",
    tieRule: "Sudden death",
  });
  const itemType = (): ItemType => (rand() < o.shieldRate ? "shield" : "dagger");
  const ghosts = s.players.filter((p) => isVisibleGhost(s, p.id)).map((p) => p.id);
  const ghostChallenge = (): ActionPayload[] =>
    ghosts.length && s.day - 1 >= s.settings.ghostMissionFromMorning && rand() < 0.3
      ? [{ type: "startMission", name: pickOne(["Ghost Memory Tray", "Ghost Tower", "Ghost Taste Test"], rand), kind: "ghost" }]
      : [];
  switch (s.phase) {
    case "LOBBY": {
      const toConfirm = s.players.filter((p) => p.seatClaimed && !p.seatConfirmed);
      return toConfirm.length ? toConfirm.map((p) => ({ type: "confirmSeat", playerId: p.id })) : [{ type: "dealRoles" }];
    }
    case "ROLES":
    case "MURDER_REVEAL": {
      if (s.phase === "MURDER_REVEAL" && !lastNight(s)?.revealed) return [{ type: "revealMurder" }];
      return [...ghostChallenge(), ...(rand() < o.missionRate ? [startMission(), { type: "openCircle" } as const] : [{ type: "openCircle" } as const])];
    }
    case "MISSION": {
      const r = currentRound(s);
      if (r && r.kind === "reward" && r.status === "open") return rand() < 0.2 ? [{ type: "lockRewardVote" }] : [];
      const m = s.missions.find((x) => x.id === s.currentMissionId);
      if (m?.kind === "ghost") {
        // The ghosts won (or not): the host gives it as they ask, or they vote; then the Circle.
        const won: ActionPayload[] = rand() < 0.5 ? [] : [rand() < 0.5 ? { type: "openRewardVote", itemType: itemType(), voterIds: ghosts } : { type: "awardItem", itemType: itemType(), playerIds: sample(alive, 1, 1, rand) }];
        return [...won, { type: "openCircle" }];
      }
      const moves: ActionPayload[] = [];
      if (rand() < 0.7) moves.push({ type: "awardItem", itemType: itemType(), playerIds: sample(alive, 1, 3, rand) });
      if (rand() < 0.15) moves.push({ type: "openRewardVote", itemType: itemType(), voterIds: sample(alive, 2, 3, rand) });
      if (rand() < 0.2) moves.push({ type: "setMissionWinners", playerIds: sample(alive, 1, 3, rand) });
      if (rand() < 0.2 && missionsToday < 3) moves.push(startMission());
      moves.push({ type: "openCircle" });
      return moves;
    }
    case "PRIVATE_TALKS":
      return rand() < 0.5 ? [{ type: "openCircle" }] : [];
    case "CIRCLE_DEBATE":
      return [{ type: "openVoting" }];
    case "CIRCLE_VOTE":
    case "CIRCLE_REVEAL":
    case "ENDGAME_VOTE":
    case "ENDGAME_BANISH": {
      const r = currentRound(s);
      if (!r) return s.phase === "CIRCLE_REVEAL" ? [{ type: "startNight" }] : [];
      if (r.status === "open") return rand() < 0.08 ? [{ type: "lockVoting" }] : [];
      if (r.status === "revealing") {
        return rand() < 0.6 && r.revealedCount < r.ballots.length ? [{ type: "revealNextBallot" }] : [{ type: "finishReveal" }];
      }
      if (r.status === "tied" && r.result?.outcome === "tie") {
        const tied = r.result.tiedIds.filter((id) => alive.includes(id));
        if ((r.kind === "circle" || r.kind === "revote") && rand() < 0.1) return [{ type: "noBanishment" }];
        if (r.result.method === "revote") return [{ type: "startRevote" }];
        if (r.result.method === "choose") return [rand() < 0.5 ? { type: "spinTie" } : { type: "startRevote" }];
        if (r.result.method === "spin") return [{ type: "spinTie" }];
        return tied.length ? [{ type: "decideTie", playerId: pickOne(tied, rand) }] : [];
      }
      return [];
    }
    case "NIGHT":
      return rand() < 0.03 ? [{ type: "resolveNight" }] : [];
    case "FINALE":
      return s.finale?.revealed ? [] : [{ type: "revealFinale" }];
    default:
      return [];
  }
}

function chaosMove(s: GameState, rand: Rand): ActionPayload | null {
  if (!s.frozen || s.phase === "FINALE") return null;
  const alive = aliveIds(s);
  const ghosts = s.players.filter((p) => p.status !== "alive").map((p) => p.id);
  const held = s.items.filter((i) => i.state === "held");
  const round = currentRound(s);
  const reason = "chaos test";
  const roll = rand();
  if (roll < 0.15) return s.paused ? { type: "resume" } : { type: "pause" };
  if (roll < 0.25) return { type: "adjustTimer", deltaSeconds: rand() < 0.5 ? 60 : -60 };
  if (roll < 0.35 && alive.length) {
    return { type: "giveItem", itemType: rand() < 0.5 ? "shield" : "dagger", playerId: pickOne(alive, rand), reason };
  }
  if (roll < 0.42 && held.length) return { type: "removeItem", itemId: pickOne(held, rand).id, reason };
  if (roll < 0.49 && held.length && alive.length) {
    return { type: "moveItem", itemId: pickOne(held, rand).id, toPlayerId: pickOne(alive, rand), reason };
  }
  if (roll < 0.6 && round && round.kind !== "reward" && round.eligibleVoterIds.length) {
    const voter = pickOne(round.eligibleVoterIds, rand);
    if (round.kind === "endgame") return { type: "setBallot", voterId: voter, choice: rand() < 0.5 ? "end" : "banish", reason };
    const targets = round.candidateIds.filter((id) => id !== voter);
    return targets.length ? { type: "setBallot", voterId: voter, targetId: pickOne(targets, rand), reason } : null;
  }
  if (roll < 0.64 && round && round.kind !== "reward") return { type: "rerunVote", reason };
  if (roll < 0.7 && alive.length > 3) {
    const status = pickOne(["murdered", "banished", "left"] as const, rand);
    return { type: "eliminatePlayer", playerId: pickOne(alive, rand), status, reason };
  }
  if (roll < 0.74 && ghosts.length) return { type: "revivePlayer", playerId: pickOne(ghosts, rand), reason };
  if (roll < 0.78 && alive.length) {
    const id = pickOne(alive, rand);
    return { type: "setRole", playerId: id, role: s.roles[id] === "traitor" ? "innocent" : "traitor", reason };
  }
  if (roll < 0.785) return { type: "endGameEarly", reason };
  if (roll < 0.8) return { type: "setScreenMessage", text: rand() < 0.3 ? null : `Message ${Math.floor(rand() * 1000)}` };
  if (roll < 0.81 && s.missionCatalogue.length) return { type: "deleteMissionTemplate", templateId: pickOne(s.missionCatalogue, rand).id };
  if (roll < 0.9) return { type: "updateSettings", patch: { voteSeconds: 30 + Math.floor(rand() * 200) } };
  return null;
}

export interface SimOptions {
  players: number;
  seed: string;
  settings?: Partial<GameSettings>;
  /** Chance the host runs a mission at each choice point. */
  missionRate?: number;
  /** Chance an award is a shield rather than a dagger. */
  shieldRate?: number;
  /** Chance per step of a random host override, pause or timer change. */
  chaos?: number;
  /** Check every viewer's view every N steps (the big screen and one player are checked every step). */
  fullLeakCheckEvery?: number;
  maxSteps?: number;
}

export interface SimResult {
  steps: number;
  days: number;
  winner: Team;
  early: boolean;
  reason: string;
  phases: Phase[];
  rejected: number;
}

export class SimFailure extends Error {
  state: GameState;
  history: string[];
  constructor(message: string, state: GameState, history: string[]) {
    super(`${message}\nLast actions:\n${history.slice(-25).join("\n")}`);
    this.state = state;
    this.history = history;
  }
}

/** Plays one random game to the end, checking invariants and privacy after every action. */
export function simulate(opts: SimOptions): SimResult {
  const rand = seededRand("sim", opts.seed);
  const o = {
    missionRate: opts.missionRate ?? 0.6,
    shieldRate: opts.shieldRate ?? 0.5,
    chaos: opts.chaos ?? 0.03,
    fullLeakCheckEvery: opts.fullLeakCheckEvery ?? 50,
    maxSteps: opts.maxSteps ?? 20_000,
  };
  const roster = Array.from({ length: opts.players }, (_, i) => ({ name: `Bot ${i + 1}`, displayName: `B${i + 1}` }));
  let now = 1_800_000_000_000;
  let s = createGame({ code: "SIMBOT", seed: `game-${opts.seed}`, at: now, roster, settings: opts.settings });
  // Half the games have a co-host, who sends some of the mission and big-screen moves.
  const cohostId = rand() < 0.5 ? pickOne(s.players, rand).id : null;
  const history: string[] = [];
  const phases = new Set<Phase>();
  let rejected = 0;

  const apply = (actor: Actor, payload: ActionPayload): boolean => {
    const r = applyGameAction(s, { ...payload, actor, at: now } as never);
    if (!r.ok) {
      rejected++;
      return false;
    }
    const problems = checkInvariants(r.nextState, s);
    history.push(`${r.nextState.version} ${r.nextState.phase} d${r.nextState.day} ${actor.kind}${actor.kind === "player" ? `:${actor.playerId}` : ""} ${payload.type}`);
    s = r.nextState;
    phases.add(s.phase);
    const viewers = s.version % o.fullLeakCheckEvery === 0
      ? allViewers(s)
      : [{ kind: "screen" as const }, { kind: "player" as const, playerId: pickOne(s.players, rand).id }];
    for (const v of viewers) problems.push(...findLeaks(s, v));
    if (problems.length) throw new SimFailure(`Invariant or privacy failure: ${problems.join("; ")}`, s, history);
    return true;
  };

  for (let step = 0; step < o.maxSteps; step++) {
    if (s.phase === "FINALE") break;
    now += 2000 + Math.floor(rand() * 38_000);
    if (s.paused && rand() < 0.5) apply(HOST, { type: "resume" });
    if (rand() < o.chaos) {
      const m = chaosMove(s, rand);
      if (m) apply(HOST, m);
      if ((s.phase as Phase) === "FINALE") break;
    }
    const moves: Array<{ actor: Actor; payload: ActionPayload }> = [];
    for (const p of s.players) {
      const m = botMove(s, p.id, rand);
      if (m) moves.push({ actor: asPlayer(p.id), payload: m });
    }
    if (cohostId && s.cohostId !== cohostId && s.players.some((p) => p.id === cohostId)) {
      moves.push({ actor: HOST, payload: { type: "setCohost", playerId: cohostId } });
    }
    for (const m of hostProgress(s, rand, o)) {
      const byCohost = s.cohostId && COHOST_ACTIONS.has(m.type) && rand() < 0.5;
      moves.push({ actor: byCohost ? { kind: "cohost", playerId: s.cohostId! } : HOST, payload: m });
    }
    let moved = false;
    for (const m of shuffle(moves, rand)) {
      if (apply(m.actor, m.payload)) {
        moved = true;
        break;
      }
    }
    if (moved) continue;
    if (s.paused) {
      apply(HOST, { type: "resume" });
      continue;
    }
    if (s.deadline !== null) {
      now = Math.max(now, s.deadline);
      if (apply(SYSTEM, { type: "tick" })) continue;
    }
    // Nothing moved and no timer to wait for: give the host the forcing moves a real host has.
    const forcing: ActionPayload[] = [
      { type: "lockVoting" },
      { type: "lockRewardVote" },
      { type: "resolveNight" },
      { type: "finishReveal" },
      { type: "startNight" },
      { type: "rerunVote", reason: "Recovering a stuck tie" },
    ];
    if (forcing.some((f) => apply(HOST, f))) continue;
    throw new SimFailure(`Stuck in ${s.phase}: no player or host move works`, s, history);
  }
  if (s.phase !== "FINALE" || !s.finale) throw new SimFailure(`Did not finish within ${o.maxSteps} steps`, s, history);
  for (let pass = 0; pass < 2; pass++) {
    for (const v of allViewers(s)) {
      const leaks = findLeaks(s, v);
      if (leaks.length) throw new SimFailure(`Privacy failure at the finale: ${leaks.join("; ")}`, s, history);
    }
    if (pass === 0 && !apply(HOST, { type: "revealFinale" })) throw new SimFailure("Couldn't reveal the result", s, history);
  }
  return {
    steps: s.version,
    days: s.day,
    winner: s.finale.winner,
    early: s.finale.early,
    reason: s.finale.reason,
    phases: [...phases],
    rejected,
  };
}
