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
