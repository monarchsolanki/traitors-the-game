import "server-only";
import { unstable_rethrow } from "next/navigation";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Wraps a route body: HttpErrors become JSON errors; anything else is a 500 without details. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    // Next.js signals (such as prerendering bailing out at a request-time read) must pass through.
    unstable_rethrow(err);
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Something went wrong on the server. Try again." }, 500);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "The request wasn't valid JSON.");
  }
}
