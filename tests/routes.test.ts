import { beforeEach, describe, expect, it, vi } from "vitest";
import { findLeaks } from "@/lib/game/leaks";
import type { GameState, Viewer } from "@/lib/game/types";
import { viewFor } from "@/lib/game/view";
import { FakeSupabase } from "./fakes/supabase";

/**
 * Break-it tests (Step 4): every route against every kind of caller, through the real route and
 * server code, with an in-memory database standing in for Supabase.
 */
declare global {
  var __fakeDb: FakeSupabase;
}
vi.mock("@/lib/server/supabase", async () => {
  const m = await import("./fakes/supabase");
  return { adminClient: () => m.fakeClient(globalThis.__fakeDb), PHOTO_BUCKET: "player-photos" };
});

import * as actionRoute from "@/app/api/games/[code]/action/route";
import * as botsRoute from "@/app/api/games/[code]/bots/route";
import * as photoRoute from "@/app/api/games/[code]/photo/route";
import * as seatRoute from "@/app/api/games/[code]/seat/route";
import * as seatsRoute from "@/app/api/games/[code]/seats/route";
import * as undoRoute from "@/app/api/games/[code]/undo/route";
import * as viewRoute from "@/app/api/games/[code]/view/route";
import * as gamesRoute from "@/app/api/games/route";
import * as meRoute from "@/app/api/me/route";

type Handler = (req: Request, ctx: { params: Promise<{ code: string }> }) => Promise<Response>;
interface Res {
  status: number;
  body: Record<string, unknown> & { view?: ReturnType<typeof viewFor>; seats?: unknown };
}

let code = "";
let keyN = 0;
const key = () => `test-key-${++keyN}-${Math.random().toString(36).slice(2)}`;

async function call(
  handler: Handler | ((req: Request) => Promise<Response>),
  o: { method?: string; token?: string; body?: unknown; form?: FormData; query?: string } = {},
): Promise<Res> {
  const headers: Record<string, string> = {};
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  const req = new Request(`http://test.local/api/games/${code}/x${o.query ?? ""}`, {
    method: o.method ?? (o.body !== undefined || o.form ? "POST" : "GET"),
    headers,
    body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve({ code }) });
  return { status: res.status, body: (await res.json()) as Res["body"] };
}

const state = (): GameState => globalThis.__fakeDb.tables.games.find((g) => g.code === code)!.state as GameState;
const act = (token: string, as: "host" | "player" | "system", action: unknown, extra: Record<string, unknown> = {}) =>
  call(actionRoute.POST, { token, body: { as, key: key(), action, ...extra } });
const PHONES = Array.from({ length: 12 }, (_, i) => `phone-${i + 1}`);
const pid = (i: number) => `p${i + 1}`;

/** The route's view must be exactly viewFor for that caller, and leak nothing. */
function expectExactView(res: Res, viewer: Viewer) {
  expect(res.status).toBe(200);
  const s = state();
  expect(res.body.view).toEqual(JSON.parse(JSON.stringify(viewFor(s, viewer))));
  expect(findLeaks(s, viewer)).toEqual([]);
  if (viewer.kind !== "host") expect(res.body.seats).toBeUndefined();
}

async function seatEveryone() {
  for (let i = 0; i < 12; i++) {
    const r = await call(seatRoute.POST, { token: PHONES[i], body: { playerId: pid(i), pin: "1234" } });
    expect(r.status).toBe(200);
  }
  for (let i = 0; i < 12; i++) expect((await act("host-a", "host", { type: "confirmSeat", playerId: pid(i) })).status).toBe(200);
}

beforeEach(async () => {
  const db = new FakeSupabase();
  globalThis.__fakeDb = db;
  db.addUser("host-a", "u-host-a", false);
  db.addUser("host-b", "u-host-b", false);
  db.addUser("account", "u-account", false);
  db.addUser("stranger", "u-stranger", true);
  PHONES.forEach((t, i) => db.addUser(t, `u-phone-${i + 1}`, true));
  db.tables.hosts.push({ user_id: "u-host-a", display_name: "Monarch" }, { user_id: "u-host-b", display_name: "Other" });
  code = "";
  const created = await call(gamesRoute.POST as Handler, { token: "host-a", body: {} });
  expect(created.status).toBe(201);
  code = created.body.code as string;
});

describe("creating and listing games", () => {
  it("only listed hosts create or list games", async () => {
    for (const token of [undefined, "stranger", "account", "phone-1"]) {
      expect((await call(gamesRoute.POST as Handler, { token, body: {} })).status).toBe(token ? 403 : 401);
      expect((await call(gamesRoute.GET as Handler, { token })).status).toBe(token ? 403 : 401);
    }
    expect((await call(gamesRoute.GET as Handler, { token: "host-a" })).status).toBe(200);
  });

  it("/api/me says who's a host", async () => {
    expect((await call(meRoute.GET as Handler, {})).body).toEqual({ user: null, isHost: false });
    expect((await call(meRoute.GET as Handler, { token: "stranger" })).body.isHost).toBe(false);
    expect((await call(meRoute.GET as Handler, { token: "account" })).body.isHost).toBe(false);
    expect((await call(meRoute.GET as Handler, { token: "host-a" })).body.isHost).toBe(true);
  });
});

describe("view route: every viewer gets exactly its own view", () => {
  it("in the lobby, after dealing, at night and in the final reveal", async () => {
    await seatEveryone();
    const checkAll = async () => {
      expectExactView(await call(viewRoute.GET, { query: "?as=screen" }), { kind: "screen" });
      expectExactView(await call(viewRoute.GET, { token: "host-a", query: "?as=host" }), { kind: "host" });
      for (let i = 0; i < 12; i++) {
        expectExactView(await call(viewRoute.GET, { token: PHONES[i], query: "?as=player" }), { kind: "player", playerId: pid(i) });
      }
      const stranger = await call(viewRoute.GET, { token: "stranger", query: "?as=player" });
      expect(stranger.body.seated).toBe(false);
      expectExactView(stranger, { kind: "screen" });
    };
    await checkAll();
    await act("host-a", "host", { type: "dealRoles" });
    await checkAll();
    const traitors = Object.entries(state().roles).filter(([, r]) => r === "traitor").map(([id]) => id);
    const t = traitors.map((id) => PHONES[Number(id.slice(1)) - 1]);
    const chat = await act(t[0], "player", { type: "sendChat", text: "secret-chat-zz9" });
    expect(`${chat.status} ${chat.body.error ?? ""}`).toBe("200 ");
    await act("host-a", "host", { type: "openCircle" });
    await act("host-a", "host", { type: "openVoting" });
    const innocent = Object.keys(state().roles).find((id) => state().roles[id] === "innocent")!;
    const vote = await act(t[0], "player", { type: "castVote", targetId: innocent });
    expect(`${vote.status} ${vote.body.error ?? ""}`).toBe("200 ");
    await checkAll();
    await act("host-a", "host", { type: "lockVoting" });
    await act("host-a", "host", { type: "revealNextBallot" }, { expectedVersion: state().version });
    await checkAll();
    await act("host-a", "host", { type: "finishReveal" });
    await checkAll();
    const aliveTraitor = traitors.find((id) => state().players.find((p) => p.id === id)!.status === "alive");
    const aliveInnocent = state().players.find((p) => p.status === "alive" && state().roles[p.id] === "innocent")!.id;
    if (state().phase === "NIGHT" && aliveTraitor) {
      expect((await act(PHONES[Number(aliveTraitor.slice(1)) - 1], "player", { type: "nightPick", targetId: aliveInnocent })).status).toBe(200);
      await checkAll();
    }
    await act("host-a", "host", { type: "endGameEarly", reason: "Test" });
    await checkAll();
    await act("host-a", "host", { type: "revealFinale" });
    await checkAll();
  });

  it("the host view needs this game's host", async () => {
    for (const token of ["stranger", "account", "phone-1", "host-b"]) {
      expect((await call(viewRoute.GET, { token, query: "?as=host" })).status).toBe(403);
    }
    expect((await call(viewRoute.GET, { query: "?as=host" })).status).toBe(401);
    expect((await call(viewRoute.GET, { query: "?as=player" })).status).toBe(401);
    expect((await call(viewRoute.GET, { token: "host-a", query: "?as=wizard" })).status).toBe(400);
  });

  it("a missing game is a 404 for everyone", async () => {
    code = "ZZZZZ";
    expect((await call(viewRoute.GET, { query: "?as=screen" })).status).toBe(404);
    code = "bad code!";
    expect((await call(viewRoute.GET, { query: "?as=screen" })).status).toBe(404);
  });
});

describe("action route: who may do what", () => {
  it("host actions need this game's host", async () => {
    for (const token of ["stranger", "account", "phone-1", "host-b"]) {
      expect((await act(token, "host", { type: "dealRoles" })).status).toBe(403);
    }
    expect((await call(actionRoute.POST, { body: { as: "host", key: key(), action: { type: "dealRoles" } } })).status).toBe(401);
  });

  it("players can send only player actions, as themselves", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    const r = await act("phone-1", "player", { type: "endGameEarly", reason: "lol" });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/Only the host/);
    expect((await act("stranger", "player", { type: "acknowledgeRole" })).status).toBe(403);
    expect((await act("phone-1", "player", { type: "acknowledgeRole" })).status).toBe(200);
    expect(state().roleSeen.p1).toBe(true);
    expect(state().roleSeen.p2).toBe(false);
  });

  it("seat, photo and seat-reset actions can't go through the action route", async () => {
    for (const action of [{ type: "claimSeat" }, { type: "setPhoto", playerId: "p1", photoPath: "x" }, { type: "resetSeat", playerId: "p1" }]) {
      expect((await act("host-a", "host", action)).status).toBe(400);
    }
  });

  it("malformed requests and unknown senders are rejected", async () => {
    expect((await act("host-a", "host", { type: "nonsense" })).status).toBe(400);
    expect((await act("host-a", "system", { type: "dealRoles" })).status).toBe(400);
    expect((await call(actionRoute.POST, { token: "host-a", body: { as: "host", key: "short", action: { type: "pause" } } })).status).toBe(400);
    const bad = new Request(`http://test.local/api/games/${code}/action`, { method: "POST", headers: { Authorization: "Bearer host-a" }, body: "{not json" });
    expect((await actionRoute.POST(bad, { params: Promise.resolve({ code }) })).status).toBe(400);
  });

  it("a timer nudge works without signing in but does nothing early", async () => {
    const r = await call(actionRoute.POST, { body: { as: "system", key: key(), action: { type: "tick" } } });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/hasn't run out|Nothing/);
  });

  it("an error reply never carries more than the caller's own view", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    const r = await act("phone-2", "player", { type: "castVote", targetId: "p3" });
    expect(r.status).toBe(422);
    expectExactView({ status: 200, body: r.body }, { kind: "player", playerId: "p2" });
  });
});

describe("host tools need this game's host", () => {
  it("seat tools, bots, photos and undo", async () => {
    for (const token of [undefined, "stranger", "account", "phone-1", "host-b"]) {
      const want = token ? 403 : 401;
      expect((await call(seatsRoute.POST, { token, body: { op: "fillBots" } })).status).toBe(want);
      expect((await call(botsRoute.POST, { token, body: {} })).status).toBe(want);
      expect((await call(undoRoute.GET, { token })).status).toBe(want);
      expect((await call(undoRoute.POST, { token, body: { key: key(), expectedVersion: 0, reason: "x" } })).status).toBe(want);
      const form = new FormData();
      form.set("playerId", "p1");
      form.set("file", new Blob([new Uint8Array(10)], { type: "image/jpeg" }), "a.jpg");
      expect((await call(photoRoute.POST, { token, form })).status).toBe(want);
      expect((await call(photoRoute.DELETE, { token, method: "DELETE", query: "?playerId=p1" })).status).toBe(want);
    }
  });

  it("photos: only images, at most 5 MB, stored under this game", async () => {
    const send = (type: string, bytes: number) => {
      const form = new FormData();
      form.set("playerId", "p1");
      form.set("file", new Blob([new Uint8Array(bytes)], { type }), "a");
      return call(photoRoute.POST, { token: "host-a", form });
    };
    expect((await send("text/html", 10)).status).toBe(415);
    expect((await send("image/jpeg", 5 * 1024 * 1024 + 1)).status).toBe(413);
    expect((await send("image/jpeg", 1000)).status).toBe(200);
    const path = state().players[0].photoPath!;
    expect(path.startsWith(`${globalThis.__fakeDb.tables.games[0].id}/`)).toBe(true);
    const view = await call(viewRoute.GET, { query: "?as=screen" });
    expect((view.body.photoUrls as Record<string, string>)[path]).toMatch(/^https:\/\/signed/);
  });
});

describe("seats and PINs", () => {
  it("claiming needs a sign-in and a 4-digit PIN", async () => {
    expect((await call(seatRoute.POST, { body: { playerId: "p1", pin: "1234" } })).status).toBe(401);
    expect((await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p1", pin: "12a4" } })).status).toBe(400);
    expect((await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p99", pin: "1234" } })).status).toBe(404);
  });

  it("an expired sign-in is told apart from a wrong PIN, so phones renew only the sign-in", async () => {
    const expired = await call(seatRoute.POST, { token: "expired-token", body: { playerId: "p1", pin: "1234" } });
    expect([expired.status, expired.body.code]).toEqual([401, "session"]);
    const view = await call(viewRoute.GET, { token: "expired-token", query: "?as=player" });
    expect([view.status, view.body.code, view.body.view]).toEqual([401, "session", undefined]);
    expect((await act("expired-token", "player", { type: "acknowledgeRole" })).body.code).toBe("session");
    await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p1", pin: "1234" } });
    const wrong = await call(seatRoute.POST, { token: "stranger", body: { playerId: "p1", pin: "9999" } });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBeUndefined();
  });

  it("one seat per phone; a taken seat needs its PIN; wrong PINs lock it until the host unlocks", async () => {
    expect((await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p1", pin: "1234" } })).status).toBe(200);
    const twice = await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p2", pin: "1234" } });
    expect(twice.status).toBe(409);
    expect(twice.body.error).toMatch(/already holds/);
    for (let i = 0; i < 4; i++) {
      const r = await call(seatRoute.POST, { token: "stranger", body: { playerId: "p1", pin: "9999" } });
      expect(r.status).toBe(401);
    }
    const locked = await call(seatRoute.POST, { token: "stranger", body: { playerId: "p1", pin: "9999" } });
    expect(locked.body.error).toMatch(/locked/);
    expect((await call(seatRoute.POST, { token: "stranger", body: { playerId: "p1", pin: "1234" } })).status).toBe(423);
    expect((await call(seatsRoute.POST, { token: "host-a", body: { op: "unlock", playerId: "p1" } })).status).toBe(200);
    expect((await call(seatRoute.POST, { token: "stranger", body: { playerId: "p1", pin: "1234" } })).status).toBe(200);
    const old = await call(viewRoute.GET, { token: "phone-1", query: "?as=player" });
    expect(old.body.seated).toBe(false);
  });

  it("the PIN is stored hashed, never as typed", async () => {
    await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p1", pin: "4321" } });
    const seat = globalThis.__fakeDb.tables.seats.find((s) => s.player_id === "p1")!;
    expect(seat.pin_hash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(seat)).not.toContain('"4321"');
  });

  it("a bot's seat can't be claimed by a phone", async () => {
    await call(seatsRoute.POST, { token: "host-a", body: { op: "fillBots" } });
    const r = await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p1", pin: "1234" } });
    expect(r.status).toBe(409);
  });
});

describe("elimination, reconnecting and recovery", () => {
  it("a banished player's phone opens on the ghost view, and still leaks nothing", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    await act("host-a", "host", { type: "eliminatePlayer", playerId: "p4", status: "banished", reason: "Test" });
    const v = await call(viewRoute.GET, { token: "phone-4", query: "?as=player" });
    expectExactView(v, { kind: "player", playerId: "p4" });
    expect(v.body.view!.me!.isGhost).toBe(true);
    expect(v.body.view!.traitor).toBeUndefined();
  });

  it("a new phone takes the seat back with the PIN, mid-vote, and the ballot already cast stands", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    await act("host-a", "host", { type: "openCircle" });
    await act("host-a", "host", { type: "openVoting" });
    expect((await act("phone-3", "player", { type: "castVote", targetId: "p5" })).status).toBe(200);
    globalThis.__fakeDb.addUser("phone-3-new", "u-phone-3-new", true);
    expect((await call(seatRoute.POST, { token: "phone-3-new", body: { playerId: "p3", pin: "1234" } })).status).toBe(200);
    const v = await call(viewRoute.GET, { token: "phone-3-new", query: "?as=player" });
    expect(v.body.view!.me!.vote).toMatchObject({ submitted: true, myBallot: { targetId: "p5" } });
    expect((await act("phone-3", "player", { type: "acknowledgeRole" })).status).toBe(403);
  });

  it("a forgotten PIN after dealing: the host resets the seat; the role stays; the player sets a new PIN", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    const role = state().roles.p6;
    expect((await call(seatsRoute.POST, { token: "host-a", body: { op: "reset", playerId: "p6", key: key() } })).status).toBe(200);
    globalThis.__fakeDb.addUser("phone-6-new", "u-phone-6-new", true);
    expect((await call(seatRoute.POST, { token: "phone-6-new", body: { playerId: "p6", pin: "8888" } })).status).toBe(200);
    expect((await act("host-a", "host", { type: "confirmSeat", playerId: "p6" })).status).toBe(200);
    expect(state().roles.p6).toBe(role);
    const v = await call(viewRoute.GET, { token: "phone-6-new", query: "?as=player" });
    expect(v.body.view!.me!.role).toBe(role);
  });

  it("the host recovers on another device: same account, same game", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    globalThis.__fakeDb.addUser("host-a-phone", "u-host-a", false);
    expectExactView(await call(viewRoute.GET, { token: "host-a-phone", query: "?as=host" }), { kind: "host" });
    expect((await act("host-a-phone", "host", { type: "openCircle" })).status).toBe(200);
  });
});

describe("concurrency through the routes", () => {
  it("twelve votes at once all land; the round locks once", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    await act("host-a", "host", { type: "updateSettings", patch: { suspectPoll: true } });
    await act("host-a", "host", { type: "openCircle" });
    await act("host-a", "host", { type: "openVoting" });
    const results = await Promise.all(PHONES.map((t, i) => act(t, "player", { type: "castVote", targetId: i === 0 ? "p2" : "p1" })));
    expect(results.filter((r) => r.status !== 200).map((r) => `${r.status} ${r.body.error}`)).toEqual([]);
    const round = state().rounds.find((r) => r.kind === "circle")!;
    expect(round.ballots).toHaveLength(12);
    expect(state().phase).toBe("CIRCLE_REVEAL");
  });

  it("the same request twice at once is applied once", async () => {
    const body = { as: "host", key: "same-key-123456", action: { type: "addPlayer", name: "Twin" } };
    const [a, b] = await Promise.all([
      call(actionRoute.POST, { token: "host-a", body }),
      call(actionRoute.POST, { token: "host-a", body }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(state().players.filter((p) => p.name === "Twin")).toHaveLength(1);
  });

  it("two host taps on the same screen at once: one lands, the other is refused as stale", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    await act("host-a", "host", { type: "openCircle" });
    await act("host-a", "host", { type: "openVoting" });
    await act("phone-1", "player", { type: "castVote", targetId: "p2" });
    await act("phone-2", "player", { type: "castVote", targetId: "p1" });
    await act("host-a", "host", { type: "lockVoting" });
    const v = state().version;
    const [a, b] = await Promise.all([
      act("host-a", "host", { type: "revealNextBallot" }, { expectedVersion: v }),
      act("host-a", "host", { type: "revealNextBallot" }, { expectedVersion: v }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    // A resend of one tap (same key) while the first is in flight lands once and isn't refused.
    const v2 = state().version;
    const body = { as: "host", key: "resent-tap-123", expectedVersion: v2, action: { type: "revealNextBallot" } };
    const both = await Promise.all([call(actionRoute.POST, { token: "host-a", body }), call(actionRoute.POST, { token: "host-a", body })]);
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(state().version).toBe(v2 + 1);
  });

  it("a storm of timer nudges from every screen applies one tick", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    await act("host-a", "host", { type: "openCircle" });
    const g = globalThis.__fakeDb.tables.games[0];
    (g.state as GameState).deadline = Date.now() - 1000;
    const v = state().version;
    const results = await Promise.all(
      Array.from({ length: 14 }, () => call(actionRoute.POST, { body: { as: "system", key: `tick-version-${v}`, action: { type: "tick" } } })),
    );
    expect(results.map((r) => `${r.status} ${r.body.error ?? ""}`).filter((x) => !x.startsWith("200"))).toEqual([]);
    expect(state().phase).toBe("CIRCLE_VOTE");
    expect(state().version).toBe(v + 1);
  });
});
