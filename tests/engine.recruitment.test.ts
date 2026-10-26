import { describe, expect, it } from "vitest";
import { viewFor } from "@/lib/game/view";
import { HOST, as, dealt } from "./helpers";

/**
 * Recruitment gate (section 5.4): accept, refuse, timeout, the role change, the new Traitor's
 * place in the next night, and the win check afterwards. Recruitment stays off until these pass.
 */
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
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p6" })).toMatch(/already sent/);
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

  it("refuse: nobody dies, no role changes", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: false });
    expect(g.state.roles.p5).toBe("innocent");
    expect(g.night()).toMatchObject({ victimId: null, reason: "recruitRefused" });
  });

  it("timeout: nobody dies, and a late answer is rejected", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(g.state.deadline).toBe(g.night().recruit!.deadline);
    g.now = g.night().recruit!.deadline + 1;
    expect(g.no(as("p5"), { type: "answerRecruit", accept: true })).toMatch(/run out/);
    g.expire();
    expect(g.state.roles.p5).toBe("innocent");
    expect(g.night()).toMatchObject({ victimId: null, reason: "recruitTimeout" });
  });

  it("the murder and recruit reveals look the same as a shield save", () => {
    const g = lastTraitorNight();
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.by("p5", { type: "answerRecruit", accept: true });
    g.host({ type: "revealMurder" });
    const reveal = g.state.events.filter((e) => e.type === "murderRevealed").pop()!;
    expect(reveal.audience).toEqual({ kind: "public" });
    expect(reveal.data).toEqual({ nightId: g.night().id, victimId: null, role: null });
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
    void HOST;
  });
});
