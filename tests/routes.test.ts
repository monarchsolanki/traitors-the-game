import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "@/lib/game/engine";
import { findLeaks } from "@/lib/game/leaks";
import { DEFAULT_ROSTER } from "@/lib/game/settings";
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
import * as presetRoute from "@/app/api/games/[code]/preset/route";
import * as reactRoute from "@/app/api/games/[code]/react/route";
import * as presetsRoute from "@/app/api/presets/route";
import * as seatRoute from "@/app/api/games/[code]/seat/route";
import * as seatsRoute from "@/app/api/games/[code]/seats/route";
import * as undoRoute from "@/app/api/games/[code]/undo/route";
import * as viewRoute from "@/app/api/games/[code]/view/route";
import * as gamesRoute from "@/app/api/games/route";
import * as hostsRoute from "@/app/api/hosts/route";
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
/** Opens the Circle; with private talks on (the default since 30 October) that takes two taps. */
async function openCircle() {
  const r = await act("host-a", "host", { type: "openCircle" });
  if (state().phase === "PRIVATE_TALKS") return act("host-a", "host", { type: "openCircle" });
  return r;
}
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
  // New games start with no players (owner, 6 November); these tests seat the usual table of 12.
  expect((state() as GameState).players).toEqual([]);
  db.tables.games.find((g) => g.code === code)!.state = createGame({ code, seed: "route-tests", at: Date.now(), roster: DEFAULT_ROSTER });
});

describe("creating and listing games", () => {
  it("only listed hosts create or list games", async () => {
    for (const token of [undefined, "stranger", "account", "phone-1"]) {
      expect((await call(gamesRoute.POST as Handler, { token, body: {} })).status).toBe(token ? 403 : 401);
      expect((await call(gamesRoute.GET as Handler, { token })).status).toBe(token ? 403 : 401);
    }
    expect((await call(gamesRoute.GET as Handler, { token: "host-a" })).status).toBe(200);
  });

  it("only this game's host can delete it", async () => {
    for (const token of [undefined, "stranger", "account", "phone-1", "host-b"]) {
      const res = await call(gamesRoute.DELETE as Handler, { token, method: "DELETE", query: `?code=${code}` });
      expect(res.status).toBe(token ? 403 : 401);
    }
    expect(globalThis.__fakeDb.tables.games.some((g) => g.code === code)).toBe(true);
  });

  it("deleting a game removes it, its photos and its room code, and leaves other games and presets alone", async () => {
    const other = await call(gamesRoute.POST as Handler, { token: "host-a", body: {} });
    const form = new FormData();
    form.set("playerId", "p1");
    form.set("file", new Blob([new Uint8Array(10)], { type: "image/jpeg" }), "a.jpg");
    expect((await call(photoRoute.POST, { token: "host-a", form })).status).toBe(200);
    const preset = await call(presetsRoute.POST as Handler, { token: "host-a", body: { code, name: "Keep me" } });
    expect(preset.status).toBe(201);
    const db = globalThis.__fakeDb;
    const id = db.tables.games.find((g) => g.code === code)!.id as string;
    expect(db.storage["player-photos"].filter((p) => p.startsWith(`${id}/`))).toHaveLength(1);
    const presetCopies = db.storage["player-photos"].filter((p) => p.startsWith("presets/"));
    expect(presetCopies).toHaveLength(1);

    expect((await call(gamesRoute.DELETE as Handler, { token: "host-a", method: "DELETE", query: `?code=${code}` })).status).toBe(200);

    expect(db.tables.games.some((g) => g.code === code)).toBe(false);
    expect(db.storage["player-photos"].filter((p) => p.startsWith(`${id}/`))).toEqual([]);
    expect(db.storage["player-photos"].filter((p) => p.startsWith("presets/"))).toEqual(presetCopies);
    expect((await call(viewRoute.GET, { token: "host-a", query: "?as=host" })).status).toBe(404);
    expect((await call(gamesRoute.DELETE as Handler, { token: "host-a", method: "DELETE", query: `?code=${code}` })).status).toBe(404);
    const list = await call(gamesRoute.GET as Handler, { token: "host-a" });
    expect((list.body.games as Array<{ code: string }>).map((g) => g.code)).toEqual([other.body.code]);
  });

  it("deleting needs a room code", async () => {
    expect((await call(gamesRoute.DELETE as Handler, { token: "host-a", method: "DELETE" })).status).toBe(400);
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
    await openCircle();
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

describe("anyone can make a host account (owner, 6 November)", () => {
  const signUp = (body: unknown) => call(hostsRoute.POST as Handler, { body });

  it("creates a confirmed, listed host whose games start with no players", async () => {
    const res = await signUp({ name: "  Riya ", email: "Riya@Example.com", password: "long-enough" });
    expect(res.status).toBe(201);
    const db = globalThis.__fakeDb;
    const acct = db.accounts.get("riya@example.com")!;
    expect(acct.app_metadata).toEqual({ self_serve: true });
    expect(db.tables.hosts).toContainEqual(expect.objectContaining({ user_id: acct.id, display_name: "Riya" }));
    db.addUser("riya", acct.id, false, acct.app_metadata);
    expect((await call(meRoute.GET as Handler, { token: "riya" })).body.isHost).toBe(true);
    const made = await call(gamesRoute.POST as Handler, { token: "riya", body: {} });
    expect(made.status).toBe(201);
    const game = db.tables.games.find((g) => g.code === made.body.code)!;
    expect((game.state as GameState).players).toEqual([]);
    // The new host can't touch the owner's games.
    expect((await call(gamesRoute.DELETE as Handler, { token: "riya", method: "DELETE", query: `?code=${code}` })).status).toBe(403);
  });

  it("refuses a taken email, a short password, a bad email and a missing name", async () => {
    expect((await signUp({ name: "A", email: "a@b.co", password: "long-enough" })).status).toBe(201);
    const again = await signUp({ name: "B", email: "A@B.co", password: "long-enough" });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already has an account/);
    expect((await signUp({ name: "C", email: "c@d.co", password: "short" })).body.error).toMatch(/8 characters/);
    expect((await signUp({ name: "C", email: "not-an-email", password: "long-enough" })).body.error).toMatch(/email/);
    expect((await signUp({ name: " ", email: "c@d.co", password: "long-enough" })).body.error).toMatch(/name/);
    expect((await signUp(null)).status).toBe(400);
    expect(globalThis.__fakeDb.accounts.size).toBe(1);
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

  it("removing a player whose photo was already taken frees that phone, with no error", async () => {
    expect((await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p1", pin: "1234" } })).status).toBe(200);
    expect((await act("host-a", "host", { type: "removePlayer", playerId: "p1" })).status).toBe(200);
    const view = await call(viewRoute.GET, { token: "phone-1", query: "?as=player" });
    expect([view.status, view.body.seated]).toEqual([200, false]);
    expect((await act("phone-1", "player", { type: "acknowledgeRole" })).status).toBe(403);
    expect((await call(seatRoute.POST, { token: "phone-1", body: { playerId: "p2", pin: "1234" } })).status).toBe(200);
    expect(globalThis.__fakeDb.tables.seats.some((s) => s.player_id === "p1")).toBe(false);
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
    await openCircle();
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
    await openCircle();
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
    await openCircle();
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
    await openCircle();
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

describe("co-host access (Step 5)", () => {
  it("only the player the host picked gets the co-host view and controls, and only missions and the big screen", async () => {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    const asCohost = (token: string, action: unknown) => act(token, "cohost" as never, action);
    expect((await call(viewRoute.GET, { token: "phone-4", query: "?as=cohost" })).status).toBe(403);
    expect((await asCohost("phone-4", { type: "setScreenMessage", text: "Hi" })).status).toBe(403);
    expect((await act("phone-4", "player", { type: "setCohost", playerId: "p4" })).status).toBe(403);
    expect((await act("host-a", "host", { type: "setCohost", playerId: "p4" })).status).toBe(200);

    expectExactView(await call(viewRoute.GET, { token: "phone-4", query: "?as=cohost" }), { kind: "cohost" });
    expect((await asCohost("phone-4", { type: "startMission", name: "Ring Toss", kind: "individual" })).status).toBe(200);
    expect((await asCohost("phone-4", { type: "setScreenMessage", text: "Mission time" })).status).toBe(200);
    for (const action of [{ type: "openCircle" }, { type: "pause" }, { type: "dealRoles" }, { type: "endGameEarly", reason: "x" }]) {
      expect((await asCohost("phone-4", action)).status).toBe(403);
    }
    for (const token of ["phone-5", "stranger", "host-b"]) {
      expect((await call(viewRoute.GET, { token, query: "?as=cohost" })).status).toBe(403);
      expect((await asCohost(token, { type: "setScreenMessage", text: "Me too" })).status).toBe(403);
    }
    // Their own phone still gets their player view, with the co-host flag.
    const own = await call(viewRoute.GET, { token: "phone-4", query: "?as=player" });
    expect(own.body.view!.me!.isCohost).toBe(true);

    expect((await act("host-a", "host", { type: "setCohost", playerId: null })).status).toBe(200);
    expect((await call(viewRoute.GET, { token: "phone-4", query: "?as=cohost" })).status).toBe(403);
    expect((await asCohost("phone-4", { type: "setScreenMessage", text: "Still?" })).status).toBe(403);
  });
});

describe("live reactions (Step 5)", () => {
  async function debateWithGhost() {
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    await act("host-a", "host", { type: "eliminatePlayer", playerId: "p12", status: "banished", reason: "Test" });
    const ghostGames = { bhootBets: true, crystalBall: true, liveReactions: true, bhootBingo: true };
    await act("host-a", "host", { type: "updateSettings", patch: { ghostGames } });
    await openCircle();
  }
  const react = (token: string | undefined, emoji: string) => call(reactRoute.POST, { token, body: { emoji } });

  it("only a ghost, only during the debate, only the listed emoji; the stored row names nobody", async () => {
    await debateWithGhost();
    expect((await react(undefined, "💀")).status).toBe(401);
    expect((await react("stranger", "💀")).status).toBe(403);
    expect((await react("phone-5", "💀")).status).toBe(422);
    expect((await react("phone-12", "💩")).status).toBe(422);
    expect((await react("phone-12", "💀")).status).toBe(200);
    const rows = globalThis.__fakeDb.tables.game_reactions;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["code", "created_at", "emoji", "id"]);
    await act("host-a", "host", { type: "openVoting" });
    expect((await react("phone-12", "💀")).status).toBe(422);
  });

  it("a flood of reactions is capped quietly", async () => {
    await debateWithGhost();
    for (let i = 0; i < 30; i++) expect((await react("phone-12", "👻")).body.ok).toBe(true);
    const over = await react("phone-12", "👻");
    expect([over.status, over.body.busy]).toEqual([200, true]);
    expect(globalThis.__fakeDb.tables.game_reactions).toHaveLength(30);
  });

  it("switched off, nobody can react", async () => {
    await debateWithGhost();
    const ghostGames = { bhootBets: true, crystalBall: true, liveReactions: false, bhootBingo: true };
    expect((await act("host-a", "host", { type: "updateSettings", patch: { ghostGames } })).status).toBe(200);
    expect((await react("phone-12", "💀")).body.error).toMatch(/switched off/);
  });
});

describe("presets (Step 5)", () => {
  async function photo(playerId: string) {
    const form = new FormData();
    form.set("playerId", playerId);
    form.set("file", new Blob([new Uint8Array(100)], { type: "image/jpeg" }), "a");
    expect((await call(photoRoute.POST, { token: "host-a", form })).status).toBe(200);
  }

  it("saves a game's settings, roster with photos and missions; starts a new game from it; only for its owner", async () => {
    await photo("p1");
    await act("host-a", "host", { type: "updateSettings", patch: { debateSeconds: 300 } });
    const saved = await call(presetsRoute.POST as Handler, { token: "host-a", body: { code, name: "Diwali night" } });
    expect(saved.status).toBe(201);
    const presetId = saved.body.id as string;
    const storage = globalThis.__fakeDb.storage["player-photos"];
    expect(storage.some((p) => p.startsWith(`presets/${presetId}/`))).toBe(true);
    const list = await call(presetsRoute.GET as Handler, { token: "host-a" });
    expect(list.body.presets).toEqual([expect.objectContaining({ id: presetId, name: "Diwali night", players: 12, photos: 1 })]);

    // Other hosts see nothing and can't touch it.
    expect((await call(presetsRoute.GET as Handler, { token: "host-b" })).body.presets).toEqual([]);
    expect((await call(presetsRoute.POST as Handler, { token: "host-b", body: { code, name: "Mine" } })).status).toBe(403);
    expect((await call(presetsRoute.DELETE as Handler, { token: "host-b", method: "DELETE", query: `?id=${presetId}` })).status).toBe(404);
    expect((await call(gamesRoute.POST as Handler, { token: "host-b", body: { presetId } })).status).toBe(404);
    expect((await call(presetsRoute.GET as Handler, { token: "phone-1" })).status).toBe(403);

    // A new game from the preset: same roster, settings and the photo copied into the new game.
    const created = await call(gamesRoute.POST as Handler, { token: "host-a", body: { presetId } });
    expect(created.status).toBe(201);
    const fresh = globalThis.__fakeDb.tables.games.find((g) => g.code === created.body.code)!;
    const fs = fresh.state as GameState;
    expect(fs.players.map((p) => p.displayName)).toEqual(state().players.map((p) => p.displayName));
    expect(fs.settings.debateSeconds).toBe(300);
    expect(fs.players[0].photoPath!.startsWith(`${fresh.id}/`)).toBe(true);
    expect(storage).toContain(fs.players[0].photoPath);

    // Saving under the same name replaces it; deleting removes its photos.
    expect((await call(presetsRoute.POST as Handler, { token: "host-a", body: { code, name: "Diwali night" } })).status).toBe(201);
    expect(globalThis.__fakeDb.tables.presets).toHaveLength(1);
    expect((await call(presetsRoute.DELETE as Handler, { token: "host-a", method: "DELETE", query: `?id=${presetId}` })).status).toBe(200);
    expect(globalThis.__fakeDb.storage["player-photos"].some((p) => p.startsWith(`presets/${presetId}/`))).toBe(false);
  });

  it("applies a preset's settings and missions to a game in the lobby only", async () => {
    await act("host-a", "host", { type: "updateSettings", patch: { voteSeconds: 90 } });
    const presetId = (await call(presetsRoute.POST as Handler, { token: "host-a", body: { code, name: "Quick" } })).body.id as string;
    const other = await call(gamesRoute.POST as Handler, { token: "host-a", body: {} });
    const first = code;
    code = other.body.code as string;
    globalThis.__fakeDb.tables.games.find((g) => g.code === code)!.state = createGame({ code, seed: "route-tests-2", at: Date.now(), roster: DEFAULT_ROSTER });
    expect(state().settings.voteSeconds).toBe(120);
    expect((await call(presetRoute.POST, { token: "host-b", body: { presetId, key: "apply-key-1" } })).status).toBe(403);
    const applied = await call(presetRoute.POST, { token: "host-a", body: { presetId, key: "apply-key-1" } });
    expect(applied.status).toBe(200);
    expect(state().settings.voteSeconds).toBe(90);
    await seatEveryone();
    await act("host-a", "host", { type: "dealRoles" });
    expect((await call(presetRoute.POST, { token: "host-a", body: { presetId, key: "apply-key-2" } })).status).toBe(422);
    code = first;
  });
});
