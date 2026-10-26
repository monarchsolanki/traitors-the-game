import { connection } from "next/server";
import { json } from "@/lib/server/http";
import { adminClient } from "@/lib/server/supabase";

/** Setup check: which keys are present and well-formed, and whether the database answers. Never shows values. */
export async function GET() {
  await connection();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  const checks = {
    supabaseUrl: !url ? "missing" : /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url) ? "ok" : "wrong format (should be https://<id>.supabase.co with nothing after it)",
    publishableKey: !publishable ? "missing" : publishable.startsWith("sb_publishable_") ? "ok" : "wrong format (should start with sb_publishable_)",
    secretKey: !secret ? "missing" : secret.startsWith("sb_secret_") ? "ok" : "wrong format (should start with sb_secret_)",
    database: "not checked",
    region: process.env.VERCEL_REGION ?? "local",
  };
  if (checks.supabaseUrl === "ok" && checks.secretKey === "ok") {
    try {
      const { error } = await adminClient().from("games").select("id").limit(1);
      checks.database = error ? `error ${error.code ?? ""}: ${error.message}` : "ok";
    } catch (err) {
      checks.database = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }
  const ok = Object.entries(checks).every(([k, v]) => k === "region" || v === "ok");
  return json({ ok, ...checks }, ok ? 200 : 503);
}
