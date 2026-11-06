import "server-only";
import { HttpError } from "./http";
import { adminClient } from "./supabase";

export interface RequestUser {
  id: string;
  anonymous: boolean;
}

/** Verifies the Supabase access token sent as "Authorization: Bearer …". */
export async function requestUser(req: Request): Promise<RequestUser | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { data, error } = await adminClient().auth.getClaims(header.slice(7));
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  return { id: sub, anonymous: data!.claims.is_anonymous === true };
}

export async function requireUser(req: Request): Promise<RequestUser> {
  const user = await requestUser(req);
  if (!user) throw new HttpError(401, "Your session has expired. Refresh the page.", "session");
  return user;
}

export async function isListedHost(userId: string): Promise<boolean> {
  const { data, error } = await adminClient().from("hosts").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function requireListedHost(req: Request): Promise<RequestUser> {
  const user = await requireUser(req);
  if (user.anonymous || !(await isListedHost(user.id))) {
    throw new HttpError(403, "This account isn't set up as a host.");
  }
  return user;
}

/**
 * Owner, 6 November: anyone can make a host account on the host page. The server creates it already
 * confirmed (so no email is sent and no Supabase setting is needed) and lists it as a host.
 */
export async function createHostAccount(o: { name: string; email: string; password: string }): Promise<void> {
  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({
    email: o.email,
    password: o.password,
    email_confirm: true,
    app_metadata: { self_serve: true },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || /already (been )?registered/i.test(error?.message ?? "")) {
      throw new HttpError(409, "That email already has an account. Sign in instead.");
    }
    throw error ?? new Error("Couldn't create the account.");
  }
  const { error: listError } = await db.from("hosts").insert({ user_id: data.user.id, display_name: o.name });
  if (listError) {
    // Don't leave an account that can sign in but can't host.
    await db.auth.admin.deleteUser(data.user.id);
    throw listError;
  }
}
