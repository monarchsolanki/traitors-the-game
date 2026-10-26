import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let admin: SupabaseClient | null = null;

/** Server-only client with the secret key. Bypasses Row Level Security; never send its results raw. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return admin;
}

export const PHOTO_BUCKET = "player-photos";
