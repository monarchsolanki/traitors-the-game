"use client";

import { useEffect, useMemo, useState } from "react";
import { PHASE_TITLE } from "@/lib/client/labels";
import { useGame, type GameHandle } from "@/lib/client/useGame";
import type { EventView, GameView, PlayerView, RoundView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";
import { Countdown } from "@/components/ui/Countdown";
import { Diya } from "@/components/ui/Diya";
import { Toran } from "@/components/ui/Toran";
import { PhotoWall } from "./PhotoWall";
import { QrCode } from "./QrCode";

/** How long a result stays on the big screen after it happens, even though the game has moved on. */
const HOLD_MS = 20_000;
const SPIN_MS = 4_500;

function useTicker(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** Keeps a TV or laptop awake while the big screen is open. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        lock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        lock = null;
      }
    };
    void request();
    const again = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

const byId = (view: GameView, id: unknown) => view.players.find((p) => p.id === id);

function Big({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-display leading-none font-semibold text-gold text-[min(8vw,9rem)] ${className}`}>{children}</h2>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[70vw] text-center text-[min(2.4vw,2.4rem)] text-ink-muted">{children}</p>;
}

function Lobby({ game }: { game: GameHandle }) {
  const view = game.view!;
  const url = typeof window !== "undefined" ? `${window.location.origin}/play/${view.code}` : "";
  const joined = view.players.filter((p) => p.seatClaimed).length;
  return (
    <div className="grid w-full flex-1 grid-cols-1 items-center gap-[4vw] lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-[2vh]">
        <p className="text-[min(2.4vw,2.4rem)] text-ink">Scan to join</p>
        <QrCode value={url} className="size-[min(32vh,26vw)]" />
        <p className="text-[min(1.6vw,1.6rem)] text-ink-muted">or open {url.replace(/^https?:\/\//, "").replace(/\/play\/.*/, "")} and enter</p>
        <p className="font-mono text-[min(7vw,7rem)] leading-none tracking-[0.2em] text-gold">{view.code}</p>
      </div>
      <div className="flex flex-col items-center gap-[3vh]">
        <p className="text-[min(2.4vw,2.4rem)] text-ink">
          {joined} of {view.players.length} joined
        </p>
        <PhotoWall game={game} players={view.players} lobby />
      </div>
    </div>
  );
}

function Tally({ game, round }: { game: GameHandle; round: RoundView }) {
  const view = game.view!;
  const endgame = round.kind === "endgame";
  const totals = new Map<string, number>();
  for (const b of round.ballots) {
    const key = endgame ? (b.choice ?? "") : (b.targetId ?? "");
    totals.set(key, (totals.get(key) ?? 0) + b.weight);
  }
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <ul className="flex w-full flex-col gap-[1.6vh]">
      {rows.map(([id, n]) => {
        const p = byId(view, id);
        const label = endgame ? (id === "end" ? "End" : "Banish") : p?.displayName;
        return (
          <li key={id} className="flex items-center gap-[1vw]">
            {p ? <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size="min(5vw,4.5rem)" /> : null}
            <span className="w-[14vw] truncate text-[min(2.2vw,2.2rem)]">{label}</span>
            <span className="h-[3.2vh] flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className={`block h-full rounded-full transition-all duration-700 ${id === "banish" ? "bg-kumkum" : "bg-gold"}`}
                style={{ width: `${(n / max) * 100}%` }}
              />
            </span>
            <span className="w-[4vw] text-right font-mono text-[min(2.6vw,2.6rem)] text-gold">{n}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Reveal({ game, round }: { game: GameHandle; round: RoundView }) {
  const view = game.view!;
  const latest = round.ballots[round.ballots.length - 1];
  const voter = latest ? byId(view, latest.voterId) : undefined;
  const target = latest?.targetId ? byId(view, latest.targetId) : undefined;
  const endgame = round.kind === "endgame";
  return (
    <div className="grid w-full flex-1 grid-cols-1 gap-[4vw] lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-[3vh]">
        <p className="text-[min(2.2vw,2.2rem)] text-ink-muted">
          Vote {round.ballots.length} of {round.ballotCount ?? round.ballots.length}
        </p>
        {latest && voter ? (
          <div key={latest.voterId} className="flex animate-[fadeIn_.6s_ease-out] items-center gap-[2vw]">
            <div className="flex flex-col items-center gap-2">
              <Avatar name={voter.displayName} url={game.photoFor(voter.photoPath)} size="min(14vw,13rem)" ghost={latest.ghost} />
              <span className="text-[min(2.6vw,2.6rem)]">{voter.displayName}</span>
              {latest.ghost ? <span className="text-[min(1.6vw,1.6rem)] text-ghost">ghost vote</span> : null}
            </div>
            <span className="font-display text-[min(7vw,7rem)] text-gold">→</span>
            <div className="flex flex-col items-center gap-2">
              {endgame ? (
                <span className={`font-display text-[min(8vw,8rem)] ${latest.choice === "end" ? "text-gold" : "text-kumkum"}`}>
                  {latest.choice === "end" ? "End" : "Banish"}
                </span>
              ) : target ? (
                <>
                  <div className="relative">
                    <Avatar name={target.displayName} url={game.photoFor(target.photoPath)} size="min(14vw,13rem)" />
                    {latest.usedDagger ? (
                      <span className="absolute -top-[1vh] -right-[1vw] rounded-full bg-kumkum px-[1vw] py-[0.4vh] font-display text-[min(3.4vw,3.4rem)] font-semibold">
                        ×{latest.weight}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[min(2.6vw,2.6rem)]">{target.displayName}</span>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <Big className="text-[min(6vw,6rem)]">The votes are in</Big>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <Tally game={game} round={round} />
      </div>
    </div>
  );
}

function Spin({ game, event, start }: { game: GameHandle; event: EventView; start: number }) {
  const view = game.view!;
  useTicker(90);
  const tied = (event.data.tiedIds as string[]).map((id) => byId(view, id)).filter((p): p is PlayerView => !!p);
  const elapsed = game.now() - start;
  const done = elapsed >= SPIN_MS;
  const steps = Math.floor(Math.pow(Math.min(elapsed, SPIN_MS) / SPIN_MS, 0.5) * 24);
  const lit = done ? tied.findIndex((p) => p.id === event.data.playerId) : steps % Math.max(1, tied.length);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[5vh]">
      <Big>The spin</Big>
      <div className="flex flex-wrap justify-center gap-[3vw]">
        {tied.map((p, i) => (
          <div key={p.id} className={`flex flex-col items-center gap-2 transition ${i === lit ? "scale-110" : "opacity-40"}`}>
            <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={tied.length > 4 ? "min(9vw,22vh)" : "min(16vw,30vh)"} ring={i === lit} />
            <span className="text-[min(2.6vw,2.6rem)]">{p.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ game, event }: { game: GameHandle; event: EventView }) {
  const view = game.view!;
  const d = event.data;
  if (event.type === "endgameResult") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <Big>{d.end ? "Everyone voted End" : "Not unanimous"}</Big>
        <Sub>{d.end ? "The host will reveal who won." : "One more banishment."}</Sub>
      </div>
    );
  }
  const p = byId(view, event.type === "murderRevealed" ? d.victimId : d.playerId);
  if (event.type === "murderRevealed" && !p) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <Big>Nobody died last night</Big>
      </div>
    );
  }
  if (!p) return null;
  const role = d.role as string | null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
      <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size="min(26vh,22vw)" ghost />
      <Big>
        {p.displayName} {event.type === "murderRevealed" ? "was murdered" : event.type === "playerEliminated" ? "is out" : "is banished"}
      </Big>
      {role ? <Sub>{role === "traitor" ? "They were a Traitor." : "They were Innocent."}</Sub> : null}
    </div>
  );
}

function Finale({ game }: { game: GameHandle }) {
  const view = game.view!;
  const f = view.finale!;
  const suspects = Object.entries(f.suspicion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <div className="flex w-full flex-1 flex-col items-center gap-[4vh]">
      <div className="text-center">
        <p className="text-[min(2vw,2rem)] tracking-[0.3em] text-ink-muted uppercase">The final reveal</p>
        <Big className={f.winner === "traitors" ? "!text-kumkum" : ""}>{f.winner === "traitors" ? "The Traitors win" : "The Innocents win"}</Big>
      </div>
      <PhotoWall game={game} players={view.players} />
      {suspects.length ? (
        <p className="text-[min(2vw,2rem)] text-ink-muted">
          Most suspected at night: {suspects.map(([id, n]) => `${byId(view, id)?.displayName} (${n})`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function Stage({ game }: { game: GameHandle }) {
  const view = game.view!;
  useTicker(250);
  const now = game.now();
  // Time each result from when this screen first saw it, so a late update still plays in full.
  // Anything older than a minute (a screen opened late) doesn't replay.
  const startOf = (e: EventView) => game.seenAt(e.id) ?? e.at;
  const recent = useMemo(() => [...view.events].reverse().filter((e) => now - e.at < 60_000), [view.events, now]);
  const spin = recent.find((e) => e.type === "spin" && now - startOf(e) < SPIN_MS);
  const held = recent.find(
    (e) => ["banished", "murderRevealed", "endgameResult", "playerEliminated"].includes(e.type) && now - startOf(e) < HOLD_MS + (spin ? SPIN_MS : 0),
  );
  if (view.finalePending && (!held || now - startOf(held) > HOLD_MS)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <Diya className="size-[min(22vh,18vw)]" />
        <Big>Hold on</Big>
        <Sub>The host will tell you what happens next.</Sub>
      </div>
    );
  }
  if (view.phase === "FINALE" && view.finale && (!held || now - startOf(held) > 8_000)) return <Finale game={game} />;
  if (spin) return <Spin game={game} event={spin} start={startOf(spin)} />;
  if (held && view.phase !== "CIRCLE_VOTE" && view.phase !== "ENDGAME_BANISH") return <ResultCard game={game} event={held} />;

  const alive = view.players;
  const round = view.round;
  switch (view.phase) {
    case "LOBBY":
      return <Lobby game={game} />;
    case "ROLES":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[4vh]">
          <Big>Roles are dealt</Big>
          <Sub>Check your phone. Hold to peek, and keep it to yourself.</Sub>
          <PhotoWall game={game} players={alive} size="sm" />
        </div>
      );
    case "MISSION": {
      const m = view.missions.find((x) => x.id === view.currentMissionId);
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
          <p className="text-[min(2.2vw,2.2rem)] tracking-[0.3em] text-marigold uppercase">{m?.kind === "team" ? "Team mission" : "Mission"}</p>
          <Big>{m?.name ?? "Mission"}</Big>
          {m?.winRule ? <Sub>To win: {m.winRule}</Sub> : null}
          {m?.tieRule ? <Sub>If it&apos;s a tie: {m.tieRule}</Sub> : null}
        </div>
      );
    }
    case "CIRCLE_DEBATE":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh]">
          <Big>Circle of Shaq</Big>
          <Sub>Who is lying? Talk it out.</Sub>
          <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} className="text-[min(10vw,10rem)]" />
          <PhotoWall game={game} players={alive} size="sm" />
        </div>
      );
    case "CIRCLE_VOTE":
    case "ENDGAME_BANISH":
    case "ENDGAME_VOTE":
    case "CIRCLE_REVEAL": {
      if (round && round.status !== "open") {
        if (round.status === "tied" && round.result?.outcome === "tie") {
          const tied = round.result.tiedIds.map((id) => byId(view, id)?.displayName).join(" and ");
          return (
            <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
              <Big>It&apos;s a tie</Big>
              <Sub>
                Between {tied}. {round.result.method === "revote" ? "A revote is next." : round.result.method === "spin" ? "The spin decides." : round.result.method === "choose" ? "The host chooses: a spin or another revote." : "The host decides."}
              </Sub>
              <Tally game={game} round={round} />
            </div>
          );
        }
        return <Reveal game={game} round={round} />;
      }
      const endgame = view.phase === "ENDGAME_VOTE";
      const revote = round?.kind === "revote" || round?.kind === "endgameRevote";
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
          <Big>{endgame ? "End Game" : revote ? "Revote" : "Vote now"}</Big>
          <Sub>
            {endgame
              ? "Vote End or Banish on your phones. Everyone must vote End to finish."
              : revote
                ? "Only the tied players are on the ballot."
                : "Vote on your phones. Votes stay hidden until the reveal."}
          </Sub>
          {round ? (
            <p className="font-mono text-[min(5vw,5rem)] text-gold">
              {round.submittedCount} / {round.eligibleCount}
            </p>
          ) : null}
          <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} className="text-[min(6vw,6rem)]" />
        </div>
      );
    }
    case "NIGHT":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[4vh]">
          <Diya className="size-[min(22vh,18vw)] opacity-80" />
          <Big>Night falls</Big>
          <Sub>Traitors, make your choice. Everyone else, answer on your phones.</Sub>
          <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} className="text-[min(5vw,5rem)]" />
        </div>
      );
    case "MURDER_REVEAL":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[4vh]">
          <Big>Breakfast</Big>
          <Sub>{view.night?.revealed ? "Mission or Circle next." : "Everyone to the table. What happened in the night?"}</Sub>
          <PhotoWall game={game} players={alive} size="sm" />
        </div>
      );
    default:
      return null;
  }
}

export function ScreenApp({ code }: { code: string }) {
  const game = useGame(code.toUpperCase(), "screen");
  useWakeLock();
  const view = game.view;
  if (game.notFound) {
    return <main className="flex min-h-dvh items-center justify-center font-display text-[4vw] text-gold">No game called {code.toUpperCase()}</main>;
  }
  if (!view) return <main className="flex min-h-dvh items-center justify-center text-[2vw] text-ink-muted">Opening the big screen…</main>;
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-[4vw] pt-[6vh] pb-[3vh]">
      <Toran className="absolute inset-x-0 top-0" />
      <header className="flex items-center justify-between text-[min(1.8vw,1.8rem)] text-ink-muted">
        <span>
          <span className="font-display text-gold">Traitors</span> · Room <span className="font-mono text-ink">{view.code}</span>
          {view.startingPlayerCount && view.phase !== "FINALE" ? ` · Day ${view.day}` : ""}
        </span>
        <span className="flex items-center gap-3">
          {view.finalePending ? "Hold on" : PHASE_TITLE[view.phase]}
          <span className={`inline-block size-3 rounded-full ${game.connection === "live" ? "bg-leaf" : game.connection === "offline" ? "bg-kumkum" : "bg-marigold"}`} />
          <button
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
            className="rounded-lg px-3 py-1 text-[min(1.4vw,1.2rem)] ring-1 ring-gold/30"
          >
            Full screen
          </button>
        </span>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center py-[3vh]">
        <Stage game={game} />
      </main>
      {view.paused ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-night/85">
          <Big>Paused</Big>
          <Sub>The game will be back shortly.</Sub>
        </div>
      ) : null}
    </div>
  );
}
