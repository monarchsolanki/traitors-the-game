import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dropped phones (Step 4): a lost request is resent with the same key, a refused one isn't, and an
 * expired sign-in is renewed once. Supabase's browser client and fetch are stand-ins here.
 */
const auth = {
  session: { access_token: "old-token" } as { access_token: string } | null,
  refreshed: null as { access_token: string } | null,
  calls: [] as string[],
  getSession: async () => ({ data: { session: auth.session } }),
  refreshSession: async () => {
    auth.calls.push("refresh");
    if (auth.refreshed) auth.session = auth.refreshed;
    return { data: { session: auth.refreshed } };
  },
  signOut: async () => {
    auth.calls.push("signOut");
    auth.session = null;
    return { error: null };
  },
  signInAnonymously: async () => {
    auth.calls.push("signIn");
    auth.session = { access_token: "fresh-anon-token" };
    return { data: { session: auth.session }, error: null };
  },
};
vi.mock("@/lib/client/supabase", () => ({ browserClient: () => ({ auth }) }));

import { api, ApiError, isRetryable, withRetries } from "@/lib/client/api";

type Reply = { status: number; body: Record<string, unknown> } | "drop";
let replies: Reply[] = [];
let sent: { token: string | null; body: string | null }[] = [];

beforeEach(() => {
  auth.session = { access_token: "old-token" };
  auth.refreshed = null;
  auth.calls = [];
  replies = [];
  sent = [];
  vi.stubGlobal("fetch", async (_path: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    sent.push({ token: headers.Authorization?.slice(7) ?? null, body: (init.body as string) ?? null });
    const r = replies.shift() ?? { status: 200, body: { ok: true } };
    if (r === "drop") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
});

const vote = { as: "player", key: "key-123456", action: { type: "castVote", targetId: "p2" } };
const send = () => api("/api/games/ABCDE/action", { kind: "player", body: vote });

describe("resending lost moves", () => {
  it("resends after dropped requests with the same key, and stops at the first answer", async () => {
    replies = ["drop", "drop", { status: 200, body: { ok: true } }];
    await expect(withRetries(send, [1, 1, 1])).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((s) => s.body)).size).toBe(1);
    expect(JSON.parse(sent[0].body!).key).toBe("key-123456");
  });

  it("resends when the server or game is busy", async () => {
    replies = [{ status: 503, body: { error: "The game is busy right now. Try again." } }, { status: 200, body: { ok: true } }];
    await expect(withRetries(send, [1, 1, 1])).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(2);
  });

  it("never resends a move the game refused or a stale host tap", async () => {
    for (const status of [400, 403, 404, 409, 422, 423]) {
      replies = [{ status, body: { error: "No" } }];
      sent = [];
      await expect(withRetries(send, [1, 1, 1])).rejects.toMatchObject({ status });
      expect(sent).toHaveLength(1);
    }
  });

  it("gives up after the last try with a clear no-connection message", async () => {
    replies = ["drop", "drop", "drop", "drop"];
    await expect(withRetries(send, [1, 1, 1])).rejects.toMatchObject({ status: 0, message: "No connection. Check your internet." });
    expect(sent).toHaveLength(4);
  });

  it("knows which failures are safe to resend", () => {
    expect(isRetryable(new ApiError(0, "x", {}))).toBe(true);
    expect(isRetryable(new ApiError(502, "x", {}))).toBe(true);
    expect(isRetryable(new ApiError(409, "x", {}))).toBe(false);
    expect(isRetryable(new Error("x"))).toBe(false);
  });
});

describe("renewing an expired sign-in", () => {
  it("refreshes the session once and resends with the new token", async () => {
    auth.refreshed = { access_token: "new-token" };
    replies = [{ status: 401, body: { error: "Your session has expired.", code: "session" } }, { status: 200, body: { ok: true } }];
    await expect(send()).resolves.toEqual({ ok: true });
    expect(sent.map((s) => s.token)).toEqual(["old-token", "new-token"]);
    expect(auth.calls).toEqual(["refresh"]);
  });

  it("a player whose session can't be refreshed starts a new one (the screen then asks for the seat PIN)", async () => {
    replies = [{ status: 401, body: { error: "Your session has expired.", code: "session" } }, { status: 200, body: { ok: true } }];
    await expect(send()).resolves.toEqual({ ok: true });
    expect(auth.calls).toEqual(["refresh", "signOut", "signIn"]);
    expect(sent.map((s) => s.token)).toEqual(["old-token", "fresh-anon-token"]);
  });

  it("the host isn't signed out; the error shows", async () => {
    replies = [{ status: 401, body: { error: "Your session has expired. Refresh the page.", code: "session" } }];
    await expect(api("/api/games/ABCDE/view?as=host", { kind: "host" })).rejects.toMatchObject({ status: 401 });
    expect(auth.calls).toEqual(["refresh"]);
  });

  it("a wrong PIN isn't retried and doesn't touch the session", async () => {
    replies = [{ status: 401, body: { error: "Wrong PIN. 4 tries left." } }];
    await expect(api("/api/games/ABCDE/seat", { kind: "player", body: { playerId: "p1", pin: "9999" } })).rejects.toMatchObject({ status: 401 });
    expect(sent).toHaveLength(1);
    expect(auth.calls).toEqual([]);
  });
});
