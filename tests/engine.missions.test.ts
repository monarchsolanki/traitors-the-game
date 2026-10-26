import { describe, expect, it } from "vitest";
import { viewFor } from "@/lib/game/view";
import { HOST, as, dealt } from "./helpers";

describe("optional missions (section 5.7)", () => {
  it("after roles are dealt the host runs none, one or several missions before the Circle", () => {
    const none = dealt(12);
    none.host({ type: "openCircle" });
    expect(none.phase).toBe("CIRCLE_DEBATE");

    const several = dealt(12);
    several.host({ type: "startMission", name: "Dumb Charades", kind: "team", winRule: "Most titles", tieRule: "Sudden death" });
    several.host({ type: "startMission", name: "Antakshari", kind: "team" });
    expect(several.state.missions.map((m) => [m.order, m.status])).toEqual([
      [1, "done"],
      [2, "active"],
    ]);
    several.host({ type: "openCircle" });
    expect(several.state.missions.every((m) => m.status === "done")).toBe(true);
  });

  it("after a murder reveal the host chooses again", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p12");
    g.pickAll("p11");
    expect(g.no(HOST, { type: "startMission", name: "Mystery Box", kind: "individual" })).toMatch(/Reveal the murder/);
    g.host({ type: "revealMurder" });
    g.host({ type: "startMission", name: "Mystery Box", kind: "individual" });
    expect(g.state.missions[0]).toMatchObject({ day: 2, order: 1 });
  });

  it("missions can't start mid-Circle or at night", () => {
    const g = dealt(12);
    g.circle();
    expect(g.no(HOST, { type: "startMission", name: "X", kind: "team" })).toMatch(/can't do that/);
  });

  it("the win and tie rule are announced publicly; winners and awards are not", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Hidden Diya Hunt", kind: "team", winRule: "Golden diya", tieRule: "None" });
    g.host({ type: "setMissionWinners", playerIds: ["p5"] });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p5"] });
    const pub = viewFor(g.state, { kind: "screen" });
    expect(pub.missions[0]).toMatchObject({ name: "Hidden Diya Hunt", winRule: "Golden diya", tieRule: "None" });
    expect(JSON.stringify(pub)).not.toMatch(/winnerIds|itemAwarded|"shield"/);
    expect(viewFor(g.state, { kind: "player", playerId: "p6" }).me!.items).toEqual([]);
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.items).toHaveLength(1);
  });
});

describe("awards (sections 5.6, 5.7)", () => {
  it("one ability to several players at once, and several abilities from one mission", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Balloon Relay", kind: "team" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p4", "p5", "p6"] });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4", "p7"] });
    expect(g.state.items.filter((i) => i.state === "held")).toHaveLength(5);
    expect(g.state.items.every((i) => i.missionId === g.state.missions[0].id)).toBe(true);
  });

  it("no player holds two of the same; the host is warned and nothing is given", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    expect(g.no(HOST, { type: "awardItem", itemType: "dagger", playerIds: ["p5", "p4"] })).toMatch(/P4 already holds/);
    expect(g.items("p5")).toHaveLength(0);
  });

  it("only living players receive abilities", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p12");
    g.pickAll("p11");
    g.host({ type: "revealMurder" });
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    expect(g.no(HOST, { type: "awardItem", itemType: "shield", playerIds: ["p12"] })).toMatch(/ghost/);
  });

  it("the host changes or undoes an award, logged with a reason", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    const id = g.items("p4")[0].id;
    expect(g.no(HOST, { type: "moveItem", itemId: id, toPlayerId: "p5", reason: "" })).toMatch(/reason/);
    g.host({ type: "moveItem", itemId: id, toPlayerId: "p5", reason: "Wrong winner" });
    expect(g.items("p5")).toHaveLength(1);
    g.host({ type: "removeItem", itemId: id, reason: "Mission void" });
    expect(g.state.items).toHaveLength(0);
    g.host({ type: "giveItem", itemType: "shield", playerId: "p6", reason: "Make-up prize" });
    expect(g.items("p6", "shield")).toHaveLength(1);
    expect(g.state.log.filter((l) => l.override).length).toBe(3);
  });

  it("a used item can't be moved or removed", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    const id = g.items("p4")[0].id;
    g.circle();
    g.by("p4", { type: "castVote", targetId: "p5", useDagger: true });
    expect(g.no(HOST, { type: "removeItem", itemId: id, reason: "x" })).toMatch(/still held/);
  });
});

describe("private reward vote among the winners (section 5.7)", () => {
  const withVote = () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Tower of Terror", kind: "team" });
    g.host({ type: "openRewardVote", itemType: "shield", voterIds: ["p4", "p5", "p6"] });
    return g;
  };

  it("the winners vote; the most votes gets the ability", () => {
    const g = withVote();
    expect(g.no(as("p7"), { type: "castRewardVote", targetId: "p4" })).toMatch(/Only the mission winners/);
    expect(g.no(as("p4"), { type: "castRewardVote", targetId: "p4" })).toMatch(/yourself/);
    g.by("p4", { type: "castRewardVote", targetId: "p5" });
    g.by("p5", { type: "castRewardVote", targetId: "p6" });
    g.by("p6", { type: "castRewardVote", targetId: "p5" });
    expect(g.items("p5", "shield")).toHaveLength(1);
    expect(g.lastRound().result).toMatchObject({ outcome: "award", playerId: "p5", via: "votes" });
  });

  it("a tie is settled at random among the tied", () => {
    const g = withVote();
    g.by("p4", { type: "castRewardVote", targetId: "p5" });
    g.by("p5", { type: "castRewardVote", targetId: "p6" });
    g.by("p6", { type: "castRewardVote", targetId: "p4" });
    expect(g.lastRound().result).toMatchObject({ outcome: "award", via: "random" });
    expect(g.state.items.filter((i) => i.type === "shield")).toHaveLength(1);
  });

  it("the timer running out settles it with the votes in", () => {
    const g = withVote();
    g.by("p4", { type: "castRewardVote", targetId: "p6" });
    g.expire();
    expect(g.items("p6", "shield")).toHaveLength(1);
  });

  it("blocks moving on until it closes", () => {
    const g = withVote();
    expect(g.no(HOST, { type: "openCircle" })).toMatch(/reward vote first/);
    g.host({ type: "lockRewardVote" });
    g.host({ type: "openCircle" });
  });

  it("is private: other players and the big screen see nothing of it", () => {
    const g = withVote();
    g.by("p4", { type: "castRewardVote", targetId: "p5" });
    expect(viewFor(g.state, { kind: "screen" }).round).toBeNull();
    expect(viewFor(g.state, { kind: "player", playerId: "p7" }).me!.rewardVote).toBeNull();
    expect(viewFor(g.state, { kind: "player", playerId: "p5" }).me!.rewardVote).toMatchObject({ submitted: false });
  });

  it("needs at least two winners free to receive it", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "X", kind: "team" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p4"] });
    expect(g.no(HOST, { type: "openRewardVote", itemType: "shield", voterIds: ["p4", "p5"] })).toMatch(/free to receive/);
  });
});
