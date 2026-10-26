"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ClientKind = "host" | "player";

const clients: Partial<Record<ClientKind, SupabaseClient>> = {};

/**
 * Separate sessions for the host and for players, so one browser can be the host in one tab and a
 * player in another. Sessions live in localStorage and refresh themselves.
 */
export function browserClient(kind: ClientKind): SupabaseClient {
  if (!clients[kind]) {
    clients[kind] = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, storageKey: `traitors-${kind}` } },
    );
  }
  return clients[kind]!;
}
