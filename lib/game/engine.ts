import { pickOne, seededRand, shuffle } from "./random";
import {
  DEFAULT_ROSTER,
  DEFAULT_SETTINGS,
  DISPLAY_NAME_MAX,
  MAX_PLAYERS,
  NAME_MAX,
  SETTING_KEYS,
  SETTING_META,
  defaultEndGameThreshold,
  resolveEndGameThreshold,
  settingsSchema,
  validatePlayerCount,
  validateSettingValue,
  validateSettings,
  type GameSettings,
  type SettingKey,
} from "./settings";
import type {
  ActionOf,
  Audience,
  EngineResult,
  GameAction,
  GameEvent,
  GameState,
  Item,
  ItemType,
  Mission,
  NightReason,
  NightRound,
  Phase,
  Player,
  Role,
  Team,
  TieMethod,
  VoteKind,
  VoteRound,
} from "./types";

class RuleError extends Error {}

function fail(message: string): never {
  throw new RuleError(message);
}

interface Ctx {
  s: GameState;
  a: GameAction;
  at: number;
  phaseBefore: Phase;
  events: GameEvent[];
}

const PUBLIC: Audience = { kind: "public" };
const HOST: Audience = { kind: "host" };
const TRAITORS: Audience = { kind: "traitors" };
const toPlayer = (playerId: string): Audience => ({ kind: "player", playerId });

const PHASE_LABEL: Record<Phase, string> = {
  LOBBY: "in the lobby",
  ROLES: "during the role reveal",
  MISSION: "during a mission",
  CIRCLE_DEBATE: "during the debate",
  CIRCLE_VOTE: "while voting is open",
  CIRCLE_REVEAL: "during the vote reveal",
  NIGHT: "at night",
  MURDER_REVEAL: "at breakfast",
  ENDGAME_VOTE: "during the End Game vote",
  ENDGAME_BANISH: "during the End Game banishment",
  FINALE: "after the final reveal",
};

const PLAYER_VOTE_KINDS: VoteKind[] = ["circle", "revote", "endgameBanish", "endgameRevote"];

// ---------------------------------------------------------------------------
// Public API

export interface CreateGameOptions {
  code: string;
  seed: string;
  at: number;
  roster?: ReadonlyArray<{ name: string; displayName: string }>;
  settings?: Partial<GameSettings>;
}

export function createGame(o: CreateGameOptions): GameState {
  if (!/^[A-Z0-9]{4,8}$/.test(o.code)) throw new Error("Room code must be 4 to 8 capital letters or digits.");
  if (!o.seed) throw new Error("A seed is required.");
  const settings = settingsSchema.parse({ ...DEFAULT_SETTINGS, ...o.settings });
  const roster = o.roster ?? DEFAULT_ROSTER;
  if (roster.length > MAX_PLAYERS) throw new Error(`At most ${MAX_PLAYERS} players.`);
  const s: GameState = {
    schemaVersion: 1,
    code: o.code,
    seed: o.seed,
    version: 0,
    phase: "LOBBY",
    day: 0,
    paused: false,
    pausedAt: null,
    deadline: null,
    pausedRemainingMs: null,
    settings,
    frozen: null,
    endgameStarted: false,
    players: [],
    roles: {},
    roleSeen: {},
    items: [],
    missions: [],
    currentMissionId: null,
    rounds: [],
    currentRoundId: null,
    nights: [],
    chat: [],
    events: [],
    log: [],
    finale: null,
    closed: false,
    nextId: 1,
  };
  const seen = new Set<string>();
  roster.forEach((r, i) => {
    const name = r.name.trim();
    const displayName = r.displayName.trim();
    if (!name || name.length > NAME_MAX || !displayName || displayName.length > DISPLAY_NAME_MAX) {
      throw new Error(`Invalid roster entry: ${r.name}`);
    }
    if (seen.has(displayName.toLowerCase())) throw new Error(`Duplicate display name: ${displayName}`);
    seen.add(displayName.toLowerCase());
    s.players.push(newPlayer(`p${s.nextId++}`, name, displayName, i + 1));
  });
  return s;
}

export function applyGameAction(state: GameState, action: GameAction): EngineResult {
  const s = structuredClone(state);
  const ctx: Ctx = { s, a: action, at: action.at, phaseBefore: state.phase, events: [] };
  try {
    if (!Number.isFinite(action.at)) fail("The action has no time.");
    if (s.closed) fail("This game is closed.");
    dispatch(ctx);
  } catch (err) {
    if (err instanceof RuleError) return { ok: false, reason: err.message };
    throw err;
  }
  s.version += 1;
  return { ok: true, nextState: s, events: ctx.events };
}

// ---------------------------------------------------------------------------
// Dispatch

function dispatch(ctx: Ctx): void {
  const a = ctx.a;
  switch (a.type) {
    case "addPlayer": return addPlayer(ctx, a);
    case "removePlayer": return removePlayer(ctx, a);
    case "editPlayer": return editPlayer(ctx, a);
    case "setPhoto": return setPhoto(ctx, a);
    case "updateSettings": return updateSettings(ctx, a);
    case "overrideSetting": return overrideSetting(ctx, a);
    case "claimSeat": return claimSeat(ctx);
    case "confirmSeat": return confirmSeat(ctx, a);
    case "resetSeat": return resetSeat(ctx, a);
    case "dealRoles": return dealRoles(ctx);
    case "acknowledgeRole": return acknowledgeRole(ctx);
    case "startMission": return startMission(ctx, a);
    case "setMissionWinners": return setMissionWinners(ctx, a);
    case "awardItem": return awardItem(ctx, a);
    case "openRewardVote": return openRewardVote(ctx, a);
    case "castRewardVote": return castRewardVote(ctx, a);
    case "lockRewardVote": return lockRewardVote(ctx);
    case "giveItem": return giveItem(ctx, a);
    case "removeItem": return removeItem(ctx, a);
    case "moveItem": return moveItem(ctx, a);
    case "openCircle": return openCircle(ctx);
    case "openVoting": return openVoting(ctx);
    case "castVote": return castVote(ctx, a);
    case "castEndgameVote": return castEndgameVote(ctx, a);
    case "lockVoting": return lockVoting(ctx);
    case "setBallot": return setBallot(ctx, a);
    case "rerunVote": return rerunVote(ctx, a);
    case "revealNextBallot": return revealNextBallot(ctx);
    case "finishReveal": return finishReveal(ctx);
    case "startRevote": return startRevote(ctx);
    case "spinTie": return spinTie(ctx);
    case "decideTie": return decideTie(ctx, a);
    case "nightPick": return nightPick(ctx, a);
    case "answerRecruit": return answerRecruit(ctx, a);
    case "suspectAnswer": return suspectAnswer(ctx, a);
    case "sendChat": return sendChat(ctx, a);
    case "resolveNight": return resolveNightByHost(ctx, a);
    case "revealMurder": return revealMurder(ctx);
    case "tick": return tick(ctx);
    case "pause": return pause(ctx);
    case "resume": return resume(ctx);
    case "adjustTimer": return adjustTimer(ctx, a);
    case "eliminatePlayer": return eliminatePlayer(ctx, a);
    case "revivePlayer": return revivePlayer(ctx, a);
    case "setRole": return setRole(ctx, a);
    case "endGameEarly": return endGameEarly(ctx, a);
    case "revealFinale": return revealFinale(ctx);
    case "closeGame": return closeGame(ctx);
    default: {
      const unknown: never = a;
      fail(`Unknown action: ${(unknown as { type: string }).type}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers

function newId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

function newPlayer(id: string, name: string, displayName: string, seat: number): Player {
  return {
    id,
    name,
    displayName,
    photoPath: null,
    seat,
    seatClaimed: false,
    seatConfirmed: false,
    status: "alive",
    eliminatedDay: null,
    ghostVoteUsed: false,
  };
}

function rand(s: GameState, salt: string) {
  return seededRand(s.seed, s.version, salt);
}

function emit(ctx: Ctx, type: string, audience: Audience, data: Record<string, unknown> = {}): void {
  const e: GameEvent = { id: newId(ctx.s, "e"), at: ctx.at, day: ctx.s.day, audience, type, data };
  ctx.s.events.push(e);
  ctx.events.push(e);
}

function log(ctx: Ctx, summary: string, opts: { reason?: string | null; override?: boolean } = {}): void {
  ctx.s.log.push({
    id: newId(ctx.s, "l"),
    at: ctx.at,
    day: ctx.s.day,
    phase: ctx.phaseBefore,
    actor: ctx.a.actor,
    action: ctx.a.type,
    summary,
    reason: opts.reason ?? null,
    override: opts.override ?? false,
  });
}

function getPlayer(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) fail("That player isn't in this game.");
  return p;
}

const isAlive = (p: Player) => p.status === "alive";
const alivePlayers = (s: GameState) => s.players.filter(isAlive);
const aliveIds = (s: GameState) => alivePlayers(s).map((p) => p.id);
const aliveTraitorIds = (s: GameState) => aliveIds(s).filter((id) => s.roles[id] === "traitor");
const nameOf = (s: GameState, id: string) => getPlayer(s, id).displayName;
const names = (s: GameState, ids: string[]) => ids.map((id) => nameOf(s, id)).join(", ");

function requireHost(ctx: Ctx): void {
  if (ctx.a.actor.kind !== "host") fail("Only the host can do that.");
}

function requireActingPlayer(ctx: Ctx): Player {
  const actor = ctx.a.actor;
  if (actor.kind !== "player") fail("Only a player can do that.");
  return getPlayer(ctx.s, actor.playerId);
}

function requirePhase(ctx: Ctx, ...phases: Phase[]): void {
  if (!phases.includes(ctx.s.phase)) fail(`You can't do that ${PHASE_LABEL[ctx.s.phase]}.`);
}

function requireDealt(ctx: Ctx): void {
  if (!ctx.s.frozen) fail("Roles haven't been dealt yet.");
}

function requireNotFinale(ctx: Ctx): void {
  if (ctx.s.phase === "FINALE") fail("The game is over.");
}

function requireNotPaused(ctx: Ctx): void {
  if (ctx.s.paused) fail("The game is paused.");
}

function requireReason(reason: string | undefined): string {
  const r = (reason ?? "").trim();
  if (!r) fail("Give a reason; it goes in the action log.");
  if (r.length > 300) fail("Keep the reason under 300 characters.");
  return r;
}

function cleanText(raw: unknown, max: number, label: string, allowEmpty = false): string {
  if (typeof raw !== "string") {
    if (allowEmpty && raw === undefined) return "";
    fail(`${label} is missing.`);
  }
  const v = raw.trim().replace(/\s+/g, " ");
  if (!v && !allowEmpty) fail(`${label} can't be empty.`);
  if (v.length > max) fail(`${label} can be at most ${max} characters.`);
  return v;
}

function ensureUniqueDisplayName(s: GameState, displayName: string, exceptId?: string): void {
  const clash = s.players.find(
    (p) => p.id !== exceptId && p.displayName.toLowerCase() === displayName.toLowerCase(),
  );
  if (clash) fail(`Another player is already shown as "${displayName}".`);
}

function setTimer(s: GameState, at: number, seconds: number | null): void {
  if (seconds === null) {
    s.deadline = null;
    s.pausedRemainingMs = null;
    return;
  }
  const ms = seconds * 1000;
  if (s.paused) {
    s.deadline = null;
    s.pausedRemainingMs = ms;
  } else {
    s.deadline = at + ms;
    s.pausedRemainingMs = null;
  }
}

function endGameThreshold(s: GameState): number {
  return resolveEndGameThreshold(s.settings, s.frozen?.startingPlayerCount ?? s.players.length);
}

function currentRound(s: GameState): VoteRound | null {
  if (!s.currentRoundId) return null;
  return s.rounds.find((r) => r.id === s.currentRoundId) ?? null;
}

function currentMission(s: GameState): Mission | null {
  if (!s.currentMissionId) return null;
  return s.missions.find((m) => m.id === s.currentMissionId) ?? null;
}

function lastNight(s: GameState): NightRound | null {
  return s.nights.length ? s.nights[s.nights.length - 1] : null;
}

function activeNight(s: GameState): NightRound | null {
  const n = lastNight(s);
  return s.phase === "NIGHT" && n && !n.resolved ? n : null;
}

function heldItem(s: GameState, playerId: string, type: ItemType): Item | undefined {
  return s.items.find((i) => i.holderId === playerId && i.type === type && i.state === "held");
}

function requireCanReceive(s: GameState, playerId: string, type: ItemType): Player {
  const p = getPlayer(s, playerId);
  if (!isAlive(p)) fail(`${p.displayName} is a ghost and can't receive a ${type}.`);
  if (heldItem(s, playerId, type)) fail(`${p.displayName} already holds a ${type}. Pick someone else.`);
  return p;
}

function createItem(ctx: Ctx, type: ItemType, holderId: string, missionId: string | null): Item {
  const item: Item = {
    id: newId(ctx.s, "i"),
    type,
    holderId,
    state: "held",
    missionId,
    awardedDay: ctx.s.day,
    usedRoundId: null,
    lostNightId: null,
  };
  ctx.s.items.push(item);
  emit(ctx, "itemAwarded", toPlayer(holderId), { itemId: item.id, itemType: type });
  return item;
}

function loseItems(s: GameState, playerId: string, nightId: string | null): void {
  for (const i of s.items) {
    if (i.holderId === playerId && i.state === "held") {
      i.state = "lost";
      i.lostNightId = nightId;
    }
  }
}

function distinctIds(s: GameState, ids: unknown, label: string): string[] {
  if (!Array.isArray(ids) || ids.length === 0) fail(`Pick at least one ${label}.`);
  const unique = [...new Set(ids as string[])];
  if (unique.length !== ids.length) fail(`Each ${label} can be picked only once.`);
  unique.forEach((id) => getPlayer(s, id));
  return unique;
}

function revealedRole(s: GameState, playerId: string): Role | null {
  return s.settings.revealOnElimination ? s.roles[playerId] ?? null : null;
}

// ---------------------------------------------------------------------------
// Lobby, roster and settings

function addPlayer(ctx: Ctx, a: ActionOf<"addPlayer">): void {
  requireHost(ctx);
  requireNotFinale(ctx);
  const { s } = ctx;
  if (s.players.length >= MAX_PLAYERS) fail(`A game can have at most ${MAX_PLAYERS} players.`);
  const name = cleanText(a.name, NAME_MAX, "Name");
  const displayName = cleanText(a.displayName ?? name, DISPLAY_NAME_MAX, "Display name");
  ensureUniqueDisplayName(s, displayName);
  let reason: string | null = null;
  if (s.frozen) {
    reason = requireReason(a.reason);
    if (a.role !== undefined && a.role !== "innocent" && a.role !== "traitor") fail("Unknown role.");
  } else if (a.role !== undefined) {
    fail("Roles are dealt at random. Add the player without a role.");
  }
  const seat = Math.max(0, ...s.players.map((p) => p.seat)) + 1;
  const p = newPlayer(newId(s, "p"), name, displayName, seat);
  s.players.push(p);
  if (s.frozen) {
    s.roles[p.id] = a.role ?? "innocent";
    s.roleSeen[p.id] = false;
  }
  emit(ctx, "playerAdded", PUBLIC, { playerId: p.id });
  log(ctx, `Added ${displayName}${s.frozen ? ` as ${s.roles[p.id]}` : ""}`, { reason, override: !!s.frozen });
}

function removePlayer(ctx: Ctx, a: ActionOf<"removePlayer">): void {
  requireHost(ctx);
  if (ctx.s.phase !== "LOBBY") fail("After dealing, mark the player as eliminated instead.");
  const p = getPlayer(ctx.s, a.playerId);
  ctx.s.players = ctx.s.players.filter((x) => x.id !== p.id);
  ctx.s.players.forEach((x, i) => (x.seat = i + 1));
  emit(ctx, "playerRemoved", PUBLIC, { playerId: p.id });
  log(ctx, `Removed ${p.displayName}`);
}

function editPlayer(ctx: Ctx, a: ActionOf<"editPlayer">): void {
  requireHost(ctx);
  const p = getPlayer(ctx.s, a.playerId);
  if (a.name === undefined && a.displayName === undefined) fail("Nothing to change.");
  const before = p.displayName;
  if (a.name !== undefined) p.name = cleanText(a.name, NAME_MAX, "Name");
  if (a.displayName !== undefined) {
    const dn = cleanText(a.displayName, DISPLAY_NAME_MAX, "Display name");
    ensureUniqueDisplayName(ctx.s, dn, p.id);
    p.displayName = dn;
  }
  log(ctx, `Edited ${before}${before !== p.displayName ? ` (now ${p.displayName})` : ""}`);
}

function setPhoto(ctx: Ctx, a: ActionOf<"setPhoto">): void {
  requireHost(ctx);
  const p = getPlayer(ctx.s, a.playerId);
  if (a.photoPath !== null) {
    if (typeof a.photoPath !== "string" || !a.photoPath || a.photoPath.length > 300 || a.photoPath.includes("..")) {
      fail("That photo path isn't valid.");
    }
  }
  p.photoPath = a.photoPath;
  log(ctx, `${a.photoPath ? "Set" : "Removed"} ${p.displayName}'s photo`);
}

function formatValue(v: unknown): string {
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function updateSettings(ctx: Ctx, a: ActionOf<"updateSettings">): void {
  requireHost(ctx);
  requireNotFinale(ctx);
  const { s } = ctx;
  const patch = (a.patch ?? {}) as Record<string, unknown>;
  const keys = Object.keys(patch);
  if (!keys.length) fail("Nothing to change.");
  const next: Record<string, unknown> = { ...s.settings };
  for (const raw of keys) {
    if (!SETTING_KEYS.includes(raw as SettingKey)) fail(`Unknown setting: ${raw}`);
    const key = raw as SettingKey;
    const meta = SETTING_META[key];
    if (s.frozen && meta.afterDealing !== "anyTime") {
      fail(
        `${meta.label} is frozen now that roles are dealt.${
          meta.afterDealing === "override" ? " Use a host override to change it." : ""
        }`,
      );
    }
    const v = validateSettingValue(key, patch[key]);
    if (!v.ok) fail(v.errors.join(" "));
    next[key] = v.value;
  }
  if (!s.frozen && (keys.includes("traitorCount") || keys.includes("endGameThreshold"))) {
    const v = validateSettings(next, s.players.length);
    if (!v.ok) fail(v.errors.join(" "));
  }
  s.settings = settingsSchema.parse(next);
  log(ctx, `Changed ${keys.map((k) => `${SETTING_META[k as SettingKey].label} to ${formatValue(next[k])}`).join("; ")}`);
}

function overrideSetting(ctx: Ctx, a: ActionOf<"overrideSetting">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const { s } = ctx;
  if (!SETTING_KEYS.includes(a.key)) fail(`Unknown setting: ${String(a.key)}`);
  const meta = SETTING_META[a.key];
  if (meta.afterDealing === "fixed") fail(`${meta.label} can't change once roles are dealt.`);
  const reason = requireReason(a.reason);
  const v = validateSettingValue(a.key, a.value);
  if (!v.ok) fail(v.errors.join(" "));
  let value: unknown = v.value;
  if (a.key === "endGameThreshold") {
    const start = s.frozen!.startingPlayerCount;
    const n = value === "auto" ? defaultEndGameThreshold(start) : (value as number);
    if (n < 2 || n > start - 1) fail(`End Game threshold: between 2 and ${start - 1} for ${start} starting players.`);
    value = n;
  }
  s.settings = settingsSchema.parse({ ...s.settings, [a.key]: value });
  emit(ctx, "settingChanged", PUBLIC, { key: a.key });
  log(ctx, `Override: ${meta.label} set to ${formatValue(value)}`, { reason, override: true });
}

function claimSeat(ctx: Ctx): void {
  const p = requireActingPlayer(ctx);
  requireNotFinale(ctx);
  if (p.seatClaimed) fail("That seat is already taken. Ask the host to reset it if it's yours.");
  p.seatClaimed = true;
  emit(ctx, "seatClaimed", PUBLIC, { playerId: p.id });
  log(ctx, `${p.displayName} claimed their seat`);
}

function confirmSeat(ctx: Ctx, a: ActionOf<"confirmSeat">): void {
  requireHost(ctx);
  const p = getPlayer(ctx.s, a.playerId);
  if (!p.seatClaimed) fail(`${p.displayName} hasn't claimed their seat yet.`);
  if (p.seatConfirmed) fail(`${p.displayName}'s seat is already confirmed.`);
  p.seatConfirmed = true;
  log(ctx, `Confirmed ${p.displayName}'s seat`);
}

function resetSeat(ctx: Ctx, a: ActionOf<"resetSeat">): void {
  requireHost(ctx);
  const p = getPlayer(ctx.s, a.playerId);
  p.seatClaimed = false;
  p.seatConfirmed = false;
  emit(ctx, "seatReset", PUBLIC, { playerId: p.id });
  log(ctx, `Reset ${p.displayName}'s seat`);
}

function dealRoles(ctx: Ctx): void {
  requireHost(ctx);
  requirePhase(ctx, "LOBBY");
  const { s } = ctx;
  const n = s.players.length;
  const countErrors = validatePlayerCount(n);
  if (countErrors.length) fail(countErrors[0]);
  const notReady = s.players.filter((p) => !p.seatClaimed || !p.seatConfirmed);
  if (notReady.length) fail(`Confirm every seat first. Waiting on: ${names(s, notReady.map((p) => p.id))}.`);
  const v = validateSettings(s.settings, n);
  if (!v.ok) fail(v.errors.join(" "));
  const order = shuffle(
    s.players.map((p) => p.id),
    rand(s, "deal"),
  );
  const traitors = new Set(order.slice(0, s.settings.traitorCount));
  for (const p of s.players) {
    s.roles[p.id] = traitors.has(p.id) ? "traitor" : "innocent";
    s.roleSeen[p.id] = false;
  }
  s.settings = { ...s.settings, endGameThreshold: resolveEndGameThreshold(s.settings, n) };
  s.frozen = { at: ctx.at, startingPlayerCount: n };
  s.day = 1;
  s.phase = "ROLES";
  setTimer(s, ctx.at, null);
  emit(ctx, "rolesDealt", PUBLIC, { traitorCount: s.settings.traitorCount, playerCount: n });
  log(ctx, `Dealt roles: ${s.settings.traitorCount} Traitors among ${n} players`);
}

function acknowledgeRole(ctx: Ctx): void {
  const p = requireActingPlayer(ctx);
  requireDealt(ctx);
  if (ctx.s.roleSeen[p.id]) fail("You've already opened your role.");
  ctx.s.roleSeen[p.id] = true;
  log(ctx, `${p.displayName} opened their role`);
}

// ---------------------------------------------------------------------------
// Missions and items

function requireChoicePoint(ctx: Ctx): void {
  const { s } = ctx;
  requirePhase(ctx, "ROLES", "MISSION", "MURDER_REVEAL");
  if (s.phase === "MURDER_REVEAL" && !lastNight(s)?.revealed) fail("Reveal the murder first.");
  if (s.phase === "MISSION") {
    const r = currentRound(s);
    if (r && r.kind === "reward" && r.status === "open") fail("Close the reward vote first.");
  }
}

function closeMission(ctx: Ctx): void {
  const m = currentMission(ctx.s);
  if (m && m.status === "active") {
    m.status = "done";
    emit(ctx, "missionEnded", PUBLIC, { missionId: m.id });
  }
  ctx.s.currentMissionId = null;
}

function requireActiveMission(ctx: Ctx): Mission {
  requirePhase(ctx, "MISSION");
  const m = currentMission(ctx.s);
  if (!m || m.status !== "active") fail("There's no mission running.");
  return m;
}

function requireNoOpenRewardVote(ctx: Ctx): void {
  const r = currentRound(ctx.s);
  if (r && r.kind === "reward" && r.status === "open") fail("A reward vote is still open.");
}

function startMission(ctx: Ctx, a: ActionOf<"startMission">): void {
  requireHost(ctx);
  requireChoicePoint(ctx);
  const { s } = ctx;
  const name = cleanText(a.name, 60, "Mission name");
  if (a.kind !== "team" && a.kind !== "individual") fail("A mission is a team game or an individual game.");
  const winRule = cleanText(a.winRule, 200, "Win rule", true);
  const tieRule = cleanText(a.tieRule, 200, "Tie rule", true);
  closeMission(ctx);
  const m: Mission = {
    id: newId(s, "m"),
    day: s.day,
    order: s.missions.filter((x) => x.day === s.day).length + 1,
    name,
    kind: a.kind,
    winRule,
    tieRule,
    winnerIds: [],
    status: "active",
  };
  s.missions.push(m);
  s.currentMissionId = m.id;
  s.phase = "MISSION";
  setTimer(s, ctx.at, null);
  emit(ctx, "missionStarted", PUBLIC, { missionId: m.id, name, kind: a.kind, winRule, tieRule });
  log(ctx, `Started mission "${name}"`);
}

function setMissionWinners(ctx: Ctx, a: ActionOf<"setMissionWinners">): void {
  requireHost(ctx);
  const m = requireActiveMission(ctx);
  const ids = distinctIds(ctx.s, a.playerIds, "winner");
  for (const id of ids) if (!isAlive(getPlayer(ctx.s, id))) fail(`${nameOf(ctx.s, id)} is a ghost and can't win a mission.`);
  m.winnerIds = ids;
  log(ctx, `Mission "${m.name}" winners: ${names(ctx.s, ids)}`);
}

function awardItem(ctx: Ctx, a: ActionOf<"awardItem">): void {
  requireHost(ctx);
  const m = requireActiveMission(ctx);
  requireNoOpenRewardVote(ctx);
  if (a.itemType !== "shield" && a.itemType !== "dagger") fail("The ability is a shield or a dagger.");
  const ids = distinctIds(ctx.s, a.playerIds, "player");
  ids.forEach((id) => requireCanReceive(ctx.s, id, a.itemType));
  ids.forEach((id) => createItem(ctx, a.itemType, id, m.id));
  log(ctx, `Mission "${m.name}": gave a ${a.itemType} to ${names(ctx.s, ids)}`);
}

function openRewardVote(ctx: Ctx, a: ActionOf<"openRewardVote">): void {
  requireHost(ctx);
  const m = requireActiveMission(ctx);
  requireNoOpenRewardVote(ctx);
  const { s } = ctx;
  if (a.itemType !== "shield" && a.itemType !== "dagger") fail("The ability is a shield or a dagger.");
  const voters = distinctIds(s, a.voterIds, "winner");
  if (voters.length < 2) fail("A reward vote needs at least two winners.");
  for (const id of voters) if (!isAlive(getPlayer(s, id))) fail(`${nameOf(s, id)} is a ghost.`);
  const candidates = voters.filter((id) => !heldItem(s, id, a.itemType));
  if (candidates.length < 2) {
    fail(`At least two winners must be free to receive the ${a.itemType}. Otherwise give it directly.`);
  }
  openRound(ctx, "reward", {
    voters,
    candidates,
    itemType: a.itemType,
    missionId: m.id,
    seconds: s.settings.rewardVoteSeconds,
  });
  voters.forEach((id) => emit(ctx, "rewardVoteOpened", toPlayer(id), { itemType: a.itemType }));
  log(ctx, `Opened a reward vote for a ${a.itemType} among ${names(s, voters)}`);
}

function castRewardVote(ctx: Ctx, a: ActionOf<"castRewardVote">): void {
  const p = requireActingPlayer(ctx);
  requireNotPaused(ctx);
  const r = currentRound(ctx.s);
  if (!r || r.kind !== "reward" || r.status !== "open") fail("There's no reward vote open.");
  if (!r.eligibleVoterIds.includes(p.id)) fail("Only the mission winners vote on this.");
  if (r.ballots.some((b) => b.voterId === p.id)) fail("Your vote is already in. Votes can't be changed.");
  if (a.targetId === p.id) fail("You can't vote for yourself.");
  if (!r.candidateIds.includes(a.targetId)) fail("Pick one of the winners who can receive it.");
  r.ballots.push(ballot(p.id, a.targetId, null, ctx.at));
  log(ctx, `${p.displayName} voted in the reward vote`);
  if (r.eligibleVoterIds.every((id) => r.ballots.some((b) => b.voterId === id))) resolveRewardVote(ctx, r);
}

function lockRewardVote(ctx: Ctx): void {
  requireHost(ctx);
  const r = currentRound(ctx.s);
  if (!r || r.kind !== "reward" || r.status !== "open") fail("There's no reward vote open.");
  log(ctx, "Closed the reward vote");
  resolveRewardVote(ctx, r);
}

function resolveRewardVote(ctx: Ctx, r: VoteRound): void {
  const { s } = ctx;
  const type = r.itemType!;
  const totals = tally(r, r.candidateIds);
  r.totals = totals;
  r.status = "done";
  r.lockedAt = ctx.at;
  s.currentRoundId = null;
  setTimer(s, ctx.at, null);
  const free = r.candidateIds.filter((id) => isAlive(getPlayer(s, id)) && !heldItem(s, id, type));
  if (free.length) {
    const max = Math.max(...free.map((id) => totals[id]));
    const top = free.filter((id) => totals[id] === max);
    const via = top.length === 1 ? "votes" : "random";
    const winner = top.length === 1 ? top[0] : pickOne(top, rand(s, `reward:${r.id}`));
    createItem(ctx, type, winner, r.missionId);
    r.result = { outcome: "award", playerId: winner, via };
    log(ctx, `Reward vote: ${nameOf(s, winner)} gets the ${type}${via === "random" ? " (tie settled at random)" : ""}`);
  } else {
    log(ctx, `Reward vote closed; nobody was free to receive the ${type}`);
  }
  r.eligibleVoterIds.forEach((id) => emit(ctx, "rewardVoteClosed", toPlayer(id), {}));
}

function giveItem(ctx: Ctx, a: ActionOf<"giveItem">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const reason = requireReason(a.reason);
  if (a.itemType !== "shield" && a.itemType !== "dagger") fail("The ability is a shield or a dagger.");
  const p = requireCanReceive(ctx.s, a.playerId, a.itemType);
  createItem(ctx, a.itemType, p.id, currentMission(ctx.s)?.id ?? null);
  log(ctx, `Gave a ${a.itemType} to ${p.displayName}`, { reason, override: true });
}

function requireHeldItem(s: GameState, itemId: string): Item {
  const item = s.items.find((i) => i.id === itemId);
  if (!item) fail("That item doesn't exist.");
  if (item.state !== "held") fail("Only an item that's still held can be changed.");
  return item;
}

function removeItem(ctx: Ctx, a: ActionOf<"removeItem">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const reason = requireReason(a.reason);
  const item = requireHeldItem(ctx.s, a.itemId);
  ctx.s.items = ctx.s.items.filter((i) => i.id !== item.id);
  emit(ctx, "itemRemoved", toPlayer(item.holderId), { itemId: item.id, itemType: item.type });
  log(ctx, `Removed ${nameOf(ctx.s, item.holderId)}'s ${item.type}`, { reason, override: true });
}

function moveItem(ctx: Ctx, a: ActionOf<"moveItem">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const reason = requireReason(a.reason);
  const item = requireHeldItem(ctx.s, a.itemId);
  if (a.toPlayerId === item.holderId) fail("That player already holds it.");
  const to = requireCanReceive(ctx.s, a.toPlayerId, item.type);
  const from = item.holderId;
  item.holderId = to.id;
  emit(ctx, "itemRemoved", toPlayer(from), { itemId: item.id, itemType: item.type });
  emit(ctx, "itemAwarded", toPlayer(to.id), { itemId: item.id, itemType: item.type });
  log(ctx, `Moved a ${item.type} from ${nameOf(ctx.s, from)} to ${to.displayName}`, { reason, override: true });
}

// ---------------------------------------------------------------------------
// Voting

function ballot(voterId: string, targetId: string | null, choice: "end" | "banish" | null, at: number) {
  return { voterId, targetId, choice, usedDagger: false, ghost: false, weight: 1, at, enteredByHost: false };
}

function openRound(
  ctx: Ctx,
  kind: VoteKind,
  o: {
    voters: string[];
    candidates: string[];
    ghostVoters?: string[];
    itemType?: ItemType;
    missionId?: string;
    parent?: string;
    seconds: number;
  },
): VoteRound {
  const { s } = ctx;
  const r: VoteRound = {
    id: newId(s, "r"),
    kind,
    day: s.day,
    eligibleVoterIds: o.voters,
    ghostVoterIds: o.ghostVoters ?? [],
    candidateIds: o.candidates,
    itemType: o.itemType ?? null,
    missionId: o.missionId ?? null,
    parentRoundId: o.parent ?? null,
    ballots: [],
    status: "open",
    openedAt: ctx.at,
    lockedAt: null,
    revealOrder: [],
    revealedCount: 0,
    totals: null,
    result: null,
  };
  s.rounds.push(r);
  s.currentRoundId = r.id;
  setTimer(s, ctx.at, o.seconds);
  return r;
}

function tally(r: VoteRound, candidates: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of candidates) totals[id] = 0;
  for (const b of r.ballots) if (b.targetId && b.targetId in totals) totals[b.targetId] += b.weight;
  return totals;
}

function openCircle(ctx: Ctx): void {
  requireHost(ctx);
  requireChoicePoint(ctx);
  closeMission(ctx);
  ctx.s.phase = "CIRCLE_DEBATE";
  setTimer(ctx.s, ctx.at, ctx.s.settings.debateSeconds);
  emit(ctx, "circleOpened", PUBLIC, {});
  log(ctx, "Opened the Circle of Shaq");
}

function startCircleVote(ctx: Ctx): void {
  const { s } = ctx;
  const alive = aliveIds(s);
  const ghosts = s.settings.ghostVote
    ? s.players.filter((p) => !isAlive(p) && !p.ghostVoteUsed).map((p) => p.id)
    : [];
  const r = openRound(ctx, "circle", {
    voters: alive,
    candidates: alive,
    ghostVoters: ghosts,
    seconds: s.settings.voteSeconds,
  });
  s.phase = "CIRCLE_VOTE";
  emit(ctx, "votingOpened", PUBLIC, { roundId: r.id, kind: r.kind });
}

function openVoting(ctx: Ctx): void {
  requireHost(ctx);
  requirePhase(ctx, "CIRCLE_DEBATE");
  startCircleVote(ctx);
  log(ctx, "Opened voting");
}

function requireOpenPlayerRound(ctx: Ctx): VoteRound {
  const r = currentRound(ctx.s);
  if (!r || r.status !== "open" || !PLAYER_VOTE_KINDS.includes(r.kind)) fail("There's no vote open right now.");
  return r;
}

function castVote(ctx: Ctx, a: ActionOf<"castVote">): void {
  const p = requireActingPlayer(ctx);
  requireNotPaused(ctx);
  const { s } = ctx;
  const r = requireOpenPlayerRound(ctx);
  if (r.ballots.some((b) => b.voterId === p.id)) fail("Your vote is already in. Votes can't be changed.");
  let ghost: boolean;
  if (isAlive(p)) {
    if (!r.eligibleVoterIds.includes(p.id)) fail("You can't vote in this round.");
    ghost = false;
  } else {
    if (p.ghostVoteUsed) fail("You've already used your ghost vote.");
    if (r.kind !== "circle") fail("A ghost vote can only be used at a standard Circle.");
    if (!s.settings.ghostVote || !r.ghostVoterIds.includes(p.id)) fail("Ghosts can't vote in this round.");
    ghost = true;
  }
  if (a.targetId === p.id) fail("You can't vote for yourself.");
  if (!r.candidateIds.includes(a.targetId)) fail("Vote for one of the players on the ballot.");
  if (!isAlive(getPlayer(s, a.targetId))) fail(`${nameOf(s, a.targetId)} is no longer in the game.`);
  const b = ballot(p.id, a.targetId, null, ctx.at);
  if (a.useDagger) {
    if (ghost) fail("Ghosts don't hold daggers.");
    if (r.kind !== "circle") fail("A dagger can only be used at a standard Circle, not in a revote or the End Game.");
    const dagger = heldItem(s, p.id, "dagger");
    if (!dagger) fail("You don't hold a dagger.");
    dagger.state = "used";
    dagger.usedRoundId = r.id;
    b.usedDagger = true;
    b.weight = s.settings.daggerWeight;
  }
  if (ghost) {
    p.ghostVoteUsed = true;
    b.ghost = true;
  }
  r.ballots.push(b);
  log(ctx, `${p.displayName} voted${ghost ? " (ghost vote)" : ""}${b.usedDagger ? " with a dagger" : ""}`);
  maybeAutoLock(ctx, r);
}

function castEndgameVote(ctx: Ctx, a: ActionOf<"castEndgameVote">): void {
  const p = requireActingPlayer(ctx);
  requireNotPaused(ctx);
  const r = currentRound(ctx.s);
  if (!r || r.kind !== "endgame" || r.status !== "open") fail("There's no End Game vote open.");
  if (!isAlive(p) || !r.eligibleVoterIds.includes(p.id)) fail("Only living players vote in the End Game.");
  if (r.ballots.some((b) => b.voterId === p.id)) fail("Your vote is already in. Votes can't be changed.");
  if (a.choice !== "end" && a.choice !== "banish") fail("Vote End or Banish.");
  r.ballots.push(ballot(p.id, null, a.choice, ctx.at));
  log(ctx, `${p.displayName} voted in the End Game`);
  maybeAutoLock(ctx, r);
}

/** Closes voting by itself once every living ballot is in and no ghost could still vote. */
function maybeAutoLock(ctx: Ctx, r: VoteRound): void {
  const { s } = ctx;
  const hasBallot = (id: string) => r.ballots.some((b) => b.voterId === id);
  const living = r.eligibleVoterIds.filter((id) => isAlive(getPlayer(s, id)));
  if (!living.every(hasBallot)) return;
  const ghostsPending = s.settings.ghostVote
    ? r.ghostVoterIds.filter((id) => !hasBallot(id) && !getPlayer(s, id).ghostVoteUsed)
    : [];
  if (ghostsPending.length === 0) lockRound(ctx, r);
}

function lockRound(ctx: Ctx, r: VoteRound): void {
  const { s } = ctx;
  r.status = "revealing";
  r.lockedAt = ctx.at;
  r.revealOrder = shuffle(
    r.ballots.map((b) => b.voterId),
    rand(s, `reveal:${r.id}`),
  );
  r.revealedCount = 0;
  setTimer(s, ctx.at, null);
  if (r.kind === "circle" || r.kind === "revote") s.phase = "CIRCLE_REVEAL";
  const abstained = r.eligibleVoterIds.filter(
    (id) => isAlive(getPlayer(s, id)) && !r.ballots.some((b) => b.voterId === id),
  );
  emit(ctx, "votingLocked", PUBLIC, { roundId: r.id, ballots: r.ballots.length, abstained: abstained.length });
}

function lockVoting(ctx: Ctx): void {
  requireHost(ctx);
  const r = currentRound(ctx.s);
  if (!r || r.status !== "open") fail("There's no vote open.");
  if (r.kind === "reward") fail("Use the reward vote's own close button.");
  const missing = r.eligibleVoterIds.filter(
    (id) => isAlive(getPlayer(ctx.s, id)) && !r.ballots.some((b) => b.voterId === id),
  );
  log(ctx, `Locked voting${missing.length ? `; abstained: ${names(ctx.s, missing)}` : ""}`);
  lockRound(ctx, r);
}

function setBallot(ctx: Ctx, a: ActionOf<"setBallot">): void {
  requireHost(ctx);
  requireDealt(ctx);
  const { s } = ctx;
  const reason = requireReason(a.reason);
  const r = currentRound(s);
  if (!r || r.kind === "reward" || (r.status !== "open" && r.status !== "revealing")) {
    fail("There's no vote to enter a ballot in.");
  }
  const voter = getPlayer(s, a.voterId);
  if (!isAlive(voter) || !r.eligibleVoterIds.includes(voter.id)) fail(`${voter.displayName} isn't a voter in this round.`);
  let targetId: string | null = null;
  let choice: "end" | "banish" | null = null;
  if (r.kind === "endgame") {
    if (a.choice !== "end" && a.choice !== "banish") fail("Pick End or Banish.");
    choice = a.choice;
  } else {
    if (!a.targetId || !r.candidateIds.includes(a.targetId)) fail("Pick a player on the ballot.");
    if (a.targetId === voter.id) fail("A player can't vote for themselves.");
    if (!isAlive(getPlayer(s, a.targetId))) fail(`${nameOf(s, a.targetId)} is no longer in the game.`);
    targetId = a.targetId;
  }
  const existing = r.ballots.find((b) => b.voterId === voter.id);
  if (existing) {
    existing.targetId = targetId;
    existing.choice = choice;
    existing.enteredByHost = true;
  } else {
    r.ballots.push({ ...ballot(voter.id, targetId, choice, ctx.at), enteredByHost: true });
    if (r.status === "revealing") r.revealOrder.push(voter.id);
  }
  const what = choice ?? nameOf(s, targetId!);
  log(ctx, `${existing ? "Corrected" : "Entered"} ${voter.displayName}'s ballot: ${what}`, { reason, override: true });
  if (r.status === "open") maybeAutoLock(ctx, r);
}

function rerunVote(ctx: Ctx, a: ActionOf<"rerunVote">): void {
  requireHost(ctx);
  requireDealt(ctx);
  const { s } = ctx;
  const reason = requireReason(a.reason);
  const r = currentRound(s);
  if (!r || r.kind === "reward" || r.status === "done") fail("There's no vote to rerun.");
  for (const b of r.ballots) {
    if (b.usedDagger) {
      const dagger = s.items.find((i) => i.usedRoundId === r.id && i.holderId === b.voterId);
      if (dagger) {
        dagger.usedRoundId = null;
        const holder = getPlayer(s, b.voterId);
        // Never two of the same: if the host gave them another dagger meanwhile, the voided one expires.
        dagger.state = !isAlive(holder) ? "lost" : heldItem(s, holder.id, "dagger") ? "expired" : "held";
      }
    }
    if (b.ghost) getPlayer(s, b.voterId).ghostVoteUsed = false;
  }
  r.eligibleVoterIds = r.eligibleVoterIds.filter((id) => isAlive(getPlayer(s, id)));
  r.ballots = [];
  r.status = "open";
  r.openedAt = ctx.at;
  r.lockedAt = null;
  r.revealOrder = [];
  r.revealedCount = 0;
  r.totals = null;
  r.result = null;
  setTimer(s, ctx.at, s.settings.voteSeconds);
  if (r.kind === "circle" || r.kind === "revote") s.phase = "CIRCLE_VOTE";
  emit(ctx, "voteRerun", PUBLIC, { roundId: r.id });
  log(ctx, "Reran the vote; every ballot was cleared", { reason, override: true });
}

function requireRevealingRound(ctx: Ctx): VoteRound {
  const r = currentRound(ctx.s);
  if (!r || r.status !== "revealing") fail("There's no vote being revealed.");
  return r;
}

function revealNextBallot(ctx: Ctx): void {
  requireHost(ctx);
  const r = requireRevealingRound(ctx);
  if (r.revealedCount >= r.ballots.length) fail("Every ballot is already shown.");
  r.revealedCount += 1;
  log(ctx, `Revealed ballot ${r.revealedCount} of ${r.ballots.length}`);
}

function finishReveal(ctx: Ctx): void {
  requireHost(ctx);
  const { s } = ctx;
  const r = requireRevealingRound(ctx);
  r.revealedCount = r.ballots.length;
  if (r.kind === "endgame") {
    const living = r.eligibleVoterIds.filter((id) => isAlive(getPlayer(s, id)));
    const choiceOf = (id: string) => r.ballots.find((b) => b.voterId === id)?.choice;
    const unanimous = living.length > 0 && living.every((id) => choiceOf(id) === "end");
    r.totals = {
      end: r.ballots.filter((b) => b.choice === "end").length,
      banish: r.ballots.filter((b) => b.choice === "banish").length,
    };
    r.status = "done";
    s.currentRoundId = null;
    r.result = unanimous ? { outcome: "end" } : { outcome: "continue" };
    emit(ctx, "endgameResult", PUBLIC, { roundId: r.id, end: unanimous });
    log(ctx, unanimous ? "End Game: everyone voted End" : "End Game: not unanimous, so one more banishment");
    if (unanimous) finale(ctx, "Everyone voted to end the game.");
    else startEndgameBanish(ctx);
    return;
  }
  const candidates = r.candidateIds.filter((id) => isAlive(getPlayer(s, id)));
  const totals = tally(r, candidates);
  r.totals = totals;
  if (!candidates.length) fail("Nobody on the ballot is still in the game.");
  const max = Math.max(...candidates.map((id) => totals[id]));
  const top = candidates.filter((id) => totals[id] === max);
  if (top.length === 1) {
    log(ctx, `Reveal finished: ${nameOf(s, top[0])} has the most votes`);
    banish(ctx, r, top[0], "votes", []);
    return;
  }
  const method: TieMethod =
    s.settings.tieRule === "hostDecides"
      ? "host"
      : s.settings.tieRule === "spin"
        ? "spin"
        : tiesInChain(s, r) <= s.settings.tieRevotesBeforeChoice
          ? "revote"
          : "choose";
  r.status = "tied";
  r.result = { outcome: "tie", tiedIds: top, method };
  emit(ctx, "tie", PUBLIC, { roundId: r.id, tiedIds: top, method });
  log(ctx, `Tie between ${names(s, top)}; next: ${method}`);
}

/** How many tied votes in a row this tie is: the original vote plus each revote after it. */
function tiesInChain(s: GameState, r: VoteRound): number {
  let n = 1;
  let parent = r.parentRoundId;
  while (parent) {
    n += 1;
    parent = s.rounds.find((x) => x.id === parent)?.parentRoundId ?? null;
  }
  return n;
}

function requireTiedRound(ctx: Ctx): VoteRound & { result: { outcome: "tie"; tiedIds: string[]; method: TieMethod } } {
  const r = currentRound(ctx.s);
  if (!r || r.status !== "tied" || r.result?.outcome !== "tie") fail("There's no tie to settle.");
  return r as VoteRound & { result: { outcome: "tie"; tiedIds: string[]; method: TieMethod } };
}

function startRevote(ctx: Ctx): void {
  requireHost(ctx);
  const { s } = ctx;
  const r = requireTiedRound(ctx);
  if (r.result.method !== "revote" && r.result.method !== "choose") fail("This tie isn't settled by a revote.");
  const candidates = r.result.tiedIds.filter((id) => isAlive(getPlayer(s, id)));
  if (candidates.length === 1) {
    // The others in the tie have left the game, so the one still in had the most votes among those left.
    log(ctx, `Only ${nameOf(s, candidates[0])} is left of the tie`);
    banish(ctx, r, candidates[0], "votes", r.result.tiedIds);
    return;
  }
  if (candidates.length === 0) fail("Nobody in the tie is still in the game. Rerun the vote from the Fix tab.");
  r.status = "done";
  const kind: VoteKind = r.kind === "circle" || r.kind === "revote" ? "revote" : "endgameRevote";
  const next = openRound(ctx, kind, {
    voters: aliveIds(s),
    candidates,
    parent: r.id,
    seconds: s.settings.voteSeconds,
  });
  if (kind === "revote") s.phase = "CIRCLE_VOTE";
  emit(ctx, "revoteOpened", PUBLIC, { roundId: next.id, candidateIds: candidates });
  log(ctx, `Opened a revote between ${names(s, candidates)}`);
}

function spinTie(ctx: Ctx): void {
  requireHost(ctx);
  const { s } = ctx;
  const r = requireTiedRound(ctx);
  if (r.result.method !== "spin" && r.result.method !== "choose") fail("This tie isn't settled by a spin.");
  const tied = r.result.tiedIds;
  const candidates = tied.filter((id) => isAlive(getPlayer(s, id)));
  if (!candidates.length) fail("Nobody in the tie is still in the game.");
  const chosen = pickOne(candidates, rand(s, `spin:${r.id}`));
  emit(ctx, "spin", PUBLIC, { roundId: r.id, tiedIds: candidates, playerId: chosen });
  log(ctx, `Spin between ${names(s, candidates)}: ${nameOf(s, chosen)}`);
  banish(ctx, r, chosen, "spin", tied);
}

function decideTie(ctx: Ctx, a: ActionOf<"decideTie">): void {
  requireHost(ctx);
  const { s } = ctx;
  const r = requireTiedRound(ctx);
  const tied = r.result.tiedIds;
  if (!tied.includes(a.playerId)) fail("Pick one of the tied players.");
  if (!isAlive(getPlayer(s, a.playerId))) fail(`${nameOf(s, a.playerId)} is no longer in the game.`);
  const override = r.result.method !== "host";
  const reason = override ? requireReason(a.reason) : (a.reason ?? "").trim() || null;
  log(ctx, `Host settled the tie: ${nameOf(s, a.playerId)}`, { reason, override });
  banish(ctx, r, a.playerId, "host", tied);
}

function banish(ctx: Ctx, r: VoteRound, playerId: string, via: "votes" | "spin" | "host", tiedIds: string[]): void {
  const { s } = ctx;
  r.status = "done";
  r.result = { outcome: "banish", playerId, via, tiedIds };
  s.currentRoundId = null;
  setTimer(s, ctx.at, null);
  const p = getPlayer(s, playerId);
  p.status = "banished";
  p.eliminatedDay = s.day;
  loseItems(s, p.id, null);
  emit(ctx, "banished", PUBLIC, { playerId, roundId: r.id, via, role: revealedRole(s, playerId) });
  afterBanishment(ctx);
}

/** Win check after every banishment (section 5.2). */
function afterBanishment(ctx: Ctx): void {
  const { s } = ctx;
  if (aliveTraitorIds(s).length === 0) return finale(ctx, "Every Traitor has been banished.");
  if (alivePlayers(s).length <= 2) return finale(ctx, "Only two players are left.");
  if (s.endgameStarted || alivePlayers(s).length <= endGameThreshold(s)) {
    const first = !s.endgameStarted;
    s.endgameStarted = true;
    return startEndgameVote(ctx, first);
  }
  startNight(ctx);
}

function startEndgameVote(ctx: Ctx, first: boolean): void {
  const { s } = ctx;
  const r = openRound(ctx, "endgame", { voters: aliveIds(s), candidates: [], seconds: s.settings.voteSeconds });
  s.phase = "ENDGAME_VOTE";
  emit(ctx, first ? "endgameStarted" : "endgameVoteOpened", PUBLIC, { roundId: r.id });
}

function startEndgameBanish(ctx: Ctx): void {
  const { s } = ctx;
  const alive = aliveIds(s);
  const r = openRound(ctx, "endgameBanish", { voters: alive, candidates: alive, seconds: s.settings.voteSeconds });
  s.phase = "ENDGAME_BANISH";
  emit(ctx, "endgameBanishOpened", PUBLIC, { roundId: r.id });
}

// ---------------------------------------------------------------------------
// Night

function startNight(ctx: Ctx): void {
  const { s } = ctx;
  const n: NightRound = {
    id: newId(s, "n"),
    day: s.day,
    picks: {},
    mode: null,
    recruit: null,
    suspectAnswers: {},
    resolved: false,
    targetId: null,
    victimId: null,
    reason: null,
    revealed: false,
  };
  s.nights.push(n);
  s.phase = "NIGHT";
  setTimer(s, ctx.at, s.settings.nightSeconds);
  emit(ctx, "nightFell", PUBLIC, { nightId: n.id });
}

function recruitmentAvailable(s: GameState): boolean {
  return s.settings.recruitment === "lastTraitor" && aliveTraitorIds(s).length === 1;
}

function requireActiveNight(ctx: Ctx): NightRound {
  requirePhase(ctx, "NIGHT");
  const n = activeNight(ctx.s);
  if (!n) fail("The night is over.");
  return n;
}

function nightPick(ctx: Ctx, a: ActionOf<"nightPick">): void {
  const p = requireActingPlayer(ctx);
  requireNotPaused(ctx);
  const { s } = ctx;
  const n = requireActiveNight(ctx);
  if (!isAlive(p) || s.roles[p.id] !== "traitor") fail("Only a living Traitor can pick at night.");
  if (n.recruit) fail("You've already sent a recruitment offer tonight.");
  const target = getPlayer(s, a.targetId);
  if (target.id === p.id) fail("You can't pick yourself.");
  if (!isAlive(target)) fail(`${target.displayName} is no longer in the game.`);
  const mode = a.mode ?? "murder";
  if (mode === "recruit") {
    if (!recruitmentAvailable(s)) fail("Recruitment isn't available tonight.");
    if (s.roles[target.id] !== "innocent") fail("You can only recruit an Innocent.");
    n.mode = "recruit";
    n.picks = {};
    n.recruit = {
      traitorId: p.id,
      targetId: target.id,
      offeredAt: ctx.at,
      deadline: ctx.at + s.settings.recruitOfferSeconds * 1000,
      answer: null,
    };
    setTimer(s, ctx.at, s.settings.recruitOfferSeconds);
    emit(ctx, "recruitOffer", toPlayer(target.id), { deadline: n.recruit.deadline });
    log(ctx, `${p.displayName} offered to recruit ${target.displayName}`);
    return;
  }
  if (mode !== "murder") fail("Pick Murder or Recruit.");
  if (s.roles[target.id] === "traitor" && !s.settings.allowTraitorOnTraitor) fail("You can only pick an Innocent.");
  n.picks[p.id] = target.id;
  if (recruitmentAvailable(s)) n.mode = "murder";
  log(ctx, `${p.displayName} picked ${target.displayName}`);
  if (aliveTraitorIds(s).every((id) => n.picks[id])) resolveNight(ctx, n, null);
}

function answerRecruit(ctx: Ctx, a: ActionOf<"answerRecruit">): void {
  const p = requireActingPlayer(ctx);
  requireNotPaused(ctx);
  const n = requireActiveNight(ctx);
  if (!n.recruit || n.recruit.targetId !== p.id || n.recruit.answer) fail("There's no offer waiting for you.");
  if (ctx.at > n.recruit.deadline) fail("This offer has run out.");
  n.recruit.answer = a.accept ? "accepted" : "refused";
  log(ctx, `${p.displayName} ${a.accept ? "accepted" : "refused"} the offer`);
  resolveNight(ctx, n, null);
}

function suspectAnswer(ctx: Ctx, a: ActionOf<"suspectAnswer">): void {
  const p = requireActingPlayer(ctx);
  requireNotPaused(ctx);
  const { s } = ctx;
  const n = requireActiveNight(ctx);
  if (!s.settings.suspectPoll) fail("The suspect poll is switched off.");
  if (!isAlive(p)) fail("Only living players answer the poll.");
  if (s.roles[p.id] === "traitor") fail("Traitors make their pick instead.");
  if (a.targetId === p.id) fail("Pick someone other than yourself.");
  if (!isAlive(getPlayer(s, a.targetId))) fail(`${nameOf(s, a.targetId)} is no longer in the game.`);
  n.suspectAnswers[p.id] = a.targetId;
}

function sendChat(ctx: Ctx, a: ActionOf<"sendChat">): void {
  const p = requireActingPlayer(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const { s } = ctx;
  if (!s.settings.traitorChat) fail("Traitor chat is switched off.");
  if (!isAlive(p) || s.roles[p.id] !== "traitor") fail("Only living Traitors can use the chat.");
  const text = typeof a.text === "string" ? a.text.trim() : "";
  if (!text) fail("Write something first.");
  if (text.length > 500) fail("Keep messages under 500 characters.");
  s.chat.push({ id: newId(s, "c"), at: ctx.at, authorId: p.id, text });
}

/** Section 5.4, steps 1 to 4. */
function chooseNightTarget(s: GameState, n: NightRound): { target: string | null; reason: NightReason } {
  const traitors = aliveTraitorIds(s);
  const valid: string[] = [];
  for (const t of traitors) {
    const target = n.picks[t];
    if (!target || target === t) continue;
    const tp = s.players.find((p) => p.id === target);
    if (!tp || !isAlive(tp)) continue;
    if (s.roles[target] === "traitor") {
      if (!s.settings.allowTraitorOnTraitor) continue;
      const others = traitors.filter((x) => x !== target);
      if (!others.every((o) => n.picks[o] === target)) continue;
    }
    valid.push(target);
  }
  if (!valid.length) return { target: null, reason: "noValidPicks" };
  if (s.settings.murderRule === "unanimous") {
    const candidates = [...new Set(valid)];
    const agreed = candidates.find((c) => traitors.filter((t) => t !== c).every((t) => n.picks[t] === c));
    return agreed ? { target: agreed, reason: "murdered" } : { target: null, reason: "notUnanimous" };
  }
  const counts = new Map<string, number>();
  for (const t of valid) counts.set(t, (counts.get(t) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const top = [...counts.keys()].filter((k) => counts.get(k) === max).sort();
  const target = top.length === 1 ? top[0] : pickOne(top, rand(s, `night:${n.id}`));
  return { target, reason: "murdered" };
}

/** Section 5.4: picks or recruitment, then the shield check, then shields expire. */
function resolveNight(ctx: Ctx, n: NightRound, hostChoice: { targetId: string | null } | null): void {
  const { s } = ctx;
  let target: string | null = null;
  let reason: NightReason;
  if (n.recruit && !n.recruit.answer) n.recruit.answer = "timeout";
  if (hostChoice) {
    target = hostChoice.targetId;
    reason = "host";
  } else if (n.mode === "recruit" && n.recruit) {
    const { answer, targetId } = n.recruit;
    if (answer === "accepted" && isAlive(getPlayer(s, targetId))) {
      s.roles[targetId] = "traitor";
      s.roleSeen[targetId] = false;
      emit(ctx, "recruited", toPlayer(targetId), {});
      emit(ctx, "newTraitor", TRAITORS, { playerId: targetId });
      reason = "recruitAccepted";
    } else {
      reason = answer === "refused" ? "recruitRefused" : "recruitTimeout";
    }
  } else {
    const chosen = chooseNightTarget(s, n);
    target = chosen.target;
    reason = chosen.reason;
  }
  n.targetId = target;
  let victim: string | null = null;
  if (target) {
    const shield = heldItem(s, target, "shield");
    if (shield) {
      shield.state = "used";
      reason = "shield";
    } else {
      victim = target;
      const p = getPlayer(s, target);
      p.status = "murdered";
      p.eliminatedDay = n.day;
      loseItems(s, target, n.id);
      if (!hostChoice) reason = "murdered";
    }
  }
  for (const i of s.items) if (i.type === "shield" && i.state === "held") i.state = "expired";
  n.victimId = victim;
  n.reason = reason;
  n.resolved = true;
  emit(ctx, "nightResolved", HOST, { nightId: n.id, targetId: target, victimId: victim, reason });
  s.day += 1;
  s.phase = "MURDER_REVEAL";
  setTimer(s, ctx.at, null);
  emit(ctx, "dawn", PUBLIC, {});
}

function resolveNightByHost(ctx: Ctx, a: ActionOf<"resolveNight">): void {
  requireHost(ctx);
  const n = requireActiveNight(ctx);
  if (a.targetId !== undefined) {
    const reason = requireReason(a.reason);
    if (a.targetId !== null && !isAlive(getPlayer(ctx.s, a.targetId))) fail(`${nameOf(ctx.s, a.targetId)} is no longer in the game.`);
    log(ctx, `Resolved the night by hand: ${a.targetId ? nameOf(ctx.s, a.targetId) : "nobody"}`, { reason, override: true });
    resolveNight(ctx, n, { targetId: a.targetId });
  } else {
    log(ctx, "Ended the night early with the current picks");
    resolveNight(ctx, n, null);
  }
}

function revealMurder(ctx: Ctx): void {
  requireHost(ctx);
  requirePhase(ctx, "MURDER_REVEAL");
  const { s } = ctx;
  const n = lastNight(s);
  if (!n || !n.resolved) fail("The night hasn't ended.");
  if (n.revealed) fail("The murder has already been revealed.");
  n.revealed = true;
  emit(ctx, "murderRevealed", PUBLIC, {
    nightId: n.id,
    victimId: n.victimId,
    role: n.victimId ? revealedRole(s, n.victimId) : null,
  });
  log(ctx, n.victimId ? `Revealed the murder of ${nameOf(s, n.victimId)}` : "Revealed that nobody died");
  // Post-murder check (section 5.2).
  if (aliveTraitorIds(s).length === 0) return finale(ctx, "No Traitors are left.");
  if (alivePlayers(s).length <= 2) finale(ctx, "Only two players are left.");
}

// ---------------------------------------------------------------------------
// Timers and pause

function tick(ctx: Ctx): void {
  const { s } = ctx;
  if (s.paused) fail("The game is paused.");
  if (s.deadline === null || ctx.at < s.deadline) fail("The timer hasn't run out yet.");
  switch (s.phase) {
    case "CIRCLE_DEBATE":
      log(ctx, "Debate timer ran out; voting opened");
      startCircleVote(ctx);
      return;
    case "CIRCLE_VOTE":
    case "ENDGAME_VOTE":
    case "ENDGAME_BANISH": {
      const r = currentRound(s);
      if (r && r.status === "open") {
        log(ctx, "Voting timer ran out; missing ballots count as abstentions");
        lockRound(ctx, r);
        return;
      }
      break;
    }
    case "NIGHT": {
      const n = activeNight(s);
      if (n) {
        log(ctx, n.recruit && !n.recruit.answer ? "Recruit offer timed out" : "Night timer ran out");
        resolveNight(ctx, n, null);
        return;
      }
      break;
    }
    case "MISSION": {
      const r = currentRound(s);
      if (r && r.kind === "reward" && r.status === "open") {
        log(ctx, "Reward vote timer ran out");
        resolveRewardVote(ctx, r);
        return;
      }
      break;
    }
  }
  fail("Nothing is waiting on a timer.");
}

function pause(ctx: Ctx): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const { s } = ctx;
  if (s.paused) fail("The game is already paused.");
  s.paused = true;
  s.pausedAt = ctx.at;
  if (s.deadline !== null) {
    s.pausedRemainingMs = Math.max(0, s.deadline - ctx.at);
    s.deadline = null;
  }
  emit(ctx, "paused", PUBLIC, {});
  log(ctx, "Paused the game");
}

function resume(ctx: Ctx): void {
  requireHost(ctx);
  const { s } = ctx;
  if (!s.paused) fail("The game isn't paused.");
  const pausedFor = ctx.at - (s.pausedAt ?? ctx.at);
  s.paused = false;
  s.pausedAt = null;
  if (s.pausedRemainingMs !== null) {
    s.deadline = ctx.at + s.pausedRemainingMs;
    s.pausedRemainingMs = null;
  }
  const n = activeNight(s);
  if (n?.recruit && !n.recruit.answer) n.recruit.deadline += pausedFor;
  emit(ctx, "resumed", PUBLIC, {});
  log(ctx, "Resumed the game");
}

function adjustTimer(ctx: Ctx, a: ActionOf<"adjustTimer">): void {
  requireHost(ctx);
  const { s } = ctx;
  const d = a.deltaSeconds;
  if (!Number.isInteger(d) || d === 0 || Math.abs(d) > 3600) fail("Change the timer by 1 second to 1 hour.");
  if (s.paused) {
    if (s.pausedRemainingMs === null) fail("There's no timer running.");
    s.pausedRemainingMs = Math.max(0, s.pausedRemainingMs + d * 1000);
  } else {
    if (s.deadline === null) fail("There's no timer running.");
    s.deadline = Math.max(ctx.at, s.deadline + d * 1000);
  }
  const n = activeNight(s);
  if (n?.recruit && !n.recruit.answer) n.recruit.deadline = Math.max(ctx.at, n.recruit.deadline + d * 1000);
  emit(ctx, "timerChanged", PUBLIC, { deltaSeconds: d });
  log(ctx, `${d > 0 ? "Extended" : "Shortened"} the timer by ${Math.abs(d)} seconds`);
}

// ---------------------------------------------------------------------------
// Host overrides

function instantChecks(ctx: Ctx): boolean {
  const { s } = ctx;
  if (aliveTraitorIds(s).length === 0) {
    finale(ctx, "No Traitors are left.");
    return true;
  }
  if (alivePlayers(s).length <= 2) {
    finale(ctx, "Only two players are left.");
    return true;
  }
  return false;
}

function eliminatePlayer(ctx: Ctx, a: ActionOf<"eliminatePlayer">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const { s } = ctx;
  const reason = requireReason(a.reason);
  if (!["murdered", "banished", "left"].includes(a.status)) fail("Pick murdered, banished or left the game.");
  const p = getPlayer(s, a.playerId);
  if (!isAlive(p)) fail(`${p.displayName} is already out.`);
  p.status = a.status;
  p.eliminatedDay = s.day;
  loseItems(s, p.id, null);
  const n = activeNight(s);
  if (n) {
    delete n.picks[p.id];
    if (n.recruit && !n.recruit.answer && (n.recruit.targetId === p.id || n.recruit.traitorId === p.id)) {
      n.recruit.answer = "timeout";
    }
  }
  emit(ctx, "playerEliminated", PUBLIC, { playerId: p.id, status: a.status, role: revealedRole(s, p.id) });
  log(ctx, `Marked ${p.displayName} as ${a.status === "left" ? "having left the game" : a.status}`, {
    reason,
    override: true,
  });
  if (instantChecks(ctx)) return;
  const r = currentRound(s);
  if (r && r.status === "open" && r.kind !== "reward") maybeAutoLock(ctx, r);
}

function revivePlayer(ctx: Ctx, a: ActionOf<"revivePlayer">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const reason = requireReason(a.reason);
  const p = getPlayer(ctx.s, a.playerId);
  if (isAlive(p)) fail(`${p.displayName} is already in the game.`);
  p.status = "alive";
  p.eliminatedDay = null;
  emit(ctx, "playerRevived", PUBLIC, { playerId: p.id });
  log(ctx, `Revived ${p.displayName}`, { reason, override: true });
}

function setRole(ctx: Ctx, a: ActionOf<"setRole">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const { s } = ctx;
  const reason = requireReason(a.reason);
  if (a.role !== "innocent" && a.role !== "traitor") fail("Unknown role.");
  const p = getPlayer(s, a.playerId);
  if (s.roles[p.id] === a.role) fail(`${p.displayName} is already ${a.role === "traitor" ? "a Traitor" : "an Innocent"}.`);
  s.roles[p.id] = a.role;
  s.roleSeen[p.id] = false;
  emit(ctx, "roleChanged", toPlayer(p.id), {});
  log(ctx, `Changed ${p.displayName}'s role to ${a.role}`, { reason, override: true });
  instantChecks(ctx);
}

function endGameEarly(ctx: Ctx, a: ActionOf<"endGameEarly">): void {
  requireHost(ctx);
  requireDealt(ctx);
  requireNotFinale(ctx);
  const reason = requireReason(a.reason);
  log(ctx, "Ended the game early", { reason, override: true });
  finale(ctx, "The host ended the game early.", true);
}

function revealFinale(ctx: Ctx): void {
  requireHost(ctx);
  requirePhase(ctx, "FINALE");
  const f = ctx.s.finale!;
  if (f.revealed) fail("The result is already revealed.");
  f.revealed = true;
  emit(ctx, "finale", PUBLIC, { winner: f.winner, winnerIds: f.winnerIds, reason: f.reason, early: f.early });
  log(ctx, `Revealed the result: the ${f.winner === "traitors" ? "Traitors" : "Innocents"} win`);
}

function closeGame(ctx: Ctx): void {
  requireHost(ctx);
  requirePhase(ctx, "FINALE");
  if (!ctx.s.finale?.revealed) fail("Reveal the result first.");
  ctx.s.closed = true;
  emit(ctx, "closed", PUBLIC, {});
  log(ctx, "Closed the game");
}

// ---------------------------------------------------------------------------
// Finale (section 5.3)

function finale(ctx: Ctx, reason: string, early = false): void {
  const { s } = ctx;
  const traitorsAlive = aliveTraitorIds(s).length > 0;
  const winner: Team = traitorsAlive ? "traitors" : "innocents";
  const winRole: Role = traitorsAlive ? "traitor" : "innocent";
  const winnerIds = s.players
    .filter((p) => s.roles[p.id] === winRole && (s.settings.eliminatedWinWithTeam || isAlive(p)))
    .map((p) => p.id);
  const suspicion: Record<string, number> = {};
  for (const n of s.nights) {
    for (const target of Object.values(n.suspectAnswers)) suspicion[target] = (suspicion[target] ?? 0) + 1;
  }
  const r = currentRound(s);
  if (r && r.status !== "done") r.status = "done";
  s.currentRoundId = null;
  closeMission(ctx);
  const n = lastNight(s);
  if (n?.resolved) n.revealed = true;
  s.finale = { revealed: false, winner, winnerIds, reason, early, endedAt: ctx.at, suspicion };
  s.phase = "FINALE";
  s.paused = false;
  s.pausedAt = null;
  setTimer(s, ctx.at, null);
  // Only the host learns the result now; everyone else sees it when the host reveals it.
  emit(ctx, "gameOver", HOST, { winner, reason, early });
}

// ---------------------------------------------------------------------------
// Undo (section 4.3: the host can undo the last step)

/** Steps the host may not undo, because they changed things outside the game state (PINs, photos). */
export const NOT_UNDOABLE: ReadonlySet<string> = new Set(["claimSeat", "resetSeat", "setPhoto", "revealFinale", "closeGame"]);

/**
 * Builds the next state for an undo: the game exactly as it was at `target`, but as a new version,
 * with the full action log kept plus an entry for the undo. Timers resume with the time they had then.
 * Pure: the server supplies both states and how long ago `target` was saved.
 */
export function undoState(
  current: GameState,
  target: GameState,
  o: { at: number; reason: string; summary: string; targetSavedAt: number },
): GameState {
  if (current.finale?.revealed) throw new Error("The result is revealed; undo is off.");
  const reason = o.reason.trim();
  if (!reason) throw new Error("Give a reason; it goes in the action log.");
  const next = structuredClone(target);
  next.version = current.version + 1;
  next.nextId = Math.max(current.nextId, target.nextId);
  const shift = Math.max(0, o.at - o.targetSavedAt);
  if (next.deadline !== null) next.deadline += shift;
  const n = next.nights[next.nights.length - 1];
  if (n?.recruit && !n.recruit.answer) n.recruit.deadline += shift;
  next.log = [
    ...structuredClone(current.log),
    {
      id: `l${next.nextId++}`,
      at: o.at,
      day: next.day,
      phase: current.phase,
      actor: { kind: "host" },
      action: "undo",
      summary: `Undid: ${o.summary}`,
      reason: reason.slice(0, 300),
      override: true,
    },
  ];
  next.events.push({ id: `e${next.nextId++}`, at: o.at, day: next.day, audience: { kind: "public" }, type: "undone", data: {} });
  return next;
}
