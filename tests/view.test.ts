import { describe, expect, it } from "vitest";
import { allViewers, findLeaks } from "@/lib/game/leaks";
import { viewFor } from "@/lib/game/view";
import { HOST, as, dealt, lobby } from "./helpers";

const noLeaks = (g: ReturnType<typeof dealt>) => {
  for (const v of allViewers(g.state)) expect(findLeaks(g.state, v)).toEqual([]);
};

describe("viewFor (section 9.4)", () => {
  it("host sees everything except the seed", () => {
    const g = dealt(12);
    const v = viewFor(g.state, { kind: "host" });
    expect(v.players.every((p) => p.role !== null)).toBe(true);
    expect(v.host!.roles).toEqual(g.state.roles);
    expect("seed" in v.host!).toBe(false);
    noLeaks(g);
  });

  it("an Innocent sees only their own role", () => {
    const g = dealt(12);
    const v = viewFor(g.state, { kind: "player", playerId: "p5" });
    expect(v.me!.role).toBe("innocent");
    expect(v.players.every((p) => p.role === null)).toBe(true);
    expect(v.traitor).toBeUndefined();
  });

  it("a Traitor sees fellow Traitors and the chat", () => {
    const g = dealt(12);
    g.by("p1", { type: "sendChat", text: "secret-plan-xyz" });
    const v = viewFor(g.state, { kind: "player", playerId: "p2" });
    expect(v.traitor!.fellowTraitorIds.sort()).toEqual(["p1", "p3"]);
    expect(v.traitor!.chat!.map((c) => c.text)).toEqual(["secret-plan-xyz"]);
    expect(JSON.stringify(viewFor(g.state, { kind: "player", playerId: "p5" }))).not.toContain("secret-plan-xyz");
    expect(JSON.stringify(viewFor(g.state, { kind: "screen" }))).not.toContain("secret-plan-xyz");
    noLeaks(g);
  });

  it("night: Traitors see their own pick and only who has picked, not whom", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p12");
    g.by("p1", { type: "nightPick", targetId: "p5" });
    const v = viewFor(g.state, { kind: "player", playerId: "p2" });
    expect(v.traitor!.night).toMatchObject({ myPickId: null, pickStatus: { p1: true, p2: false, p3: false } });
    expect(JSON.stringify(v.traitor!.night)).not.toContain("p5");
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).traitor!.night!.myPickId).toBe("p5");
    noLeaks(g);
  });

  it("the murder victim stays 'alive' on every screen, their own included, until the reveal", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p12");
    g.pickAll("p5");
    expect(g.p("p5").status).toBe("murdered");
    for (const viewer of [{ kind: "screen" as const }, { kind: "player" as const, playerId: "p5" }]) {
      const v = viewFor(g.state, viewer);
      expect(v.players.find((p) => p.id === "p5")!.status).toBe("alive");
      expect(v.night!.victimId).toBeNull();
    }
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.isGhost).toBe(false);
    noLeaks(g);
    g.host({ type: "revealMurder" });
    expect(viewFor(g.state, { kind: "screen" }).night!.victimId).toBe("p5");
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.isGhost).toBe(true);
    noLeaks(g);
  });

  it("a ghost sees no roles, no fellow Traitors and no chat, even if they were a Traitor", () => {
    const g = dealt(12);
    g.by("p2", { type: "sendChat", text: "after-dark-777" });
    g.circle();
    g.banish("p1");
    const v = viewFor(g.state, { kind: "player", playerId: "p1" });
    expect(v.me!.isGhost).toBe(true);
    expect(v.me!.role).toBe("traitor");
    expect(v.traitor).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain("after-dark-777");
    noLeaks(g);
  });

  it("ballots: hidden while open, then shown one by one, then all after the reveal", () => {
    const g = dealt(12);
    g.circle();
    g.by("p4", { type: "castVote", targetId: "p5" });
    let r = viewFor(g.state, { kind: "screen" }).round!;
    expect(r).toMatchObject({ status: "open", submittedCount: 1, ballots: [] });
    g.host({ type: "lockVoting" });
    r = viewFor(g.state, { kind: "screen" }).round!;
    expect(r.ballots).toEqual([]);
    g.host({ type: "revealNextBallot" });
    r = viewFor(g.state, { kind: "screen" }).round!;
    expect(r.ballots).toEqual([{ voterId: "p4", targetId: "p5", choice: null, weight: 1, usedDagger: false, ghost: false }]);
    g.reveal();
    expect(viewFor(g.state, { kind: "screen" }).pastRounds[0].totals!.p5).toBe(1);
    noLeaks(g);
  });

  it("a dagger ballot shows its weight only when revealed", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.by("p4", { type: "castVote", targetId: "p5", useDagger: true });
    expect(JSON.stringify(viewFor(g.state, { kind: "screen" }))).not.toMatch(/usedDagger":true/);
    g.host({ type: "lockVoting" });
    g.host({ type: "revealNextBallot" });
    expect(viewFor(g.state, { kind: "screen" }).round!.ballots[0]).toMatchObject({ weight: 2, usedDagger: true });
  });

  it("items are private to their holder", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p4"] });
    expect(viewFor(g.state, { kind: "player", playerId: "p4" }).me!.items).toEqual([
      { id: g.items("p4")[0].id, type: "shield", state: "held" },
    ]);
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.items).toEqual([]);
    noLeaks(g);
  });

  it("roles hidden on elimination by default; shown when revealOnElimination is on", () => {
    const hidden = dealt(12);
    hidden.circle();
    hidden.banish("p1");
    expect(viewFor(hidden.state, { kind: "screen" }).players.find((p) => p.id === "p1")!.role).toBeNull();
    const shown = dealt(12, { settings: { revealOnElimination: true } });
    shown.circle();
    shown.banish("p1");
    expect(viewFor(shown.state, { kind: "screen" }).players.find((p) => p.id === "p1")!.role).toBe("traitor");
    noLeaks(shown);
  });

  it("the result stays with the host until the host reveals it (decided 27 October)", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p12");
    g.host({ type: "endGameEarly", reason: "Test" });
    for (const viewer of [{ kind: "screen" as const }, { kind: "player" as const, playerId: "p5" }, { kind: "player" as const, playerId: "p12" }]) {
      const v = viewFor(g.state, viewer);
      expect(v.finale).toBeNull();
      expect(v.finalePending).toBe(true);
      expect(v.players.every((p) => p.role === null)).toBe(true);
      expect(v.events.some((e) => e.type === "finale" || e.type === "gameOver")).toBe(false);
    }
    const host = viewFor(g.state, { kind: "host" });
    expect(host.finale).toMatchObject({ winner: "traitors" });
    noLeaks(g);
    expect(g.no(as("p5"), { type: "revealFinale" })).toMatch(/Only the host/);
  });

  it("the final reveal shows every role, the winners and the suspicion meter", () => {
    const g = dealt(12);
    g.host({ type: "endGameEarly", reason: "Test" });
    g.host({ type: "revealFinale" });
    expect(g.no(HOST, { type: "revealFinale" })).toMatch(/already revealed/);
    const v = viewFor(g.state, { kind: "screen" });
    expect(v.finalePending).toBe(false);
    expect(v.players.every((p) => p.role !== null)).toBe(true);
    expect(v.finale).toMatchObject({ winner: "traitors" });
    noLeaks(g);
  });

  it("the big screen and co-host get public state only", () => {
    const g = dealt(12);
    for (const kind of ["screen", "cohost"] as const) {
      const v = viewFor(g.state, { kind });
      expect(v.me).toBeUndefined();
      expect(v.traitor).toBeUndefined();
      expect(v.host).toBeUndefined();
      expect(v.players.every((p) => p.role === null)).toBe(true);
    }
  });

  it("works in the lobby, before roles exist", () => {
    const g = lobby(6);
    const v = viewFor(g.state, { kind: "player", playerId: "p1" });
    expect(v.me!.role).toBeNull();
    expect(v.me!.isGhost).toBe(false);
  });

  it("throws for an unknown player", () => {
    const g = lobby(6);
    expect(() => viewFor(g.state, { kind: "player", playerId: "nope" })).toThrow();
  });
});
