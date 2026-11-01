import {
  banishBetsOpen,
  bingoCard,
  crystalOpen,
  crystalSize,
  ghostScores,
  hasBingoLine,
  isVisibleGhost,
  murderBetsOpen,
  pendingVictimId,
  reactionsOpen,
  type GhostScore,
} from "./ghosts";
import { REACTION_EMOJI, resolveEndGameThreshold, type GameSettings, type MissionTemplate } from "./settings";
import type {
  ChatMessage,
  EndgameChoice,
  GameState,
  ItemState,
  ItemType,
  Mission,
  MissionKind,
  Phase,
  PlayerStatus,
  Role,
  RoundResult,
  RoundStatus,
  Team,
  Viewer,
  VoteKind,
  VoteRound,
} from "./types";

export interface PlayerView {
  id: string;
  name: string;
  displayName: string;
  photoPath: string | null;
  seat: number;
  seatClaimed: boolean;
  seatConfirmed: boolean;
  status: PlayerStatus;
  eliminatedDay: number | null;
  /** Only when this viewer may know it: the host, the final reveal, or role reveal on elimination. */
  role: Role | null;
}

export interface BallotView {
  voterId: string;
  targetId: string | null;
  choice: EndgameChoice | null;
  weight: number;
  usedDagger: boolean;
  ghost: boolean;
}

export interface RoundView {
  id: string;
  kind: VoteKind;
  day: number;
  status: RoundStatus;
  candidateIds: string[];
  eligibleCount: number;
  /** Living ballots in so far, while voting is open. */
  submittedCount: number | null;
  /** All ballots, once voting is locked. */
  ballotCount: number | null;
  revealedCount: number;
  /** Revealed ballots only, in reveal order. */
  ballots: BallotView[];
  totals: Record<string, number> | null;
  result: RoundResult | null;
}

export interface MissionView {
  id: string;
  day: number;
  order: number;
  name: string;
  kind: MissionKind;
  howItWorks: string;
  winRule: string;
  tieRule: string;
  status: "active" | "done";
}

export interface NightView {
  id: string;
  day: number;
  status: "active" | "over";
  revealed: boolean;
  /** Only after the murder reveal; null means nobody died. Never says why. */
  victimId: string | null;
}

export interface EventView {
  id: string;
  at: number;
  day: number;
  type: string;
  data: Record<string, unknown>;
}

export interface FinaleView {
  winner: Team;
  winnerIds: string[];
  reason: string;
  early: boolean;
  suspicion: Record<string, number>;
  /** Best Ghost: every eliminated player's ghost-game score. */
  ghostScores: GhostScore[];
}

export interface PublicView {
  viewer: Viewer["kind"];
  code: string;
  version: number;
  phase: Phase;
  day: number;
  paused: boolean;
  deadline: number | null;
  pausedRemainingMs: number | null;
  closed: boolean;
  settings: GameSettings;
  startingPlayerCount: number | null;
  endGameThreshold: number;
  endgameStarted: boolean;
  players: PlayerView[];
  missions: MissionView[];
  currentMissionId: string | null;
  round: RoundView | null;
  pastRounds: RoundView[];
  night: NightView | null;
  events: EventView[];
  finale: FinaleView | null;
  /** The game is decided but the host hasn't revealed the result yet. */
  finalePending: boolean;
  /** A message the host or co-host put on the big screen. */
  screenMessage: { text: string; at: number } | null;
}

export interface MeView {
  playerId: string;
  role: Role | null;
  roleSeen: boolean;
  status: PlayerStatus;
  isGhost: boolean;
  items: Array<{ id: string; type: ItemType; state: ItemState }>;
  vote: {
    roundId: string;
    kind: VoteKind;
    canVote: boolean;
    asGhost: boolean;
    submitted: boolean;
    myBallot: { targetId: string | null; choice: EndgameChoice | null; usedDagger: boolean } | null;
    canUseDagger: boolean;
  } | null;
  ghostVote: { enabled: boolean; used: boolean };
  suspectPoll: { myAnswer: string | null } | null;
  recruitOffer: { deadline: number; blackmail: boolean } | null;
  rewardVote: {
    roundId: string;
    itemType: ItemType;
    candidateIds: string[];
    submitted: boolean;
    myTargetId: string | null;
  } | null;
  /** The host made this player co-host (they open /cohost/CODE for the controls). */
  isCohost: boolean;
  /** Ghost games, only for a ghost everyone can already see is out. */
  ghostGames: GhostGamesView | null;
}

export interface GhostGamesView {
  bets: {
    banishOpen: boolean;
    murderOpen: boolean;
    /** This ghost's bet waiting to settle, per kind (pick null = nobody dies). */
    banish: { pick: string | null } | null;
    murder: { pick: string | null } | null;
    /** Settled bets on public results (banishments and murders), newest first. */
    history: Array<{ kind: "banish" | "murder"; pick: string | null; correct: boolean; day: number }>;
    /** "Was this eliminated player a Traitor?" Settles at the final reveal. Null for eliminated Traitors. */
    calls: Array<{ playerId: string; myCall: Role | null }> | null;
  } | null;
  crystalBall: { open: boolean; size: number; myPicks: string[] | null; locked: number } | null;
  bingo: { card: string[]; marked: string[]; hasLine: boolean; winnerId: string | null } | null;
  reactions: { open: boolean; emoji: string[] } | null;
}

export interface CohostView {
  catalogue: MissionTemplate[];
  missions: Array<MissionView & { winnerIds: string[] }>;
  /** The winners' private vote, without who voted for whom. */
  rewardVote: { itemType: ItemType; voterIds: string[]; votedIds: string[] } | null;
}

export interface TraitorView {
  fellowTraitorIds: string[];
  chat: ChatMessage[] | null;
  night: {
    nightId: string;
    myPickId: string | null;
    pickStatus: Record<string, boolean>;
    /** Recruitment is on, this is the last Traitor, and offers are left tonight. */
    recruitmentAvailable: boolean;
    offersLeft: number;
    /** A blackmail night: this lone Traitor can only send an offer. */
    blackmail: boolean;
    mode: "murder" | "recruit" | null;
    offer: { targetId: string; deadline: number; answer: string | null } | null;
  } | null;
  /** Offers this Traitor saw refused tonight (oldest first), or, at breakfast, last night's accepted or blackmail offer. */
  offerAnswers: Array<{ playerId: string; answer: "accepted" | "refused" | "timeout" }>;
}

export type HostSecrets = Omit<GameState, "seed">;

export interface GameView extends PublicView {
  me?: MeView;
  traitor?: TraitorView;
  host?: HostSecrets;
  cohost?: CohostView;
}

/** The only way game state leaves the server (section 9.4). */
export function viewFor(s: GameState, viewer: Viewer): GameView {
  switch (viewer.kind) {
    case "host": {
      const { seed: _seed, ...secrets } = structuredClone(s);
      void _seed;
      return { ...buildPublic(s, "host", { mask: false, allRoles: true, events: () => true }), host: secrets };
    }
    case "cohost":
      return { ...buildPublic(s, "cohost", { mask: true, allRoles: false, events: (a) => a.kind === "public" }), cohost: cohostView(s) };
    case "screen":
      return buildPublic(s, "screen", { mask: true, allRoles: false, events: (a) => a.kind === "public" });
    case "player":
      return playerView(s, viewer.playerId);
  }
}

function cohostView(s: GameState): CohostView {
  const r = s.currentRoundId ? s.rounds.find((x) => x.id === s.currentRoundId) : null;
  return {
    catalogue: structuredClone(s.missionCatalogue),
    missions: s.missions.map((m) => ({ ...missionView(m), winnerIds: [...m.winnerIds] })),
    rewardVote:
      r && r.kind === "reward" && r.status === "open"
        ? { itemType: r.itemType!, voterIds: [...r.eligibleVoterIds], votedIds: r.ballots.map((b) => b.voterId) }
        : null,
  };
}

function missionView(m: Mission): MissionView {
  return { id: m.id, day: m.day, order: m.order, name: m.name, kind: m.kind, howItWorks: m.howItWorks, winRule: m.winRule, tieRule: m.tieRule, status: m.status };
}

function maskedStatus(s: GameState, playerId: string, mask: boolean): PlayerStatus {
  const p = s.players.find((x) => x.id === playerId)!;
  return mask && pendingVictimId(s) === playerId ? "alive" : p.status;
}

type EventFilter = (a: GameState["events"][number]["audience"]) => boolean;

function buildPublic(
  s: GameState,
  viewer: Viewer["kind"],
  o: { mask: boolean; allRoles: boolean; events: EventFilter },
): PublicView {
  const finale = s.phase === "FINALE" && !!s.finale?.revealed;
  const victim = o.mask ? pendingVictimId(s) : null;
  const players: PlayerView[] = s.players.map((p) => {
    const status = p.id === victim ? "alive" : p.status;
    const knowsRole = o.allRoles || finale || (s.settings.revealOnElimination && status !== "alive" && !!s.frozen);
    return {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      photoPath: p.photoPath,
      seat: p.seat,
      seatClaimed: p.seatClaimed,
      seatConfirmed: p.seatConfirmed,
      status,
      eliminatedDay: p.id === victim ? null : p.eliminatedDay,
      role: knowsRole ? s.roles[p.id] ?? null : null,
    };
  });
  const current = s.currentRoundId ? s.rounds.find((r) => r.id === s.currentRoundId) ?? null : null;
  const night = s.nights[s.nights.length - 1];
  return {
    viewer,
    code: s.code,
    version: s.version,
    phase: s.phase,
    day: s.day,
    paused: s.paused,
    deadline: s.deadline,
    pausedRemainingMs: s.pausedRemainingMs,
    closed: s.closed,
    settings: structuredClone(s.settings),
    startingPlayerCount: s.frozen?.startingPlayerCount ?? null,
    endGameThreshold: resolveEndGameThreshold(s.settings, s.frozen?.startingPlayerCount ?? s.players.length),
    endgameStarted: s.endgameStarted,
    players,
    missions: s.missions.map(missionView),
    currentMissionId: s.currentMissionId,
    round: current && current.kind !== "reward" ? roundView(current) : null,
    pastRounds: s.rounds.filter((r) => r.kind !== "reward" && r.status === "done" && r.id !== current?.id).map(roundView),
    night: night
      ? {
          id: night.id,
          day: night.day,
          status: s.phase === "NIGHT" && !night.resolved ? "active" : "over",
          revealed: night.revealed,
          victimId: night.revealed ? night.victimId : null,
        }
      : null,
    events: s.events
      .filter((e) => o.events(e.audience))
      .map((e) => ({ id: e.id, at: e.at, day: e.day, type: e.type, data: structuredClone(e.data) })),
    finalePending: s.phase === "FINALE" && !s.finale?.revealed,
    finale:
      s.finale && (s.finale.revealed || o.allRoles)
      ? {
          winner: s.finale.winner,
          winnerIds: [...s.finale.winnerIds],
          reason: s.finale.reason,
          early: s.finale.early,
          suspicion: { ...s.finale.suspicion },
          ghostScores: ghostScores(s),
        }
      : null,
    screenMessage: s.screenMessage ? { ...s.screenMessage } : null,
  };
}

function roundView(r: VoteRound): RoundView {
  const order = r.status === "revealing" ? r.revealOrder.slice(0, r.revealedCount) : r.status === "open" ? [] : r.revealOrder;
  const ballots = order
    .map((voterId) => r.ballots.find((b) => b.voterId === voterId))
    .filter((b): b is VoteRound["ballots"][number] => !!b)
    .map((b) => ({
      voterId: b.voterId,
      targetId: b.targetId,
      choice: b.choice,
      weight: b.weight,
      usedDagger: b.usedDagger,
      ghost: b.ghost,
    }));
  const settled = r.status === "tied" || r.status === "done";
  return {
    id: r.id,
    kind: r.kind,
    day: r.day,
    status: r.status,
    candidateIds: [...r.candidateIds],
    eligibleCount: r.eligibleVoterIds.length,
    submittedCount: r.status === "open" ? r.ballots.filter((b) => !b.ghost).length : null,
    ballotCount: r.status === "open" ? null : r.ballots.length,
    revealedCount: settled ? r.ballots.length : r.status === "revealing" ? r.revealedCount : 0,
    ballots,
    totals: settled && r.totals ? { ...r.totals } : null,
    result: settled && r.result ? structuredClone(r.result) : null,
  };
}

function playerView(s: GameState, playerId: string): GameView {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) throw new Error("That player isn't in this game.");
  const status = maskedStatus(s, p.id, true);
  const alive = status === "alive";
  const role = s.frozen ? s.roles[p.id] ?? null : null;
  const isTraitor = alive && role === "traitor";
  const pub = buildPublic(s, "player", {
    mask: true,
    allRoles: false,
    events: (a) =>
      a.kind === "public" || (a.kind === "player" && a.playerId === p.id) || (a.kind === "traitors" && isTraitor),
  });
  const victimNight = pendingVictimId(s) === p.id ? s.nights[s.nights.length - 1] : null;
  const items = s.items
    .filter((i) => i.holderId === p.id)
    .map((i) => ({
      id: i.id,
      type: i.type,
      state: (victimNight && i.lostNightId === victimNight.id ? "held" : i.state) as ItemState,
    }));
  const round = s.currentRoundId ? s.rounds.find((r) => r.id === s.currentRoundId) ?? null : null;
  let vote: MeView["vote"] = null;
  let rewardVote: MeView["rewardVote"] = null;
  if (round && round.kind === "reward") {
    if (round.eligibleVoterIds.includes(p.id)) {
      const mine = round.ballots.find((b) => b.voterId === p.id);
      rewardVote = {
        roundId: round.id,
        itemType: round.itemType!,
        candidateIds: round.status === "open" ? [...round.candidateIds] : [],
        submitted: !!mine,
        myTargetId: mine?.targetId ?? null,
      };
    }
  } else if (round) {
    const mine = round.ballots.find((b) => b.voterId === p.id);
    const asGhost =
      !alive && round.kind !== "endgame" && s.settings.ghostVote && round.ghostVoterIds.includes(p.id) && !p.ghostVoteUsed;
    const canVote = round.status === "open" && !mine && !s.paused && (alive ? round.eligibleVoterIds.includes(p.id) : asGhost);
    vote = {
      roundId: round.id,
      kind: round.kind,
      canVote,
      asGhost: !alive && (asGhost || !!mine?.ghost),
      submitted: !!mine,
      myBallot: mine ? { targetId: mine.targetId, choice: mine.choice, usedDagger: mine.usedDagger } : null,
      canUseDagger:
        canVote && alive && round.kind === "circle" && s.items.some((i) => i.holderId === p.id && i.type === "dagger" && i.state === "held"),
    };
  }
  const night = s.nights[s.nights.length - 1];
  const nightActive = s.phase === "NIGHT" && night && !night.resolved;
  const me: MeView = {
    playerId: p.id,
    role,
    roleSeen: !!s.roleSeen[p.id],
    status,
    isGhost: !!s.frozen && !alive,
    items,
    vote,
    ghostVote: { enabled: s.settings.ghostVote, used: p.ghostVoteUsed },
    suspectPoll:
      nightActive && alive && role === "innocent" && s.settings.suspectPoll
        ? { myAnswer: night.suspectAnswers[p.id] ?? null }
        : null,
    recruitOffer:
      nightActive && night.recruit && night.recruit.targetId === p.id && !night.recruit.answer
        ? { deadline: night.recruit.deadline, blackmail: night.blackmail }
        : null,
    rewardVote,
    isCohost: s.cohostId === p.id,
    ghostGames: ghostGamesView(s, p.id),
  };
  const view: GameView = { ...pub, me };
  if (isTraitor) {
    const aliveTraitors = s.players.filter((x) => s.roles[x.id] === "traitor" && maskedStatus(s, x.id, false) === "alive");
    const offersLeft = night ? Math.max(0, s.settings.recruitOffersPerNight - night.refused.length) : 0;
    const recruitmentAvailable = s.settings.recruitment === "lastTraitor" && aliveTraitors.length === 1 && offersLeft > 0;
    const offerAnswers: TraitorView["offerAnswers"] = [];
    if (nightActive) {
      for (const r of night.refused) if (r.traitorId === p.id) offerAnswers.push({ playerId: r.targetId, answer: r.answer });
    } else if (s.phase === "MURDER_REVEAL" && night?.resolved && night.recruit?.traitorId === p.id && night.recruit.answer) {
      if (night.recruit.answer === "accepted" || night.blackmail) offerAnswers.push({ playerId: night.recruit.targetId, answer: night.recruit.answer });
    }
    view.traitor = {
      fellowTraitorIds: s.players.filter((x) => x.id !== p.id && s.roles[x.id] === "traitor").map((x) => x.id),
      chat: s.settings.traitorChat ? s.chat.map((c) => ({ ...c })) : null,
      night: nightActive
        ? {
            nightId: night.id,
            myPickId: night.picks[p.id] ?? null,
            pickStatus: Object.fromEntries(aliveTraitors.map((t) => [t.id, !!night.picks[t.id]])),
            recruitmentAvailable,
            offersLeft,
            blackmail: night.blackmail && aliveTraitors.length === 1,
            mode: night.mode,
            offer:
              night.recruit && night.recruit.traitorId === p.id
                ? { targetId: night.recruit.targetId, deadline: night.recruit.deadline, answer: night.recruit.answer }
                : null,
          }
        : null,
      offerAnswers,
    };
  }
  return view;
}

function ghostGamesView(s: GameState, playerId: string): GhostGamesView | null {
  const on = s.settings.ghostGames;
  if (s.phase === "FINALE" || !isVisibleGhost(s, playerId) || !Object.values(on).some(Boolean)) return null;
  const g = s.ghostGames;
  const traitorGhost = s.roles[playerId] === "traitor";
  const mine = g.bets.filter((b) => b.ghostId === playerId);
  const waiting = (kind: "banish" | "murder") => {
    const b = mine.find((x) => x.kind === kind && !x.settled);
    return b ? { pick: b.pick } : null;
  };
  const eliminated = s.players.filter((p) => p.id !== playerId && p.status !== "alive" && p.id !== pendingVictimId(s));
  const crystalToday = g.crystal.find((c) => c.ghostId === playerId && c.day === s.day);
  const card = on.bhootBingo ? bingoCard(s, playerId) : [];
  const marked = (g.bingo[playerId]?.marked ?? []).filter((m) => card.includes(m));
  return {
    bets: on.bhootBets
      ? {
          banishOpen: banishBetsOpen(s),
          murderOpen: murderBetsOpen(s),
          banish: waiting("banish"),
          murder: waiting("murder"),
          history: mine
            .filter((b) => b.settled && b.correct !== null)
            .reverse()
            .map((b) => ({ kind: b.kind, pick: b.pick, correct: !!b.correct, day: b.day })),
          calls:
            traitorGhost || s.settings.revealOnElimination
              ? null
              : eliminated.map((p) => ({ playerId: p.id, myCall: g.calls.find((c) => c.ghostId === playerId && c.playerId === p.id)?.call ?? null })),
        }
      : null,
    crystalBall:
      on.crystalBall && !traitorGhost
        ? {
            open: crystalOpen(s),
            size: crystalSize(s),
            myPicks: crystalToday ? [...crystalToday.pickIds] : null,
            locked: g.crystal.filter((c) => c.ghostId === playerId).length,
          }
        : null,
    bingo: on.bhootBingo
      ? { card, marked, hasLine: g.bingo[playerId]?.lineAt != null || hasBingoLine(card, marked), winnerId: g.bingoWinnerId }
      : null,
    reactions: on.liveReactions ? { open: reactionsOpen(s), emoji: [...REACTION_EMOJI] } : null,
  };
}
