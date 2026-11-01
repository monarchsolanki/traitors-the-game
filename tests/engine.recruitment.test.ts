import { describe, expect, it } from "vitest";
import { normaliseState } from "@/lib/game/engine";
import { allViewers, findLeaks } from "@/lib/game/leaks";
import { viewFor } from "@/lib/game/view";
import { HOST, as, dealt } from "./helpers";

/**
 * Recruitment gate (section 5.4): accept, refuse, timeout, the role change, the new Traitor's
 * place in the next night, and the win check afterwards. Recruitment stays off until these pass.
 */
const HOST_VIEWER = { kind: "host" } as const;
const lastTraitorNight = (recruitment: "off" | "lastTraitor" = "lastTraitor") => {
  const g = dealt(12, { settings: { recruitment, traitorCount: 2 }, traitors: ["p1", "p2"] });
  g.circle();
  g.banish("p2");
  expect(g.phase).toBe("NIGHT");
  return g;
};

describe("recruitment gate tests", () => {
  it("is unavailable while switched off", () => {
    const g = lastTraitorNight("off");
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p5", mode: "recruit" })).toMatch(/isn't available/);
  });

  it("is unavailable while more than one Traitor is alive", () => {
    const g = dealt(12, { settings: { recruitment: "lastTraitor" } });
    g.circle();
    g.banish("p12");
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p5", mode: "recruit" })).toMatch(/isn't available/);
  });

  it("only an Innocent can be recruited; the offer is private to the target", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.recruitOffer).not.toBeNull();
    expect(viewFor(g.state, { kind: "player", playerId: "p6" }).me!.recruitOffer).toBeNull();
    const screen = viewFor(g.state, { kind: "screen" });
    expect(screen.events.some((e) => e.type === "recruitOffer")).toBe(false);
    expect(screen.me).toBeUndefined();
    expect(screen.traitor).toBeUndefined();
    expect(screen.host).toBeUndefined();
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p6" })).toMatch(/Wait for the answer/);
  });

  it("accept: the recruit becomes a Traitor at the end of the night, in one step; nobody dies", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(g.state.roles.p5).toBe("innocent");
    g.by("p5", { type: "answerRecruit", accept: true });
    expect(g.state.roles.p5).toBe("traitor");
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.night()).toMatchObject({ victimId: null, reason: "recruitAccepted" });
    expect(g.alive()).toHaveLength(11);
  });

  it("with ghost games: nothing leaks while the offer waits, and a bet on 'nobody dies' pays without saying why", () => {
    const g = lastTraitorNight();
    g.host({ type: "updateSettings", patch: { ghostGames: { bhootBets: true, crystalBall: true, liveReactions: true, bhootBingo: true } } });
    // p2, the banished Traitor, is a ghost; give the ghosts an Innocent too.
    g.host({ type: "eliminatePlayer", playerId: "p12", status: "left", reason: "Went home" });
    g.by("p12", { type: "ghostBet", kind: "murder", targetId: null });
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    for (const v of allViewers(g.state)) expect(findLeaks(g.state, v)).toEqual([]);
    expect(viewFor(g.state, { kind: "player", playerId: "p12" }).me!.ghostGames!.bets!.murder).toEqual({ pick: null });
    g.by("p5", { type: "answerRecruit", accept: true });
    g.host({ type: "revealMurder" });
    expect(viewFor(g.state, { kind: "player", playerId: "p12" }).me!.ghostGames!.bets!.history).toEqual([
      { kind: "murder", pick: null, correct: true, day: 1 },
    ]);
    for (const v of allViewers(g.state)) expect(findLeaks(g.state, v)).toEqual([]);
  });

  it("refuse: no role change, the night goes on and the Traitor is told and picks again", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    expect(g.state.roles.p5).toBe("innocent");
    expect(g.phase).toBe("NIGHT");
    expect(g.night()).toMatchObject({ resolved: false, recruit: null, mode: null });
    expect(g.state.deadline).toBe(g.now + g.state.settings.nightSeconds * 1000);
    const v = viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!;
    expect(v.offerAnswers).toEqual([{ playerId: "p5", answer: "refused" }]);
    expect(v.night).toMatchObject({ recruitmentAvailable: true, offersLeft: 1, offer: null });
    // The refuser sees nothing new; nobody else hears about it.
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.recruitOffer).toBeNull();
    for (const viewer of allViewers(g.state)) expect(findLeaks(g.state, viewer)).toEqual([]);
  });

  it("after a refusal the Traitor can murder instead, even the player who refused", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    g.by("p1", { type: "nightPick", targetId: "p5" });
    expect(g.p("p5").status).toBe("murdered");
    expect(g.night()).toMatchObject({ victimId: "p5", reason: "murdered" });
  });

  it("after a refusal the Traitor can offer to someone else, but not the same player again", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p5", mode: "recruit" })).toMatch(/turned you down/);
    g.by("p1", { type: "nightPick", targetId: "p6", mode: "recruit" });
    g.by("p6", { type: "answerRecruit", accept: true });
    expect(g.state.roles.p6).toBe("traitor");
    expect(g.night()).toMatchObject({ victimId: null, reason: "recruitAccepted" });
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!.offerAnswers).toEqual([{ playerId: "p6", answer: "accepted" }]);
  });

  it("after two refusals there are no offers left, but the Traitor still gets to murder", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    g.by("p1", { type: "nightPick", targetId: "p6", mode: "recruit" });
    g.by("p6", { type: "answerRecruit", accept: false });
    expect(g.phase).toBe("NIGHT");
    const v = viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!;
    expect(v.offerAnswers.map((x) => x.playerId)).toEqual(["p5", "p6"]);
    expect(v.night).toMatchObject({ recruitmentAvailable: false, offersLeft: 0 });
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p7", mode: "recruit" })).toMatch(/No recruit offers left/);
    g.by("p1", { type: "nightPick", targetId: "p7" });
    expect(g.p("p7").status).toBe("murdered");
  });

  it("the offers per night come from the settings", () => {
    const g = lastTraitorNight();
    g.host({ type: "overrideSetting", key: "recruitOffersPerNight", value: 1, reason: "One offer only" });
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p6", mode: "recruit" })).toMatch(/No recruit offers left/);
  });

  it("timeout: the Traitor picks again, and an answer after that is rejected", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(g.state.deadline).toBe(g.night().recruit!.deadline);
    g.expire();
    expect(g.no(as("p5"), { type: "answerRecruit", accept: true })).toMatch(/no offer waiting/);
    expect(g.state.roles.p5).toBe("innocent");
    expect(g.phase).toBe("NIGHT");
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!.offerAnswers).toEqual([{ playerId: "p5", answer: "timeout" }]);
  });

  it("the night timer stays hidden from the room, so an offer can't be spotted by it jumping", () => {
    const g = lastTraitorNight();
    const hidden = [{ kind: "screen" }, { kind: "cohost" }, { kind: "player", playerId: "p6" }, { kind: "player", playerId: "p5" }] as const;
    for (const v of hidden) expect(viewFor(g.state, v).deadline).toBeNull();
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).deadline).toBe(g.state.deadline);
    expect(viewFor(g.state, HOST_VIEWER).deadline).toBe(g.state.deadline);
    // The offer goes out: the timer moves, the room still sees nothing, and the chosen player sees their time.
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).deadline).toBe(g.state.deadline);
    for (const v of hidden.slice(0, 3)) expect(viewFor(g.state, v).deadline).toBeNull();
    for (const v of allViewers(g.state)) expect(findLeaks(g.state, v)).toEqual([]);
    // A pause doesn't give it away either.
    g.host({ type: "pause" });
    expect(viewFor(g.state, { kind: "screen" }).pausedRemainingMs).toBeNull();
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).pausedRemainingMs).toBe(g.state.pausedRemainingMs);
    g.host({ type: "resume" });
    // By day the timer is everyone's again.
    g.by("p5", { type: "answerRecruit", accept: true });
    g.host({ type: "revealMurder" });
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("CIRCLE_DEBATE");
    expect(viewFor(g.state, { kind: "screen" }).deadline).toBe(g.state.deadline);
  });

  it("no pick after a refusal: the night timer ends it and nobody dies", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    g.now = g.state.deadline! + 1;
    g.expire();
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.night()).toMatchObject({ victimId: null, reason: "recruitRefused" });
  });

  it("the recruit leaving mid-offer sends the Traitor back to pick", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.host({ type: "eliminatePlayer", playerId: "p5", status: "left", reason: "Went home" });
    expect(g.phase).toBe("NIGHT");
    expect(g.night().recruit).toBeNull();
    g.by("p1", { type: "nightPick", targetId: "p6" });
    expect(g.p("p6").status).toBe("murdered");
  });

  it("the murder and recruit reveals look the same as a shield save", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: true });
    g.host({ type: "revealMurder" });
    const reveal = g.state.events.filter((e) => e.type === "murderRevealed").pop()!;
    expect(reveal.audience).toEqual({ kind: "public" });
    const { entrance, ...rest } = reveal.data as { entrance: string[] };
    expect(rest).toEqual({ nightId: g.night().id, victimId: null, role: null, entranceMs: 20_000 });
    // Everyone alive walks in to breakfast, exactly as when nobody was targeted.
    expect([...entrance].sort()).toEqual(g.state.players.filter((p) => p.status === "alive").map((p) => p.id).sort());
  });

  it("the new Traitor takes part in the next night, sees the chat and their fellow Traitor", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: true });
    g.host({ type: "revealMurder" });
    const v = viewFor(g.state, { kind: "player", playerId: "p5" });
    expect(v.traitor!.fellowTraitorIds).toContain("p1");
    g.circle();
    g.banish("p12");
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p6", mode: "recruit" })).toMatch(/isn't available/);
    g.by("p5", { type: "nightPick", targetId: "p6" });
    expect(g.phase).toBe("NIGHT");
    g.by("p1", { type: "nightPick", targetId: "p6" });
    expect(g.p("p6").status).toBe("murdered");
  });

  it("the win check afterwards counts the recruit as a Traitor", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: true });
    g.host({ type: "revealMurder" });
    g.circle();
    g.banish("p1");
    expect(g.phase).toBe("NIGHT");
    g.pickAll("p6");
    g.host({ type: "revealMurder" });
    g.circle();
    g.banish("p5");
    expect(g.phase).toBe("FINALE");
    expect(g.state.finale!.winner).toBe("innocents");
    expect(g.state.finale!.winnerIds).not.toContain("p5");
  });

  it("the last Traitor can still choose to murder", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "murder" });
    expect(g.p("p5").status).toBe("murdered");
  });

  it("the host resolving the night with a pending offer treats it as a timeout", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.host({ type: "resolveNight" });
    expect(g.night().reason).toBe("recruitTimeout");
    expect(g.state.roles.p5).toBe("innocent");
  });

  it("pausing stops the offer timer", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    const before = g.night().recruit!.deadline;
    g.host({ type: "pause" });
    g.now += 600_000;
    g.host({ type: "resume" });
    expect(g.night().recruit!.deadline).toBeGreaterThan(before + 590_000);
    g.by("p5", { type: "answerRecruit", accept: false });
    expect(g.phase).toBe("NIGHT");
    void HOST;
  });
});

/** Owner, 2 November: the host chooses blackmail nights. The lone Traitor picks someone to join them; not accepting is fatal. */
describe("blackmail nights", () => {
  /** Two Traitors alive during the day, with blackmail chosen; banishing p2 brings the night. */
  const blackmailNight = (recruitment: "off" | "lastTraitor" = "lastTraitor") => {
    const g = dealt(12, { settings: { recruitment, traitorCount: 2 }, traitors: ["p1", "p2"] });
    g.circle();
    g.host({ type: "setBlackmail", on: true });
    g.banish("p2");
    expect(g.phase).toBe("NIGHT");
    expect(g.night().blackmail).toBe(true);
    return g;
  };
  const noLeaks = (g: ReturnType<typeof dealt>) => {
    for (const v of allViewers(g.state)) expect(findLeaks(g.state, v)).toEqual([]);
  };

  it("only the host can choose one, once roles are dealt and before the final reveal", () => {
    const g = dealt(12, { settings: { traitorCount: 2 }, traitors: ["p1", "p2"] });
    expect(g.no(as("p1"), { type: "setBlackmail", on: true })).toBeTruthy();
    expect(g.no(as("p5"), { type: "setBlackmail", on: true })).toBeTruthy();
    g.host({ type: "setBlackmail", on: true });
    expect(g.state.blackmailNext).toBe(true);
    g.host({ type: "setBlackmail", on: false });
    expect(g.state.blackmailNext).toBe(false);
    g.host({ type: "endGameEarly", reason: "Done" });
    expect(g.no(HOST, { type: "setBlackmail", on: true })).toBeTruthy();
  });

  it("applies to one night only: the next night is a normal one", () => {
    const g = blackmailNight();
    expect(g.state.blackmailNext).toBe(false);
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    g.host({ type: "revealMurder" });
    g.circle();
    g.banish("p12");
    expect(g.night().blackmail).toBe(false);
    g.by("p1", { type: "nightPick", targetId: "p6", mode: "murder" });
    expect(g.p("p6").status).toBe("murdered");
  });

  it("waits while two Traitors are alive, then applies to the first lone-Traitor night", () => {
    const g = dealt(12, { settings: { traitorCount: 2 }, traitors: ["p1", "p2"] });
    g.circle();
    g.host({ type: "setBlackmail", on: true });
    g.banish("p12");
    expect(g.night().blackmail).toBe(false);
    expect(g.state.blackmailNext).toBe(true);
    g.pickAll("p11");
    g.host({ type: "revealMurder" });
    g.circle();
    g.banish("p2");
    expect(g.night().blackmail).toBe(true);
    expect(g.state.blackmailNext).toBe(false);
  });

  it("the Traitor can't murder, can only offer to an Innocent, and it works with recruitment switched off", () => {
    const g = blackmailNight("off");
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p5", mode: "murder" })).toMatch(/blackmail night/);
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p5" })).toMatch(/blackmail night/);
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(g.state.deadline).toBe(g.night().recruit!.deadline);
    const v = viewFor(g.state, { kind: "player", playerId: "p5" });
    expect(v.me!.recruitOffer).toMatchObject({ blackmail: true });
  });

  it("accept: they become a Traitor, nobody dies, and the Traitor is told", () => {
    const g = blackmailNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: true });
    expect(g.state.roles.p5).toBe("traitor");
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.night()).toMatchObject({ victimId: null, reason: "recruitAccepted" });
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!.offerAnswers).toEqual([{ playerId: "p5", answer: "accepted" }]);
    noLeaks(g);
  });

  it("refuse: the night ends at once and they die, with no second pick, revealed like any murder", () => {
    const g = blackmailNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    expect(g.state.roles.p5).toBe("innocent");
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.night()).toMatchObject({ victimId: "p5", reason: "blackmailRefused", resolved: true });
    expect(g.p("p5").status).toBe("murdered");
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!.offerAnswers).toEqual([{ playerId: "p5", answer: "refused" }]);
    // Nobody sees it until the host reveals it.
    expect(viewFor(g.state, { kind: "screen" }).players.find((p) => p.id === "p5")!.status).toBe("alive");
    noLeaks(g);
    g.host({ type: "revealMurder" });
    const reveal = g.state.events.filter((e) => e.type === "murderRevealed").pop()!;
    expect(reveal.audience).toEqual({ kind: "public" });
    expect(reveal.data).toMatchObject({ victimId: "p5" });
    noLeaks(g);
  });

  it("no answer in time counts as refusing, and an answer after that is rejected", () => {
    const g = blackmailNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.expire();
    expect(g.no(as("p5"), { type: "answerRecruit", accept: true })).toBeTruthy();
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.night()).toMatchObject({ victimId: "p5", reason: "blackmailTimeout" });
  });

  it("a tap that reaches the server just after the deadline still counts, until the timer fires", () => {
    const g = blackmailNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.now = g.night().recruit!.deadline + 1;
    g.by("p5", { type: "answerRecruit", accept: true });
    expect(g.state.roles.p5).toBe("traitor");
    expect(g.p("p5").status).toBe("alive");
    expect(g.night()).toMatchObject({ victimId: null, reason: "recruitAccepted" });
  });

  it("the host can't shorten the timer while a blackmail offer waits, so −1 min can't kill anyone", () => {
    const g = blackmailNight();
    g.host({ type: "adjustTimer", deltaSeconds: -60 }); // No offer out yet: this is fine.
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    const deadline = g.night().recruit!.deadline;
    expect(g.no(HOST, { type: "adjustTimer", deltaSeconds: -60 })).toMatch(/can't be shortened/);
    g.host({ type: "pause" });
    expect(g.no(HOST, { type: "adjustTimer", deltaSeconds: -60 })).toMatch(/can't be shortened/);
    g.host({ type: "resume" });
    expect(g.phase).toBe("NIGHT");
    const resumed = g.night().recruit!.deadline;
    expect(resumed).toBeGreaterThanOrEqual(deadline);
    g.host({ type: "adjustTimer", deltaSeconds: 60 });
    expect(g.night().recruit!.deadline).toBe(resumed + 60_000);
  });

  it("a normal offer's timer can still be shortened: running out isn't fatal there", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.host({ type: "adjustTimer", deltaSeconds: -30 });
    expect(g.state.deadline).toBe(g.night().recruit!.deadline);
  });

  it("switching it on clears a pick already made, so that pick can't murder on a blackmail night", () => {
    const g = dealt(12, { settings: { traitorCount: 2 }, traitors: ["p1", "p2"] });
    g.circle();
    g.banish("p12");
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "murder" });
    g.host({ type: "eliminatePlayer", playerId: "p2", status: "left", reason: "Went home" });
    expect(g.phase).toBe("NIGHT");
    g.host({ type: "setBlackmail", on: true });
    expect(g.night().picks).toEqual({});
    g.expire();
    expect(g.p("p5").status).toBe("alive");
    expect(g.night()).toMatchObject({ victimId: null, reason: "noValidPicks" });
  });

  it("a shield still blocks the murder", () => {
    const g = blackmailNight();
    g.host({ type: "giveItem", itemType: "shield", playerId: "p5", reason: "Test" });
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    expect(g.p("p5").status).toBe("alive");
    expect(g.night()).toMatchObject({ victimId: null, targetId: "p5", reason: "shield" });
  });

  it("no pick before the night timer ends: nobody dies", () => {
    const g = blackmailNight();
    g.now = g.state.deadline! + 1;
    g.expire();
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.night()).toMatchObject({ victimId: null, reason: "noValidPicks" });
  });

  it("the host ending the night with an offer out cancels it: nobody dies", () => {
    const g = blackmailNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.host({ type: "resolveNight" });
    expect(g.p("p5").status).toBe("alive");
    expect(g.night()).toMatchObject({ victimId: null, reason: "host" });
  });

  it("the recruit leaving mid-offer lets the Traitor choose someone else, past the normal offer limit", () => {
    const g = blackmailNight();
    g.host({ type: "overrideSetting", key: "recruitOffersPerNight", value: 1, reason: "One offer only" });
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.host({ type: "eliminatePlayer", playerId: "p5", status: "left", reason: "Went home" });
    expect(g.phase).toBe("NIGHT");
    g.by("p1", { type: "nightPick", targetId: "p6", mode: "recruit" });
    g.by("p6", { type: "answerRecruit", accept: false });
    expect(g.night()).toMatchObject({ victimId: "p6", reason: "blackmailRefused" });
  });

  it("the host can switch it on or off during the night, until an offer is out", () => {
    const g = lastTraitorNight();
    expect(g.night().blackmail).toBe(false);
    g.host({ type: "setBlackmail", on: true });
    expect(g.night().blackmail).toBe(true);
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p5", mode: "murder" })).toMatch(/blackmail night/);
    g.host({ type: "setBlackmail", on: false });
    expect(g.night().blackmail).toBe(false);
    g.host({ type: "setBlackmail", on: true });
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(g.no(HOST, { type: "setBlackmail", on: false })).toMatch(/already out/);
  });

  it("with two Traitors alive, a night switch waits for the next lone-Traitor night instead", () => {
    const g = dealt(12, { settings: { traitorCount: 2 }, traitors: ["p1", "p2"] });
    g.circle();
    g.banish("p12");
    g.host({ type: "setBlackmail", on: true });
    expect(g.night().blackmail).toBe(false);
    expect(g.state.blackmailNext).toBe(true);
    g.by("p1", { type: "nightPick", targetId: "p6", mode: "murder" });
    expect(g.phase).toBe("NIGHT");
  });

  it("only the host and the blackmailed players can tell: no screen, Innocent or ghost sees it", () => {
    const g = blackmailNight();
    noLeaks(g);
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!.night!.blackmail).toBe(true);
    expect(JSON.stringify(viewFor(g.state, { kind: "screen" }))).not.toContain("blackmail");
    expect(JSON.stringify(viewFor(g.state, { kind: "player", playerId: "p6" }))).not.toContain('"blackmail":true');
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    noLeaks(g);
    expect(JSON.stringify(viewFor(g.state, { kind: "player", playerId: "p6" }))).not.toContain('"blackmail":true');
    expect(viewFor(g.state, HOST_VIEWER).host!.nights.at(-1)!.blackmail).toBe(true);
  });

  it("a refusal that leaves the Traitors level hands them the win at the reveal", () => {
    const g = dealt(6, { settings: { traitorCount: 1, endCondition: "parity" }, traitors: ["p1"] });
    g.circle();
    g.banish("p6");
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "murder" });
    g.host({ type: "revealMurder" });
    g.circle();
    g.host({ type: "setBlackmail", on: true });
    g.banish("p4");
    expect(g.night().blackmail).toBe(true);
    g.by("p1", { type: "nightPick", targetId: "p2", mode: "recruit" });
    g.by("p2", { type: "answerRecruit", accept: false });
    expect(g.phase).toBe("MURDER_REVEAL");
    g.host({ type: "revealMurder" });
    expect(g.phase).toBe("FINALE");
    expect(g.state.finale!.winner).toBe("traitors");
  });

  it("older saved games load with no blackmail fields and play on", () => {
    const g = lastTraitorNight();
    const old = structuredClone(g.state) as unknown as Record<string, unknown> & { nights: Array<Record<string, unknown>> };
    delete old.blackmailNext;
    for (const n of old.nights) delete n.blackmail;
    const s = normaliseState(old as unknown as typeof g.state);
    expect(s.blackmailNext).toBe(false);
    expect(s.nights.at(-1)!.blackmail).toBe(false);
  });
});
