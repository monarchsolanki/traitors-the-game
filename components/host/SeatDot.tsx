import type { SeatInfo } from "@/lib/game/api-types";

/** Phones report in every 15 to 30 seconds while open; quieter than this means the phone is away. */
export const ONLINE_MS = 75_000;

export type Presence = "online" | "offline" | "bot" | "none";

export function presence(seat: SeatInfo | undefined, now: number): Presence {
  if (!seat) return "none";
  if (seat.isBot) return "bot";
  if (!seat.bound || !seat.lastSeen) return "offline";
  return now - Date.parse(seat.lastSeen) < ONLINE_MS ? "online" : "offline";
}

export function SeatDot({ state }: { state: Presence }) {
  if (state === "none") return null;
  const cls = state === "online" ? "bg-leaf" : state === "bot" ? "bg-ghost" : "bg-kumkum";
  const label = state === "online" ? "Phone connected" : state === "bot" ? "Bot" : "Phone not connected";
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${cls}`} title={label} aria-label={label} />;
}
