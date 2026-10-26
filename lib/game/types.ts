import type { GameSettings, SettingKey } from "./settings";

/** Phases from section 5.1. A pause is a flag on the game, not a phase. */
export const PHASES = [
  "LOBBY",
  "ROLES",
  "MISSION",
  "CIRCLE_DEBATE",
  "CIRCLE_VOTE",
  "CIRCLE_REVEAL",
  "NIGHT",
  "MURDER_REVEAL",
  "ENDGAME_VOTE",
  "ENDGAME_BANISH",
  "FINALE",
] as const;
export type Phase = (typeof PHASES)[number];

export type Role = "innocent" | "traitor";
export type Team = "innocents" | "traitors";
export type PlayerStatus = "alive" | "murdered" | "banished" | "left";
export type ItemType = "shield" | "dagger";
export type ItemState = "held" | "used" | "expired" | "lost";
export type MissionKind = "team" | "individual";

/**
 * circle: standard Circle (daggers and ghost votes allowed)
 * revote: Circle tie revote (no daggers, no ghost votes)
 * endgame: End or Banish
 * endgameBanish / endgameRevote: End Game banishment and its tie revote (no daggers, no ghost votes)
 * reward: private vote among mission winners for who gets an ability
 */
export type VoteKind = "circle" | "revote" | "endgame" | "endgameBanish" | "endgameRevote" | "reward";
export type RoundStatus = "open" | "revealing" | "tied" | "done";
/** revote: another vote between the tied; choose: the host picks a spin or another revote. */
export type TieMethod = "revote" | "spin" | "host" | "choose";
export type EndgameChoice = "end" | "banish";

export interface Player {
  id: string;
  name: string;
  displayName: string;
  photoPath: string | null;
  seat: number;
  seatClaimed: boolean;
  seatConfirmed: boolean;
  status: PlayerStatus;
  eliminatedDay: number | null;
  ghostVoteUsed: boolean;
}

export interface Item {
  id: string;
  type: ItemType;
  holderId: string;
  state: ItemState;
  missionId: string | null;
  awardedDay: number;
  usedRoundId: string | null;
  /** Set when the item was lost because its holder was murdered in this night. */
  lostNightId: string | null;
}

export interface Mission {
  id: string;
  day: number;
  order: number;
  name: string;
  kind: MissionKind;
  winRule: string;
  tieRule: string;
  winnerIds: string[];
  status: "active" | "done";
}

export interface Ballot {
  voterId: string;
  targetId: string | null;
  choice: EndgameChoice | null;
  usedDagger: boolean;
  ghost: boolean;
  weight: number;
  at: number;
  enteredByHost: boolean;
}

export type RoundResult =
  | { outcome: "banish"; playerId: string; via: "votes" | "spin" | "host"; tiedIds: string[] }
  | { outcome: "tie"; tiedIds: string[]; method: TieMethod }
  | { outcome: "end" }
  | { outcome: "continue" }
  | { outcome: "award"; playerId: string; via: "votes" | "random" };

export interface VoteRound {
  id: string;
  kind: VoteKind;
  day: number;
  eligibleVoterIds: string[];
  ghostVoterIds: string[];
  candidateIds: string[];
  itemType: ItemType | null;
  missionId: string | null;
  parentRoundId: string | null;
  ballots: Ballot[];
  status: RoundStatus;
  openedAt: number;
  lockedAt: number | null;
  revealOrder: string[];
  revealedCount: number;
  totals: Record<string, number> | null;
  result: RoundResult | null;
}

export type RecruitAnswer = "accepted" | "refused" | "timeout";

export type NightReason =
  | "murdered"
  | "shield"
  | "noValidPicks"
  | "notUnanimous"
  | "recruitAccepted"
  | "recruitRefused"
  | "recruitTimeout"
  | "host";

export interface NightRound {
  id: string;
  day: number;
  picks: Record<string, string>;
  mode: "murder" | "recruit" | null;
  recruit: {
    traitorId: string;
    targetId: string;
    offeredAt: number;
    deadline: number;
    answer: RecruitAnswer | null;
  } | null;
  suspectAnswers: Record<string, string>;
  resolved: boolean;
  /** The chosen target before any shield check (host only). */
  targetId: string | null;
  victimId: string | null;
  reason: NightReason | null;
  revealed: boolean;
}

export interface ChatMessage {
  id: string;
  at: number;
  authorId: string;
  text: string;
}

export type Audience =
  | { kind: "public" }
  | { kind: "host" }
  | { kind: "traitors" }
  | { kind: "player"; playerId: string };

export interface GameEvent {
  id: string;
  at: number;
  day: number;
  audience: Audience;
  type: string;
  data: Record<string, unknown>;
}

export type Actor = { kind: "host" } | { kind: "player"; playerId: string } | { kind: "system" };

export interface LogEntry {
  id: string;
  at: number;
  day: number;
  phase: Phase;
  actor: Actor;
  action: string;
  summary: string;
  reason: string | null;
  override: boolean;
}

export interface Finale {
  /** The game is decided; screens show the result only once the host reveals it. */
  revealed: boolean;
  winner: Team;
  winnerIds: string[];
  reason: string;
  early: boolean;
  endedAt: number;
  /** Suspect-poll answers counted per player, across every night. */
  suspicion: Record<string, number>;
}

export interface GameState {
  schemaVersion: 1;
  code: string;
  /** Seeds every random choice (deal, tie-breaks, spins), so the engine stays pure. Never sent to a client. */
  seed: string;
  version: number;
  phase: Phase;
  day: number;
  paused: boolean;
  pausedAt: number | null;
  deadline: number | null;
  pausedRemainingMs: number | null;
  settings: GameSettings;
  /** Set when roles are dealt; rule settings are frozen from then on. */
  frozen: { at: number; startingPlayerCount: number } | null;
  endgameStarted: boolean;
  players: Player[];
  roles: Record<string, Role>;
  roleSeen: Record<string, boolean>;
  items: Item[];
  missions: Mission[];
  currentMissionId: string | null;
  rounds: VoteRound[];
  currentRoundId: string | null;
  nights: NightRound[];
  chat: ChatMessage[];
  events: GameEvent[];
  log: LogEntry[];
  finale: Finale | null;
  closed: boolean;
  nextId: number;
}

type WithReason = { reason: string };

/** What a client may ask for; the server adds actor and time. */
export type ActionPayload =
  // Lobby and roster
  | { type: "addPlayer"; name: string; displayName?: string; role?: Role; reason?: string }
  | { type: "removePlayer"; playerId: string }
  | { type: "editPlayer"; playerId: string; name?: string; displayName?: string }
  | { type: "setPhoto"; playerId: string; photoPath: string | null }
  | { type: "updateSettings"; patch: Partial<GameSettings> }
  | ({ type: "overrideSetting"; key: SettingKey; value: unknown } & WithReason)
  | { type: "claimSeat" }
  | { type: "confirmSeat"; playerId: string }
  | { type: "resetSeat"; playerId: string }
  | { type: "dealRoles" }
  | { type: "acknowledgeRole" }
  // Missions and items
  | { type: "startMission"; name: string; kind: MissionKind; winRule?: string; tieRule?: string }
  | { type: "setMissionWinners"; playerIds: string[] }
  | { type: "awardItem"; itemType: ItemType; playerIds: string[] }
  | { type: "openRewardVote"; itemType: ItemType; voterIds: string[] }
  | { type: "castRewardVote"; targetId: string }
  | { type: "lockRewardVote" }
  | ({ type: "giveItem"; itemType: ItemType; playerId: string } & WithReason)
  | ({ type: "removeItem"; itemId: string } & WithReason)
  | ({ type: "moveItem"; itemId: string; toPlayerId: string } & WithReason)
  // Circle
  | { type: "openCircle" }
  | { type: "openVoting" }
  | { type: "castVote"; targetId: string; useDagger?: boolean }
  | { type: "castEndgameVote"; choice: EndgameChoice }
  | { type: "lockVoting" }
  | ({ type: "setBallot"; voterId: string; targetId?: string; choice?: EndgameChoice } & WithReason)
  | ({ type: "rerunVote" } & WithReason)
  | { type: "revealNextBallot" }
  | { type: "finishReveal" }
  | { type: "startRevote" }
  | { type: "spinTie" }
  | { type: "decideTie"; playerId: string; reason?: string }
  // Night
  | { type: "nightPick"; targetId: string; mode?: "murder" | "recruit" }
  | { type: "answerRecruit"; accept: boolean }
  | { type: "suspectAnswer"; targetId: string }
  | { type: "sendChat"; text: string }
  | { type: "resolveNight"; targetId?: string | null; reason?: string }
  | { type: "revealMurder" }
  // Timers and host controls
  | { type: "tick" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "adjustTimer"; deltaSeconds: number }
  | ({ type: "eliminatePlayer"; playerId: string; status: "murdered" | "banished" | "left" } & WithReason)
  | ({ type: "revivePlayer"; playerId: string } & WithReason)
  | ({ type: "setRole"; playerId: string; role: Role } & WithReason)
  | ({ type: "endGameEarly" } & WithReason)
  | { type: "revealFinale" }
  | { type: "closeGame" };

export type ActionType = ActionPayload["type"];
export type GameAction = ActionPayload & { actor: Actor; at: number };
export type ActionOf<T extends ActionType> = Extract<GameAction, { type: T }>;

export type EngineResult =
  | { ok: true; nextState: GameState; events: GameEvent[] }
  | { ok: false; reason: string };

export type Viewer =
  | { kind: "host" }
  | { kind: "cohost" }
  | { kind: "screen" }
  | { kind: "player"; playerId: string };
