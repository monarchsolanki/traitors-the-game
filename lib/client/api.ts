"use client";

import { browserClient, type ClientKind } from "./supabase";

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Players get an anonymous session the first time they need one. */
export async function accessToken(kind: ClientKind | "screen"): Promise<string | null> {
  if (kind === "screen") return null;
  const auth = browserClient(kind).auth;
  const { data } = await auth.getSession();
  if (data.session) return data.session.access_token;
  if (kind === "host") return null;
  const { data: signed, error } = await auth.signInAnonymously();
  if (error) throw new ApiError(0, "Couldn't connect. Check your internet and try again.", {});
  return signed.session?.access_token ?? null;
}

/**
 * After the server says the sign-in has expired (a phone asleep for hours): refresh it. A player
 * whose session can't be refreshed starts a new one; their screen then asks for the seat PIN again.
 */
async function renewedToken(kind: ClientKind): Promise<string | null> {
  const auth = browserClient(kind).auth;
  const { data } = await auth.refreshSession();
  if (data.session) return data.session.access_token;
  if (kind === "host") return null;
  await auth.signOut({ scope: "local" });
  return accessToken(kind);
}

export async function api<T = Record<string, unknown>>(
  path: string,
  o: { kind: ClientKind | "screen"; method?: string; body?: unknown; form?: FormData } = { kind: "screen" },
): Promise<T> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await fetch(path, {
        method: o.method ?? (o.body !== undefined || o.form ? "POST" : "GET"),
        headers,
        body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
        cache: "no-store",
        // A request stuck on a bad signal gives up, so it can be resent rather than hang the button.
        signal: AbortSignal.timeout(o.form ? 60_000 : 20_000),
      });
    } catch {
      throw new ApiError(0, "No connection. Check your internet.", {});
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, body };
  };
  let { res, body } = await send(await accessToken(o.kind));
  if (res.status === 401 && body.code === "session" && o.kind !== "screen") {
    const token = await renewedToken(o.kind);
    if (token) ({ res, body } = await send(token));
  }
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? "Something went wrong."), body);
  return body as T;
}

/** A request that never got an answer (no signal, or the server or game busy) can be resent safely. */
export function isRetryable(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status >= 500);
}

/**
 * Sends, and resends after a lost request. Callers must reuse the same idempotency key on every
 * try, so a move that did land the first time is recognised as a duplicate, never counted twice.
 */
export async function withRetries<T>(send: () => Promise<T>, delaysMs: number[] = [700, 1_500, 3_000]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      if (attempt >= delaysMs.length || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
}

export function newKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID needs HTTPS and a newer browser: a test over local Wi-Fi or an older phone falls back to the same shape.
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
