import { z } from "zod";
import { createHostAccount } from "@/lib/server/auth";
import { handle, HttpError, json, readJson } from "@/lib/server/http";

const body = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  password: z.string().min(8).max(72),
});

/** Makes a host account: { name, email, password }. Open to anyone (owner, 6 November). */
export async function POST(req: Request) {
  return handle(async () => {
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      throw new HttpError(400, field === "password" ? "Use a password of at least 8 characters." : field === "email" ? "Check the email address." : "Add your name.");
    }
    await createHostAccount(parsed.data);
    return json({ ok: true }, 201);
  });
}
