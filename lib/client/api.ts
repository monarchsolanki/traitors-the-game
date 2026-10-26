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

export async function api<T = Record<string, unknown>>(
  path: string,
  o: { kind: ClientKind | "screen"; method?: string; body?: unknown; form?: FormData } = { kind: "screen" },
): Promise<T> {
  const token = await accessToken(o.kind);
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
    });
  } catch {
    throw new ApiError(0, "No connection. Check your internet.", {});
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? "Something went wrong."), body);
  return body as T;
}

export function newKey(): string {
  return crypto.randomUUID();
}
