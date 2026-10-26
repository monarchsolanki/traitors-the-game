import { isListedHost, requestUser } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requestUser(req);
    if (!user) return json({ user: null, isHost: false });
    return json({ user: { id: user.id, anonymous: user.anonymous }, isHost: !user.anonymous && (await isListedHost(user.id)) });
  });
}
