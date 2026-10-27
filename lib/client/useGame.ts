"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionResponse, SeatInfo, ViewResponse } from "@/lib/game/api-types";
import type { ClientAction } from "@/lib/game/actions";
import type { GameView } from "@/lib/game/view";
import { api, ApiError, newKey, withRetries } from "./api";
import { browserClient } from "./supabase";

export type Connection = "live" | "connecting" | "offline";
export type GameKind = "host" | "player" | "screen";

export interface GameHandle {
  view: GameView | null;
  seats: SeatInfo[];
  seated: boolean;
  error: string | null;
  notFound: boolean;
  connection: Connection;
  /** Server time now, in ms (for countdowns). */
  now: () => number;
  photoFor: (path: string | null) => string | null;
  /** Server time when this screen first saw an event (for timing reveals that arrive late). */
  seenAt: (eventId: string) => number | null;
  refresh: () => Promise<void>;
  /** Sends an action. strict = refuse if the game moved on since this screen loaded (host buttons). */
  act: (action: ClientAction, o?: { strict?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  accept: (r: Partial<ViewResponse>) => void;
}

const TICK_GRACE: Record<GameKind, number> = { host: 400, screen: 900, player: 2500 };

export function useGame(code: string, kind: GameKind): GameHandle {
  const [data, setData] = useState<(ViewResponse & { seenAt: Record<string, number> }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [connection, setConnection] = useState<Connection>("connecting");
  const offset = useRef(0);
  const photos = useRef<Record<string, string>>({});
  const versionRef = useRef(-1);
  const seen = useRef<Record<string, number>>({});
  const inflight = useRef<Promise<void> | null>(null);

  const accept = useCallback((r: Partial<ViewResponse>) => {
    if (!r.view) return;
    if (typeof r.serverNow === "number") offset.current = r.serverNow - Date.now();
    if (r.photoUrls) photos.current = { ...photos.current, ...r.photoUrls };
    if (r.view.version < versionRef.current) return;
    const firstLoad = versionRef.current < 0;
    versionRef.current = r.view.version;
    const serverNow = r.serverNow ?? Date.now() + offset.current;
    // On first load everything is old news (no replays); later events are timed from when they arrive.
    for (const e of r.view.events) {
      if (!(e.id in seen.current)) seen.current[e.id] = firstLoad ? e.at : Math.max(e.at, serverNow - 1_000);
    }
    const seenAt = { ...seen.current };
    setData((prev) => ({
      seenAt,
      view: r.view!,
      serverNow: r.serverNow ?? prev?.serverNow ?? Date.now(),
      photoUrls: photos.current,
      seated: r.seated ?? prev?.seated,
      seats: r.seats ?? prev?.seats,
    }));
  }, []);

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        const r = await api<ViewResponse>(`/api/games/${code}/view?as=${kind}`, { kind });
        accept(r);
        setError(null);
        setConnection((c) => (c === "offline" ? "connecting" : c));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else if (err instanceof ApiError && err.status === 0) setConnection("offline");
        else setError(err instanceof Error ? err.message : "Couldn't load the game.");
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [accept, code, kind]);

  // First load, realtime pings, and a polling fallback.
  useEffect(() => {
    void refresh();
    const supabase = browserClient(kind === "host" ? "host" : "player");
    const channel = supabase
      .channel(`pings:${code}:${kind}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_pings", filter: `code=eq.${code}` }, (msg) => {
        const v = (msg.new as { version?: number } | null)?.version;
        if (typeof v !== "number" || v > versionRef.current) void refresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection(navigator.onLine ? "connecting" : "offline");
        }
      });
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    const onOnline = () => {
      setConnection("connecting");
      void refresh();
    };
    const onOffline = () => setConnection("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [code, kind, refresh]);

  useEffect(() => {
    const every = connection === "live" ? 15_000 : 3_000;
    const t = setInterval(() => void refresh(), every);
    return () => clearInterval(t);
  }, [connection, refresh]);

  // When the server deadline passes, nudge the timer. Many screens may do this; the server keeps one.
  const deadline = data?.view.deadline ?? null;
  const version = data?.view.version ?? -1;
  useEffect(() => {
    if (deadline === null) return;
    const wait = Math.max(0, deadline - (Date.now() + offset.current)) + TICK_GRACE[kind];
    // If the nudge fails (a Wi-Fi blip on every phone at once), keep nudging, slower each time, until
    // the game moves on; otherwise the phase would sit past its timer until the host tapped something.
    let again = 5_000;
    let t: ReturnType<typeof setTimeout>;
    const nudge = () => {
      api<ActionResponse>(`/api/games/${code}/action`, {
        kind,
        body: { as: kind === "screen" ? "system" : kind, key: `tick-version-${version}`, action: { type: "tick" } },
      })
        .then(accept)
        .catch(() => {
          void refresh();
          t = setTimeout(nudge, again);
          again = Math.min(again * 2, 30_000);
        });
    };
    t = setTimeout(nudge, wait);
    return () => clearTimeout(t);
  }, [accept, code, deadline, kind, refresh, version]);

  const act = useCallback<GameHandle["act"]>(
    async (action, o = {}) => {
      // One key for every try: a resent move that already landed comes back as a duplicate.
      const body = { as: kind, key: newKey(), expectedVersion: o.strict ? versionRef.current : undefined, action };
      try {
        const r = await withRetries(() => api<ActionResponse>(`/api/games/${code}/action`, { kind, body }));
        accept(r);
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiError) {
          accept(err.body as Partial<ViewResponse>);
          if (err.status === 0) setConnection("offline");
          return { ok: false, error: err.message };
        }
        return { ok: false, error: "Something went wrong." };
      }
    },
    [accept, code, kind],
  );

  const now = useCallback(() => Date.now() + offset.current, []);
  const photoFor = useCallback((path: string | null) => (path ? photos.current[path] ?? null : null), []);
  const seenMap = data?.seenAt;
  const seenAt = useCallback((id: string) => seenMap?.[id] ?? null, [seenMap]);

  return useMemo(
    () => ({
      view: data?.view ?? null,
      seats: data?.seats ?? [],
      seated: !!data?.seated,
      error,
      notFound,
      connection,
      now,
      photoFor,
      seenAt,
      refresh,
      act,
      accept,
    }),
    [act, accept, connection, data, error, notFound, now, photoFor, refresh, seenAt],
  );
}
