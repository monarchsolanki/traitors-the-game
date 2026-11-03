import { describe, expect, it } from "vitest";
import { newKey } from "@/lib/client/api";
import { paperFallbackHtml } from "@/lib/client/paper";
import { viewFor } from "@/lib/game/view";
import { ONLINE_MS, presence } from "@/components/host/SeatDot";
import { dealt } from "./helpers";

describe("paper fallback (section 9.6)", () => {
  it("lists every player's role, status and held items, with blank slips for the living", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.banish("p12");
    const html = paperFallbackHtml(viewFor(g.state, { kind: "host" }), new Date("2026-10-31T19:30:00+05:30"));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("room TEST");
    expect((html.match(/class="traitor">Traitor/g) ?? []).length).toBe(3);
    expect(html).toContain("Banished");
    expect(html).toContain("Dagger");
    expect((html.match(/class="slip"/g) ?? []).length).toBe(11);
  });

  it("escapes names so a player name can't inject markup", () => {
    const g = dealt(6, { traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    g.host({ type: "editPlayer", playerId: "p3", displayName: "<b>x</b>" });
    const html = paperFallbackHtml(viewFor(g.state, { kind: "host" }), new Date());
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("needs the host view", () => {
    const g = dealt(6, { traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    expect(() => paperFallbackHtml(viewFor(g.state, { kind: "screen" }), new Date())).toThrow();
  });
});

describe("connection badges", () => {
  const now = Date.parse("2026-10-31T20:00:00Z");
  const seat = (o: Partial<Parameters<typeof presence>[0] & object> = {}) => ({
    playerId: "p1",
    bound: true,
    isBot: false,
    locked: false,
    failedAttempts: 0,
    lastSeen: new Date(now - 10_000).toISOString(),
    ...o,
  });
  it("online when the phone reported in recently", () => expect(presence(seat(), now)).toBe("online"));
  it("offline when quiet for too long", () =>
    expect(presence(seat({ lastSeen: new Date(now - ONLINE_MS - 1).toISOString() }), now)).toBe("offline"));
  it("offline when no phone holds the seat", () => expect(presence(seat({ bound: false }), now)).toBe("offline"));
  it("bots and empty seats", () => {
    expect(presence(seat({ isBot: true }), now)).toBe("bot");
    expect(presence(undefined, now)).toBe("none");
  });
});

describe("newKey", () => {
  it("still makes unique, UUID-shaped keys where crypto.randomUUID is missing (plain HTTP, older phones)", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = newKey();
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(newKey()).not.toBe(a);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
