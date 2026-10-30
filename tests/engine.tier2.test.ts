import { describe, expect, it } from "vitest";
import { normaliseState } from "@/lib/game/engine";
import { bingoCard, ghostScores } from "@/lib/game/ghosts";
import { allViewers, findLeaks } from "@/lib/game/leaks";
import { DEFAULT_MISSIONS, DEFAULT_SETTINGS } from "@/lib/game/settings";
import type { ActionPayload, Actor, GameState } from "@/lib/game/types";
import { viewFor } from "@/lib/game/view";
import { as, dealt, HOST, lobby, type G } from "./helpers";

const cohost = (playerId: string): Actor => ({ kind: "cohost", playerId });
const ghostsOf = (g: G, id: string) => viewFor(g.state, { kind: "player", playerId: id }).me!.ghostGames;

function noLeaks(s: GameState) {
  for (const v of allViewers(s)) expect(findLeaks(s, v)).toEqual([]);
}

/** Day 1: p12 banished, now night. Traitors are p1, p2, p3. */
function ghostGame(settings = {}): G {
  const g = dealt(12, { settings });
  g.circle();
  g.banish("p12");
  expect(g.phase).toBe("NIGHT");
  return g;
}

/** Ends the night with the Traitors' pick and reveals it. */
function murder(g: G, target: string) {
  g.pickAll(target);
  if (g.phase === "NIGHT") g.expire();
  g.host({ type: "revealMurder" });
}

const template = {
  name: "Pumpkin Bowling",
  kind: "individual",
  howItWorks: "Roll a pumpkin at bottles.",
  minutes: 10,
  props: "Pumpkin, bottles",
  winRule: "Most bottles down",
  tieRule: "One more roll",
  reward: "dagger",
  traitorAngle: "",
} as const;

describe("mission catalogue (section 7: missions are data the host edits in the app)", () => {
  it("starts with the section 7 catalogue, team games first", () => {
    const g = lobby();
    expect(g.state.missionCatalogue).toEqual(DEFAULT_MISSIONS);
    expect(g.state.missionCatalogue).toHaveLength(23);
    expect(g.state.missionCatalogue.slice(0, 10).every((t) => t.kind === "team")).toBe(true);
    expect(g.state.missionCatalogue.slice(10, 20).every((t) => t.kind === "individual")).toBe(true);
    expect(g.state.missionCatalogue.slice(20).every((t) => t.kind === "ghost")).toBe(true);
  });

  it("the host adds, edits and removes missions; names stay unique; limits hold", () => {
    const g = lobby();
    g.host({ type: "saveMissionTemplate", template });
    const added = g.state.missionCatalogue.at(-1)!;
    expect(added).toMatchObject(template);
    expect(g.no(HOST, { type: "saveMissionTemplate", template: { ...template, name: "pumpkin bowling" } })).toMatch(/already a mission/);
    g.host({ type: "saveMissionTemplate", template: { ...template, id: added.id, minutes: 12 } });
    expect(g.state.missionCatalogue.find((t) => t.id === added.id)!.minutes).toBe(12);
    expect(g.no(HOST, { type: "saveMissionTemplate", template: { ...template, minutes: 0 } })).toMatch(/Minutes/);
    expect(g.no(HOST, { type: "saveMissionTemplate", template: { ...template, name: " " } })).toMatch(/Mission name/);
    expect(g.no(HOST, { type: "saveMissionTemplate", template: { ...template, id: "nope" } })).toMatch(/catalogue/);
    g.host({ type: "deleteMissionTemplate", templateId: added.id });
    expect(g.state.missionCatalogue.some((t) => t.id === added.id)).toBe(false);
    expect(g.no(as("p1"), { type: "saveMissionTemplate", template })).toMatch(/host or the co-host/);
  });

  it("a mission started from the catalogue keeps how it works, and the big screen shows it", () => {
    const g = dealt();
    const t = g.state.missionCatalogue[0];
    g.host({ type: "startMission", name: t.name, kind: t.kind, winRule: t.winRule, tieRule: t.tieRule, templateId: t.id });
    expect(g.state.missions.at(-1)).toMatchObject({ templateId: t.id, howItWorks: t.howItWorks, name: t.name });
    expect(viewFor(g.state, { kind: "screen" }).missions.at(-1)!.howItWorks).toBe(t.howItWorks);
    expect(g.no(HOST, { type: "startMission", name: "X", kind: "team", templateId: "gone" })).toMatch(/catalogue/);
    // An ad-hoc mission still works.
    g.host({ type: "startMission", name: "Arm wrestling", kind: "individual" });
    expect(g.state.missions.at(-1)).toMatchObject({ templateId: null, howItWorks: "" });
  });
});

describe("co-host (tier 2): missions and the big screen, never roles", () => {
  it("only the host picks or removes the co-host", () => {
    const g = dealt();
    expect(g.no(as("p4"), { type: "setCohost", playerId: "p4" })).toMatch(/Only the host/);
    g.host({ type: "setCohost", playerId: "p4" });
    expect(g.state.cohostId).toBe("p4");
    expect(viewFor(g.state, { kind: "player", playerId: "p4" }).me!.isCohost).toBe(true);
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.isCohost).toBe(false);
    expect(g.no(cohost("p4"), { type: "setCohost", playerId: "p6" })).toMatch(/Only the host/);
    g.host({ type: "setCohost", playerId: null });
    expect(g.no(cohost("p4"), { type: "setScreenMessage", text: "Hi" })).toMatch(/host or the co-host/);
  });

  it("runs missions, rewards, the big-screen message and the vote reveal; nothing else", () => {
    const g = dealt();
    g.host({ type: "setCohost", playerId: "p4" });
    const c = cohost("p4");
    g.do(c, { type: "startMission", name: "Ring Toss", kind: "individual" });
    g.do(c, { type: "setMissionWinners", playerIds: ["p5", "p6", "p7"] });
    g.do(c, { type: "awardItem", itemType: "shield", playerIds: ["p5"] });
    g.do(c, { type: "openRewardVote", itemType: "dagger", voterIds: ["p6", "p7"] });
    g.do(c, { type: "lockRewardVote" });
    g.do(c, { type: "saveMissionTemplate", template });
    g.do(c, { type: "setScreenMessage", text: "Mission 1!" });
    const refused: ActionPayload[] = [
      { type: "openCircle" },
      { type: "pause" },
      { type: "endGameEarly", reason: "x" },
      { type: "giveItem", itemType: "dagger", playerId: "p8", reason: "x" },
      { type: "setCohost", playerId: "p6" },
      { type: "eliminatePlayer", playerId: "p8", status: "left", reason: "x" },
    ];
    for (const a of refused) expect(g.no(c, a)).toMatch(/host/);
    expect(g.no(cohost("p5"), { type: "setScreenMessage", text: "Not me" })).toMatch(/host or the co-host/);
    g.host({ type: "openCircle" });
    g.host({ type: "openVoting" });
    g.vote({ p5: "p8", p6: "p8" });
    g.do(c, { type: "revealNextBallot" });
    expect(g.round().revealedCount).toBe(1);
    expect(g.no(c, { type: "finishReveal" })).toMatch(/host/);
  });

  it("a refused award never tells the co-host who holds what", () => {
    const g = dealt();
    g.host({ type: "setCohost", playerId: "p4" });
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p5"] });
    const toCohost = g.no(cohost("p4"), { type: "awardItem", itemType: "shield", playerIds: ["p5"] });
    expect(toCohost).not.toMatch(/holds|already/);
    expect(toCohost).toMatch(/Ask the host/);
    expect(g.no(HOST, { type: "awardItem", itemType: "shield", playerIds: ["p5"] })).toMatch(/already holds/);
  });

  it("the co-host view has the catalogue and who's voting, but no roles, items or ballots", () => {
    const g = dealt();
    g.host({ type: "setCohost", playerId: "p1" });
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "openRewardVote", itemType: "shield", voterIds: ["p5", "p6"] });
    g.by("p5", { type: "castRewardVote", targetId: "p6" });
    const v = viewFor(g.state, { kind: "cohost" });
    expect(v.cohost!.catalogue).toHaveLength(23);
    expect(v.cohost!.rewardVote).toEqual({ itemType: "shield", voterIds: ["p5", "p6"], votedIds: ["p5"] });
    expect(JSON.stringify(v)).not.toContain('"targetId":"p6"');
    expect(v.players.every((p) => p.role === null)).toBe(true);
    noLeaks(g.state);
  });

  it("removing the co-host's player in the lobby clears the co-host", () => {
    const g = lobby();
    g.host({ type: "setCohost", playerId: "p4" });
    g.host({ type: "removePlayer", playerId: "p4" });
    expect(g.state.cohostId).toBeNull();
  });
});

describe("big-screen message (tier 3: editable text on the big screen)", () => {
  it("shows on every screen until cleared", () => {
    const g = dealt();
    g.host({ type: "setScreenMessage", text: "  Dinner in 10 minutes  " });
    expect(viewFor(g.state, { kind: "screen" }).screenMessage).toMatchObject({ text: "Dinner in 10 minutes" });
    expect(g.no(HOST, { type: "setScreenMessage", text: "x".repeat(141) })).toMatch(/140/);
    expect(g.no(HOST, { type: "setScreenMessage", text: "   " })).toMatch(/empty/);
    g.host({ type: "setScreenMessage", text: null });
    expect(viewFor(g.state, { kind: "screen" }).screenMessage).toBeNull();
    expect(g.no(HOST, { type: "setScreenMessage", text: null })).toMatch(/no message/);
  });
});

describe("breakfast entrance (tier 2)", () => {
  it("the survivors walk in in a seeded order; the victim's chair stays empty", () => {
    const g = ghostGame();
    murder(g, "p7");
    const e = g.state.events.filter((x) => x.type === "murderRevealed").pop()!;
    const entrance = e.data.entrance as string[];
    expect([...entrance].sort()).toEqual(g.alive().sort());
    expect(entrance).not.toContain("p7");
    expect(e.data.entranceMs).toBe(20_000);
    noLeaks(g.state);
  });

  it("can be switched off", () => {
    const g = ghostGame({ breakfastEntrance: false });
    murder(g, "p7");
    const e = g.state.events.filter((x) => x.type === "murderRevealed").pop()!;
    expect(e.data).toMatchObject({ entrance: null, entranceMs: 0 });
  });
});

describe("ghost games (section 8): score-only, for ghosts only", () => {
  it("only ghosts play, and a murder victim waits for the reveal like everyone else", () => {
    const g = ghostGame();
    expect(g.no(as("p5"), { type: "ghostBet", kind: "murder", targetId: "p7" })).toBe("Ghost games are for ghosts.");
    expect(ghostsOf(g, "p5")).toBeNull();
    expect(ghostsOf(g, "p12")).not.toBeNull();
    g.pickAll("p7");
    if (g.phase === "NIGHT") g.expire();
    const card = bingoCard(g.state, "p7");
    // Before the reveal the victim is told exactly what a living player is told.
    expect(g.no(as("p7"), { type: "markBingo", moment: card[0] })).toBe("Ghost games are for ghosts.");
    expect(ghostsOf(g, "p7")).toBeNull();
    noLeaks(g.state);
    g.host({ type: "revealMurder" });
    expect(ghostsOf(g, "p7")).not.toBeNull();
    g.by("p7", { type: "markBingo", moment: card[0] });
  });

  it("Bhoot Bets: one bet per result, settled only when the result is public", () => {
    const g = ghostGame();
    g.by("p12", { type: "ghostBet", kind: "murder", targetId: "p7" });
    expect(g.no(as("p12"), { type: "ghostBet", kind: "murder", targetId: "p8" })).toMatch(/can't be changed/);
    expect(g.no(as("p12"), { type: "ghostBet", kind: "banish", targetId: "p8" })).toMatch(/during the Circle/);
    g.pickAll("p7");
    if (g.phase === "NIGHT") g.expire();
    expect(g.state.ghostGames.bets[0].settled).toBe(false);
    expect(ghostsOf(g, "p12")!.bets!.history).toEqual([]);
    g.host({ type: "revealMurder" });
    expect(g.state.ghostGames.bets[0]).toMatchObject({ settled: true, correct: true });

    g.host({ type: "openCircle" });
    g.by("p12", { type: "ghostBet", kind: "banish", targetId: "p11" });
    g.by("p7", { type: "ghostBet", kind: "banish", targetId: "p10" });
    expect(g.no(as("p12"), { type: "ghostBet", kind: "banish", targetId: null })).toMatch(/can't be changed/);
    g.host({ type: "openVoting" });
    g.banish("p11");
    expect(ghostsOf(g, "p12")!.bets!.history.map((h) => [h.kind, h.correct])).toEqual([
      ["banish", true],
      ["murder", true],
    ]);
    expect(ghostsOf(g, "p7")!.bets!.history).toEqual([{ kind: "banish", pick: "p10", correct: false, day: 2 }]);
    noLeaks(g.state);
  });

  it("a bet on 'nobody dies' wins on a shield save, and the bet never says why", () => {
    const g = dealt();
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p7"] });
    g.circle();
    g.banish("p12");
    g.by("p12", { type: "ghostBet", kind: "murder", targetId: null });
    murder(g, "p7");
    expect(g.p("p7").status).toBe("alive");
    expect(ghostsOf(g, "p12")!.bets!.history).toEqual([{ kind: "murder", pick: null, correct: true, day: 1 }]);
    noLeaks(g.state);
  });

  it("Traitor calls: on eliminated players only, scored at the final reveal; eliminated Traitors sit out", () => {
    const g = ghostGame();
    murder(g, "p7");
    g.circle();
    g.banish("p3");
    expect(g.no(as("p12"), { type: "traitorCall", playerId: "p5", call: "traitor" })).toMatch(/still in the game/);
    expect(g.no(as("p12"), { type: "traitorCall", playerId: "p12", call: "innocent" })).toMatch(/yourself/);
    g.by("p12", { type: "traitorCall", playerId: "p3", call: "traitor" });
    g.by("p12", { type: "traitorCall", playerId: "p7", call: "traitor" });
    expect(g.no(as("p12"), { type: "traitorCall", playerId: "p3", call: "innocent" })).toMatch(/already/);
    expect(g.no(as("p3"), { type: "traitorCall", playerId: "p12", call: "innocent" })).toMatch(/sit this one out/);
    expect(ghostsOf(g, "p3")!.bets!.calls).toBeNull();
    expect(ghostsOf(g, "p12")!.bets!.calls).toEqual(
      expect.arrayContaining([
        { playerId: "p3", myCall: "traitor" },
        { playerId: "p7", myCall: "traitor" },
      ]),
    );
    noLeaks(g.state);
    g.host({ type: "endGameEarly", reason: "Test" });
    const score = ghostScores(g.state).find((x) => x.playerId === "p12")!;
    expect(score.traitorCalls).toBe(2); // p3 right, p7 wrong
  });

  it("Traitor calls are off when roles are shown on elimination", () => {
    const g = ghostGame({ revealOnElimination: true });
    murder(g, "p7");
    expect(g.no(as("p12"), { type: "traitorCall", playerId: "p7", call: "innocent" })).toMatch(/nothing to call/);
    expect(ghostsOf(g, "p12")!.bets!.calls).toBeNull();
  });

  it("Crystal Ball: at each Circle, exactly as many as the Traitors, once per Circle, scored at the finale", () => {
    const g = ghostGame();
    expect(g.no(as("p12"), { type: "crystalBall", playerIds: ["p1", "p2", "p4"] })).toMatch(/Crystal Ball opens/);
    murder(g, "p7");
    g.host({ type: "openCircle" });
    expect(g.no(as("p12"), { type: "crystalBall", playerIds: ["p1", "p2"] })).toMatch(/exactly 3/);
    expect(g.no(as("p12"), { type: "crystalBall", playerIds: ["p1", "p2", "p12"] })).toMatch(/yourself/);
    g.by("p12", { type: "crystalBall", playerIds: ["p1", "p2", "p4"] });
    expect(g.no(as("p12"), { type: "crystalBall", playerIds: ["p1", "p2", "p5"] })).toMatch(/locked in/);
    expect(ghostsOf(g, "p12")!.crystalBall).toMatchObject({ open: true, size: 3, myPicks: ["p1", "p2", "p4"], locked: 1 });
    g.host({ type: "openVoting" });
    g.by("p7", { type: "crystalBall", playerIds: ["p1", "p5", "p6"] });
    g.banish("p3");
    expect(g.no(as("p3"), { type: "crystalBall", playerIds: ["p1", "p2", "p4"] })).toMatch(/sit this one out/);
    expect(ghostsOf(g, "p3")!.crystalBall).toBeNull();
    g.host({ type: "endGameEarly", reason: "Test" });
    const scores = Object.fromEntries(ghostScores(g.state).map((x) => [x.playerId, x.crystalBall]));
    expect(scores).toMatchObject({ p12: 4, p7: 2, p3: 0 });
  });

  it("Bhoot Bingo: a seeded 3×3 card; the first full line wins and is announced", () => {
    const g = ghostGame();
    murder(g, "p7");
    const card = bingoCard(g.state, "p12");
    expect(card).toHaveLength(9);
    expect(new Set(card).size).toBe(9);
    expect(bingoCard(g.state, "p12")).toEqual(card);
    expect(bingoCard(g.state, "p7")).not.toEqual(card);
    expect(g.no(as("p12"), { type: "markBingo", moment: "Not a moment" })).toMatch(/isn't on your card/);
    g.by("p12", { type: "markBingo", moment: card[0] });
    g.by("p12", { type: "markBingo", moment: card[0] });
    expect(g.state.ghostGames.bingo.p12.marked).toEqual([]);
    for (const m of [card[0], card[4], card[8]]) g.by("p12", { type: "markBingo", moment: m });
    expect(g.state.ghostGames.bingoWinnerId).toBe("p12");
    expect(g.state.events.filter((e) => e.type === "bingo")).toEqual([expect.objectContaining({ audience: { kind: "public" }, data: { playerId: "p12" } })]);
    const other = bingoCard(g.state, "p7");
    for (const m of other.slice(0, 3)) g.by("p7", { type: "markBingo", moment: m });
    expect(g.state.ghostGames.bingoWinnerId).toBe("p12");
    expect(g.state.ghostGames.bingo.p7.lineAt).not.toBeNull();
    expect(ghostsOf(g, "p7")!.bingo).toMatchObject({ hasLine: true, winnerId: "p12" });
    g.host({ type: "endGameEarly", reason: "Test" });
    expect(ghostScores(g.state).find((x) => x.playerId === "p12")!.bingo).toBe(5);
    expect(ghostScores(g.state).find((x) => x.playerId === "p7")!.bingo).toBe(0);
  });

  it("each game can be switched off on its own", () => {
    const g = ghostGame({ ghostGames: { bhootBets: false, crystalBall: true, liveReactions: false, bhootBingo: false } });
    expect(g.no(as("p12"), { type: "ghostBet", kind: "murder", targetId: "p7" })).toMatch(/switched off/);
    const v = ghostsOf(g, "p12")!;
    expect(v.bets).toBeNull();
    expect(v.bingo).toBeNull();
    expect(v.reactions).toBeNull();
    expect(v.crystalBall).not.toBeNull();
    g.host({ type: "updateSettings", patch: { ghostGames: { bhootBets: false, crystalBall: false, liveReactions: false, bhootBingo: false } } });
    expect(ghostsOf(g, "p12")).toBeNull();
  });

  it("scores show at the final reveal; before that only the host sees them", () => {
    const g = ghostGame();
    g.by("p12", { type: "ghostBet", kind: "murder", targetId: "p7" });
    murder(g, "p7");
    g.host({ type: "endGameEarly", reason: "Test" });
    expect(viewFor(g.state, { kind: "screen" }).finale).toBeNull();
    expect(viewFor(g.state, { kind: "host" }).finale!.ghostScores[0]).toMatchObject({ playerId: "p12", bets: 3, total: 3 });
    noLeaks(g.state);
    g.host({ type: "revealFinale" });
    const scores = viewFor(g.state, { kind: "screen" }).finale!.ghostScores;
    expect(scores[0]).toMatchObject({ playerId: "p12", total: 3 });
    expect(scores.map((s) => s.playerId).sort()).toEqual(["p12", "p7"]);
    expect(ghostsOf(g, "p12")).toBeNull();
  });
});

describe("presets and older saved games", () => {
  it("a preset's settings and missions apply in the lobby only, and are validated", () => {
    const g = lobby();
    g.host({ type: "applyPreset", settings: { ...DEFAULT_SETTINGS, debateSeconds: 300 }, missions: [{ ...template, id: "x1" }] });
    expect(g.state.settings.debateSeconds).toBe(300);
    expect(g.state.missionCatalogue.map((t) => t.name)).toEqual(["Pumpkin Bowling"]);
    expect(g.no(HOST, { type: "applyPreset", settings: { ...DEFAULT_SETTINGS, traitorCount: 5 }, missions: [] })).toMatch(/Traitors/);
    const d = dealt();
    expect(d.no(HOST, { type: "applyPreset", settings: DEFAULT_SETTINGS, missions: [] })).toMatch(/after the|You can't do that/);
  });

  it("a game saved before Step 5 gets the new fields filled in", () => {
    const g = dealt();
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    const old = structuredClone(g.state) as Partial<GameState> & Record<string, unknown>;
    delete old.missionCatalogue;
    delete old.cohostId;
    delete old.screenMessage;
    delete old.ghostGames;
    const settings = { ...old.settings } as Record<string, unknown>;
    delete settings.narration;
    delete settings.ghostPoints;
    old.settings = settings as never;
    const m = old.missions![0] as unknown as Record<string, unknown>;
    delete m.howItWorks;
    delete m.templateId;
    const s = normaliseState(old as GameState);
    expect(s.missionCatalogue).toHaveLength(23);
    expect(s.settings.narration).toEqual(DEFAULT_SETTINGS.narration);
    expect(s.missions[0]).toMatchObject({ howItWorks: "", templateId: null });
    expect(s.ghostGames.bets).toEqual([]);
    expect(viewFor(s, { kind: "screen" }).screenMessage).toBeNull();
  });
});

describe("private talks before each Circle (owner, 30 October)", () => {
  it("'Go to the Circle' starts private talks; the host or the timer then opens the Circle, flagged so phones alert", () => {
    const g = dealt(12, { settings: { privateTalks: true, privateTalksSeconds: 300 } });
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("PRIVATE_TALKS");
    expect(g.state.deadline).toBe(g.now + 300_000);
    expect(g.state.events.at(-1)).toMatchObject({ type: "privateTalksStarted", audience: { kind: "public" } });
    expect(g.no(HOST, { type: "openVoting" })).toMatch(/private talks/);
    expect(g.no(HOST, { type: "startMission", name: "Late", kind: "team" })).toMatch(/private talks/);
    noLeaks(g.state);
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("CIRCLE_DEBATE");
    expect(g.state.events.at(-1)).toMatchObject({ type: "circleOpened", data: { afterTalks: true } });
  });

  it("the timer running out opens the Circle too", () => {
    const g = dealt(12, { settings: { privateTalks: true } });
    g.host({ type: "openCircle" });
    g.expire();
    expect(g.phase).toBe("CIRCLE_DEBATE");
    expect(g.state.events.at(-1)).toMatchObject({ type: "circleOpened", data: { afterTalks: true } });
    expect(g.state.deadline).toBe(g.now + g.state.settings.debateSeconds * 1000);
  });

  it("switched off, the Circle opens at once and phones don't alert", () => {
    const g = dealt();
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("CIRCLE_DEBATE");
    expect(g.state.events.at(-1)).toMatchObject({ type: "circleOpened", data: { afterTalks: false } });
  });

  it("ghosts can bet and use Crystal Ball during private talks", () => {
    const g = ghostGame({ privateTalks: true });
    murder(g, "p7");
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("PRIVATE_TALKS");
    g.by("p12", { type: "ghostBet", kind: "banish", targetId: "p5" });
    g.by("p12", { type: "crystalBall", playerIds: ["p1", "p2", "p4"] });
    noLeaks(g.state);
  });
});

describe("ghost challenges (owner, 30 October): ghosts win an item for a living player", () => {
  /** Morning 2 (day 3): p12 and p11 banished, p7 and p8 murdered. */
  function secondMorning(settings = {}) {
    const g = ghostGame(settings);
    murder(g, "p7");
    expect(g.no(HOST, { type: "startMission", name: "Ghost Tower", kind: "ghost" })).toMatch(/from morning 2/);
    g.circle();
    g.banish("p11");
    murder(g, "p8");
    expect(g.state.day).toBe(3);
    return g;
  }

  it("not on day 1 or the first morning by default; any morning from the set one", () => {
    const d = dealt();
    expect(d.no(HOST, { type: "startMission", name: "Ghost Tower", kind: "ghost" })).toMatch(/from morning 2/);
    const g = secondMorning();
    g.host({ type: "startMission", name: "Ghost Tower", kind: "ghost" });
    expect(g.state.missions.at(-1)).toMatchObject({ kind: "ghost", name: "Ghost Tower" });
    const early = ghostGame({ ghostMissionFromMorning: 1 });
    murder(early, "p7");
    early.host({ type: "startMission", name: "Ghost Tower", kind: "ghost" });
  });

  it("the ghosts vote in private for any living player; the item goes to the top pick", () => {
    const g = secondMorning();
    g.host({ type: "startMission", name: "Ghost Tower", kind: "ghost" });
    expect(g.no(HOST, { type: "openRewardVote", itemType: "shield", voterIds: ["p12", "p5"] })).toMatch(/isn't a ghost/);
    expect(g.no(HOST, { type: "setMissionWinners", playerIds: ["p5"] })).toMatch(/isn't a ghost/);
    g.host({ type: "setMissionWinners", playerIds: ["p12", "p7", "p11", "p8"] });
    g.host({ type: "openRewardVote", itemType: "shield", voterIds: ["p12", "p7", "p11", "p8"] });
    expect(g.round().candidateIds).toEqual(g.alive());
    expect(viewFor(g.state, { kind: "player", playerId: "p12" }).me!.rewardVote).toMatchObject({ itemType: "shield", submitted: false });
    expect(g.no(as("p5"), { type: "castRewardVote", targetId: "p6" })).toMatch(/winners/);
    g.by("p12", { type: "castRewardVote", targetId: "p5" });
    g.by("p7", { type: "castRewardVote", targetId: "p5" });
    g.by("p11", { type: "castRewardVote", targetId: "p6" });
    noLeaks(g.state);
    g.by("p8", { type: "castRewardVote", targetId: "p5" });
    expect(g.items("p5", "shield")).toHaveLength(1);
    expect(g.state.events.filter((e) => e.type === "itemAwarded").at(-1)!.audience).toEqual({ kind: "player", playerId: "p5" });
    noLeaks(g.state);
  });

  it("or the ghosts tell the host, who gives it directly", () => {
    const g = secondMorning();
    g.host({ type: "startMission", name: "Ghost Taste Test", kind: "ghost" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p6"] });
    expect(g.items("p6", "dagger")).toHaveLength(1);
    expect(g.no(HOST, { type: "awardItem", itemType: "dagger", playerIds: ["p12"] })).toMatch(/ghost/);
  });
});
