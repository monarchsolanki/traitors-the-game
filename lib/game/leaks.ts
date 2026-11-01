import { isVisibleGhost } from "./ghosts";
import type { GameState, Viewer } from "./types";
import { viewFor } from "./view";

/**
 * Checks one viewer's view of a state against the privacy model (section 9.4).
 * Returns a list of problems; empty means no secret reached a screen that may not see it.
 */
export function findLeaks(s: GameState, viewer: Viewer): string[] {
  const v = viewFor(s, viewer);
  const json = JSON.stringify(v);
  const problems: string[] = [];
  const add = (msg: string) => problems.push(`${viewer.kind}${viewer.kind === "player" ? `:${viewer.playerId}` : ""}: ${msg}`);

  if (s.seed && json.includes(`"${s.seed}"`)) add("the random seed leaked");
  if (viewer.kind === "host") return problems;

  const finale = s.phase === "FINALE" && !!s.finale?.revealed;
  if (!finale && v.finale) add("result shown before the host revealed it");
  const lastNight = s.nights[s.nights.length - 1];
  const pendingVictim = !finale && lastNight?.resolved && !lastNight.revealed ? lastNight.victimId : null;
  const me = viewer.kind === "player" ? viewer.playerId : null;
  const meStatus = me ? (me === pendingVictim ? "alive" : s.players.find((p) => p.id === me)!.status) : null;
  const meAliveTraitor = !!me && meStatus === "alive" && s.roles[me] === "traitor";

  if (v.host) add("host secrets present");
  if (v.cohost && viewer.kind !== "cohost") add("co-host data present");
  if (v.traitor && !meAliveTraitor) add("Traitor block shown to a non-Traitor or a ghost");
  if (v.me && v.me.playerId !== me) add("someone else's 'me' block");
  if (v.me && v.me.role !== (s.frozen ? s.roles[me!] ?? null : null)) add("wrong own role");

  for (const p of v.players) {
    if (p.role === null) continue;
    const allowed = finale || (s.settings.revealOnElimination && p.status !== "alive" && !!s.frozen);
    if (!allowed) add(`role of ${p.id} shown`);
  }
  if (pendingVictim) {
    const pv = v.players.find((p) => p.id === pendingVictim)!;
    if (pv.status !== "alive") add("murder victim shown before the reveal");
    if (v.night?.victimId) add("night victim shown before the reveal");
  }

  if (!v.traitor) {
    for (const c of s.chat) if (json.includes(c.text)) add("Traitor chat text leaked");
    if (json.includes('"picks"') || json.includes('"pickStatus"')) add("night picks leaked");
  }
  if (json.includes('"suspectAnswers"')) add("suspect-poll answers leaked");
  if (v.me?.suspectPoll && lastNight && v.me.suspectPoll.myAnswer !== (lastNight.suspectAnswers[me!] ?? null)) {
    add("someone else's poll answer");
  }
  if (json.includes('"reason":"shield"') || json.includes('"recruitAccepted"') || json.includes('"recruitRefused"') || json.includes('"blackmailRefused"') || json.includes('"blackmailTimeout"')) {
    add("why nobody died leaked");
  }
  if (json.includes('"lostNightId"') || json.includes('"nightResolved"')) add("private night fields leaked");
  if (json.includes('"holderId"')) add("who holds which item leaked");

  // Ghost games: only a visible ghost gets them, only their own, and eliminated Traitors skip the role games.
  if (json.includes('"ghostId"') || json.includes('"pickIds"') || json.includes('"bingoWinnerId"')) add("ghost game entries leaked");
  if (v.me?.ghostGames && !isVisibleGhost(s, me!)) add("ghost games shown to someone who isn't a ghost");
  if (v.me?.ghostGames && s.roles[me!] === "traitor" && (v.me.ghostGames.crystalBall || v.me.ghostGames.bets?.calls)) {
    add("an eliminated Traitor offered a game about who the Traitors are");
  }

  for (const r of [v.round, ...v.pastRounds]) {
    if (!r) continue;
    if (r.kind === "reward") add("reward vote shown publicly");
    if (r.status === "open" && r.ballots.length) add("ballots shown while voting is open");
    if (r.status === "revealing" && r.ballots.length > r.revealedCount) add("unrevealed ballots shown");
  }

  const night = lastNight;
  const offer = night?.recruit;
  if (v.me?.recruitOffer && (!offer || offer.targetId !== me)) add("recruit offer shown to the wrong player");
  if (json.includes('"blackmailNext"')) add("a planned blackmail night leaked");
  if (s.phase === "NIGHT" && (v.deadline !== null || v.pausedRemainingMs !== null) && !meAliveTraitor && !v.me?.recruitOffer) {
    add("the night timer, which moves when an offer goes out, shown outside the night");
  }
  if (json.includes('"blackmail":true') && !v.traitor?.night?.blackmail && !v.me?.recruitOffer?.blackmail) add("a blackmail night shown to someone outside it");
  if (v.traitor?.night?.offer && (!offer || offer.traitorId !== me)) add("recruit offer shown to the wrong Traitor");
  for (const a of v.traitor?.offerAnswers ?? []) {
    const mine =
      !!night?.refused.some((r) => r.traitorId === me && r.targetId === a.playerId) || (offer?.traitorId === me && offer.targetId === a.playerId);
    if (!mine) add("another Traitor's recruit answers shown");
  }

  if (v.me) {
    const mine = new Set(s.items.filter((i) => i.holderId === me).map((i) => i.id));
    for (const i of v.me.items) if (!mine.has(i.id)) add("someone else's item");
  }

  const allowedEvents = new Set(
    s.events
      .filter(
        (e) =>
          e.audience.kind === "public" ||
          (e.audience.kind === "player" && e.audience.playerId === me) ||
          (e.audience.kind === "traitors" && meAliveTraitor),
      )
      .map((e) => e.id),
  );
  for (const e of v.events) if (!allowedEvents.has(e.id)) add(`private event ${e.type} shown`);
  for (const e of v.events) {
    if ((e.type === "banished" || e.type === "murderRevealed" || e.type === "playerEliminated") && e.data.role) {
      if (!s.settings.revealOnElimination && !finale) add("role leaked in an event");
    }
  }
  return problems;
}

export function allViewers(s: GameState): Viewer[] {
  return [
    { kind: "host" },
    { kind: "cohost" },
    { kind: "screen" },
    ...s.players.map((p) => ({ kind: "player" as const, playerId: p.id })),
  ];
}
