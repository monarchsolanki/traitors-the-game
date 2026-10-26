import type { GameView } from "./view";

/** Seat status the host sees (from the server-only seats table). */
export interface SeatInfo {
  playerId: string;
  bound: boolean;
  isBot: boolean;
  locked: boolean;
  failedAttempts: number;
  lastSeen: string | null;
}

export interface ViewResponse {
  view: GameView;
  serverNow: number;
  /** Signed photo links by storage path; short-lived, so clients refetch them with the view. */
  photoUrls: Record<string, string>;
  /** Player requests only: whether this phone holds a seat. */
  seated?: boolean;
  /** Host requests only. */
  seats?: SeatInfo[];
}

export interface ActionResponse extends Partial<ViewResponse> {
  ok?: boolean;
  duplicate?: boolean;
  error?: string;
  stale?: boolean;
}
