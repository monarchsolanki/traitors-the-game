import { describe, expect, it } from "vitest";
import { applyGameAction, createGame } from "@/lib/game/engine";
import { DEFAULT_ROSTER } from "@/lib/game/settings";
import { G, HOST, T0, as, dealt, lobby } from "./helpers";

describe("creating a game", () => {
  it("starts in the lobby with the default party roster and settings", () => {
    const s = createGame({ code: "DIWALI", seed: "x", at: T0 });
    expect(s.phase).toBe("LOBBY");
    expect(s.day).toBe(0);
    expect(s.version).toBe(0);
    expect(s.players.map((p) => p.displayName)).toEqual(DEFAULT_ROSTER.map((r) => r.displayName));
    expect(s.settings.traitorCount).toBe(3);
  });

  it("rejects a bad room code", () => {
    expect(() => createGame({ code: "ab", seed: "x", at: T0 })).toThrow();
  });
});

describe("roster editing (section 4.3)", () => {
  it("adds, renames and removes players in the lobby", () => {
    const g = lobby(5);
    g.host({ type: "addPlayer", name: "Monarch Guest", displayName: "Guest" });
    expect(g.state.players).toHaveLength(6);
    const id = g.state.players[5].id;
    g.host({ type: "editPlayer", playerId: id, displayName: "Guesty" });
    expect(g.p(id).displayName).toBe("Guesty");
    g.host({ type: "removePlayer", playerId: "p1" });
    expect(g.state.players.map((p) => p.seat)).toEqual([1, 2, 3, 4, 5]);
  });

  it("requires unique display names", () => {
    const g = lobby(5);
    expect(g.no(HOST, { type: "addPlayer", name: "Other", displayName: "p1" })).toMatch(/already shown/);
  });

  it("caps the roster at 20", () => {
    const g = lobby(20);
    expect(g.no(HOST, { type: "addPlayer", name: "Extra" })).toMatch(/at most 20/);
  });

  it("sets and clears photos at any time", () => {
    const g = dealt(6, { traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    g.host({ type: "setPhoto", playerId: "p3", photoPath: "game/p3.jpg" });
    expect(g.p("p3").photoPath).toBe("game/p3.jpg");
    g.host({ type: "setPhoto", playerId: "p3", photoPath: null });
    expect(g.p("p3").photoPath).toBeNull();
    expect(g.no(HOST, { type: "setPhoto", playerId: "p3", photoPath: "../x" })).toMatch(/isn't valid/);
  });

  it("only the host edits the roster", () => {
    const g = lobby(5);
    expect(g.no(as("p1"), { type: "addPlayer", name: "Sneaky" })).toMatch(/Only the host/);
  });

  it("can't remove a player after dealing; use eliminate instead", () => {
    const g = dealt(6, { traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    expect(g.no(HOST, { type: "removePlayer", playerId: "p4" })).toMatch(/eliminated instead/);
  });

  it("adding a player after dealing is a logged override with a role", () => {
    const g = dealt(6, { traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    expect(g.no(HOST, { type: "addPlayer", name: "Late" })).toMatch(/reason/);
    g.host({ type: "addPlayer", name: "Late", role: "innocent", reason: "Arrived late" });
    const late = g.state.players[6];
    expect(g.state.roles[late.id]).toBe("innocent");
    const entry = g.state.log[g.state.log.length - 1];
    expect(entry.override).toBe(true);
    expect(entry.reason).toBe("Arrived late");
  });
});

describe("seats (section 9.5, edge case: wrong photo)", () => {
  it("a player claims their seat; the host confirms; a taken seat can't be claimed again", () => {
    const g = lobby(5);
    g.by("p1", { type: "claimSeat" });
    expect(g.no(as("p1"), { type: "claimSeat" })).toMatch(/already taken/);
    g.host({ type: "confirmSeat", playerId: "p1" });
    expect(g.p("p1").seatConfirmed).toBe(true);
  });

  it("the host can't confirm an unclaimed seat", () => {
    const g = lobby(5);
    expect(g.no(HOST, { type: "confirmSeat", playerId: "p2" })).toMatch(/hasn't claimed/);
  });

  it("the host resets a wrongly claimed seat", () => {
    const g = lobby(5);
    g.by("p1", { type: "claimSeat" });
    g.host({ type: "resetSeat", playerId: "p1" });
    expect(g.p("p1").seatClaimed).toBe(false);
    g.by("p1", { type: "claimSeat" });
  });
});

describe("settings editor", () => {
  it("changes any setting in the lobby, validated", () => {
    const g = lobby(12);
    g.host({ type: "updateSettings", patch: { daggerWeight: 3, traitorCount: 4, debateSeconds: 600 } });
    expect(g.state.settings.daggerWeight).toBe(3);
    // In the lobby the table can still grow, so limits are for the most a game can hold (20); dealing checks the real count.
    expect(g.no(HOST, { type: "updateSettings", patch: { traitorCount: 7 } })).toMatch(/traitorCount/);
    expect(g.no(HOST, { type: "updateSettings", patch: { voteSeconds: 5 } })).toMatch(/voteSeconds/);
    expect(g.no(HOST, { type: "updateSettings", patch: { endGameThreshold: 20 } })).toMatch(/endGameThreshold/);
  });

  it("freezes rule settings when roles are dealt; timers and anyTime settings still change", () => {
    const g = dealt(12);
    expect(g.no(HOST, { type: "updateSettings", patch: { daggerWeight: 3 } })).toMatch(/frozen.*override/);
    expect(g.no(HOST, { type: "updateSettings", patch: { traitorCount: 2 } })).toMatch(/frozen/);
    g.host({ type: "updateSettings", patch: { debateSeconds: 300, suspectPoll: false, pinMaxAttempts: 3 } });
    expect(g.state.settings.debateSeconds).toBe(300);
    g.host({
      type: "updateSettings",
      patch: { ghostGames: { bhootBets: false, crystalBall: true, liveReactions: true, bhootBingo: false } },
    });
    expect(g.state.settings.ghostGames.bhootBets).toBe(false);
  });

  it("a frozen rule changes only by a logged override with a reason; Traitor count never", () => {
    const g = dealt(12);
    expect(g.no(HOST, { type: "overrideSetting", key: "daggerWeight", value: 3, reason: "" })).toMatch(/reason/);
    g.host({ type: "overrideSetting", key: "daggerWeight", value: 3, reason: "Spice it up" });
    expect(g.state.settings.daggerWeight).toBe(3);
    expect(g.state.log[g.state.log.length - 1]).toMatchObject({ override: true, reason: "Spice it up" });
    expect(g.no(HOST, { type: "overrideSetting", key: "traitorCount", value: 2, reason: "x" })).toMatch(/can't change/);
    expect(g.no(HOST, { type: "overrideSetting", key: "endGameThreshold", value: 12, reason: "x" })).toMatch(/between 2 and 11/);
    g.host({ type: "overrideSetting", key: "endGameThreshold", value: 4, reason: "Running late" });
    expect(g.state.settings.endGameThreshold).toBe(4);
  });
});

describe("dealing roles (section 5.1 ROLES)", () => {
  it("needs every seat claimed and confirmed", () => {
    const g = lobby(6, { traitorCount: 2 });
    g.by("p1", { type: "claimSeat" });
    expect(g.no(HOST, { type: "dealRoles" })).toMatch(/Waiting on/);
  });

  it("needs 5 to 20 players and valid settings", () => {
    const g = lobby(4, { traitorCount: 1 });
    g.seatAll();
    expect(g.no(HOST, { type: "dealRoles" })).toMatch(/At least 5/);
    const h = lobby(6, { traitorCount: 3 });
    h.seatAll();
    expect(h.no(HOST, { type: "dealRoles" })).toMatch(/at most 2/);
  });

  it("deals exactly traitorCount Traitors, freezes settings, resolves the threshold and starts day 1", () => {
    for (const [n, k] of [
      [5, 1],
      [10, 3],
      [12, 3],
      [12, 4],
      [20, 6],
    ] as const) {
      const g = lobby(n, { traitorCount: k });
      g.seatAll();
      g.host({ type: "dealRoles" });
      const traitors = Object.values(g.state.roles).filter((r) => r === "traitor");
      expect(traitors).toHaveLength(k);
      expect(Object.keys(g.state.roles)).toHaveLength(n);
      expect(g.phase).toBe("ROLES");
      expect(g.state.day).toBe(1);
      expect(g.state.frozen?.startingPlayerCount).toBe(n);
      expect(g.state.settings.endGameThreshold).toBe(Math.floor(n / 2));
    }
  });

  it("is random but reproducible from the seed", () => {
    const deal = (seed: string) => {
      let s = createGame({ code: "TEST", seed, at: T0 });
      for (const p of s.players) {
        const r1 = applyGameAction(s, { type: "claimSeat", actor: as(p.id), at: T0 });
        if (!r1.ok) throw new Error(r1.reason);
        const r2 = applyGameAction(r1.nextState, { type: "confirmSeat", playerId: p.id, actor: HOST, at: T0 });
        if (!r2.ok) throw new Error(r2.reason);
        s = r2.nextState;
      }
      const r = applyGameAction(s, { type: "dealRoles", actor: HOST, at: T0 });
      if (!r.ok) throw new Error(r.reason);
      return Object.entries(r.nextState.roles).filter(([, v]) => v === "traitor").map(([k]) => k).join(",");
    };
    expect(deal("a")).toBe(deal("a"));
    const variety = new Set(["a", "b", "c", "d", "e", "f"].map(deal));
    expect(variety.size).toBeGreaterThan(1);
  });

  it("can't deal twice", () => {
    const g = dealt(6, { traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    expect(g.no(HOST, { type: "dealRoles" })).toMatch(/can't do that/);
  });

  it("players open their role, and the host can move on without waiting", () => {
    const g = dealt(6, { traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    g.by("p3", { type: "acknowledgeRole" });
    expect(g.state.roleSeen.p3).toBe(true);
    expect(g.state.roleSeen.p4).toBe(false);
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("CIRCLE_DEBATE");
  });

  it("every action bumps the version by exactly one; rejected actions change nothing", () => {
    const g = lobby(5, { traitorCount: 1 });
    const v = g.state.version;
    g.no(HOST, { type: "dealRoles" });
    expect(g.state.version).toBe(v);
    g.by("p1", { type: "claimSeat" });
    expect(g.state.version).toBe(v + 1);
  });
});

describe("games start empty (owner, 6 November)", () => {
  it("lobby settings and presets work before any player is added; dealing checks the real count", () => {
    const g = new G(createGame({ code: "EMPTY", seed: "s", at: T0, roster: [] }));
    expect(g.state.players).toEqual([]);
    g.host({ type: "updateSettings", patch: { traitorCount: 3 } });
    g.host({ type: "applyPreset", settings: { ...g.state.settings, traitorCount: 4 }, missions: [] });
    for (const name of ["Asha", "Bala", "Chitra", "Dev", "Esha", "Farid"]) g.host({ type: "addPlayer", name });
    g.seatAll();
    expect(g.no(HOST, { type: "dealRoles" })).toMatch(/Traitors: at most 2 for 6 players/);
    g.host({ type: "updateSettings", patch: { traitorCount: 2 } });
    g.host({ type: "dealRoles" });
    expect(g.phase).toBe("ROLES");
  });
});

