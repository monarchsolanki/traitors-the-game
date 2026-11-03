"use client";

import { useEffect, useMemo } from "react";
import { PHASE_TITLE } from "@/lib/client/labels";
import { useGame, type GameHandle } from "@/lib/client/useGame";
import { actOf, useHouseLights } from "@/lib/client/useHouseLights";
import { useTicker } from "@/lib/client/useTicker";
import type { EventView, GameView, PlayerView, RoundView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";
import { Countdown } from "@/components/ui/Countdown";
import { Icon } from "@/components/ui/Icon";
import { Keyhole } from "@/components/ui/Keyhole";
import { TowerSign } from "@/components/ui/TowerSign";
import { Entrance } from "./Entrance";
import { FitBox } from "./FitBox";
import { PhotoWall } from "./PhotoWall";
import { QrCode } from "./QrCode";
import { Reactions } from "./Reactions";
import { Rotunda } from "./Rotunda";
import { useScreenSounds } from "./useScreenSounds";

/** How long a result stays on the big screen after it happens, even though the game has moved on. */
const HOLD_MS = 20_000;
const SPIN_MS = 4_500;

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
  return <h2 className={`font-sign text-[min(7.4vw,8.5rem)] leading-[1.02] uppercase text-balance ${className}`}>{children}</h2>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[70vw] text-center text-[min(2.4vw,2.4rem)] text-ink-muted">{children}</p>;
}

function Lobby({ game }: { game: GameHandle }) {
  const view = game.view!;
  const url = typeof window !== "undefined" ? `${window.location.origin}/play/${view.code}` : "";
  const joined = view.players.filter((p) => p.seatClaimed).length;
  return (
    <div className="flex w-full items-stretch justify-center gap-[3vw] portrait:flex-col portrait:items-center">
      <TowerSign cell="min(9vh, 6.4vw)" className="shrink-0 portrait:hidden" />
      <div className="flex flex-col items-center justify-center gap-[1.6vh] text-center">
        <p className="max-w-[26vw] text-[min(2vw,2rem)] leading-tight text-ink portrait:max-w-[70vw]">{view.settings.narration.lobby || "Scan to join"}</p>
        <QrCode value={url} className="size-[min(34vh,24vw)]" />
        <p className="text-[min(1.5vw,1.5rem)] text-ink-muted">or open {url.replace(/^https?:\/\//, "").replace(/\/play\/.*/, "")} and enter</p>
        <p className="font-display text-[min(6.4vw,6.5rem)] leading-none tracking-[0.14em] text-accent">{view.code}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[2vh]">
        <p className="font-display text-[min(2.6vw,2.6rem)] text-ink">
          {joined} of {view.players.length} joined
        </p>
        <PhotoWall game={game} players={view.players} size="sm" lobby />
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
            <span className="step h-[3.2vh] flex-1 overflow-hidden bg-surface-2 [--s:2px]">
              <span
                className={`block h-full transition-all duration-700 ${id === "banish" ? "bg-danger" : "bg-accent"}`}
                style={{ width: `${(n / max) * 100}%` }}
              />
            </span>
            <span className="w-[4vw] text-right font-display text-[min(3vw,3rem)] leading-none text-accent">{n}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Reveal({ game, round }: { game: GameHandle; round: RoundView }) {
  return (
    <div className="flex w-full items-center justify-center gap-[4vw] portrait:flex-col">
      <Rotunda game={game} round={round} />
      <div className="min-w-0 flex-1 portrait:w-full">
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
            <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={tied.length > 4 ? "min(9vw,22vh)" : "min(16vw,30vh)"} tall ring={i === lit} />
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
  if (event.type === "noBanishment") {
    const tied = ((d.tiedIds as string[]) ?? []).map((id) => byId(view, id)?.displayName).filter(Boolean).join(" and ");
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <Big>Nobody is banished</Big>
        <Sub>The tie between {tied} stands. Night falls.</Sub>
      </div>
    );
  }
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
    <div className="flex w-full items-center justify-center gap-[4vw] portrait:flex-col portrait:text-center">
      <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size="min(52vh,30vw)" tall ghost />
      <div className="flex min-w-0 flex-col gap-[2vh]">
        <Big className="text-[min(9vw,10rem)]">
          {p.displayName} {event.type === "murderRevealed" ? "was murdered" : event.type === "playerEliminated" ? "is out" : "is banished"}
        </Big>
        {role ? <p className="font-display text-[min(3vw,3rem)] text-accent">{role === "traitor" ? "They were a Traitor." : "They were Innocent."}</p> : null}
      </div>
    </div>
  );
}

function Finale({ game }: { game: GameHandle }) {
  const view = game.view!;
  const f = view.finale!;
  const suspects = Object.entries(f.suspicion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const most = Math.max(1, ...suspects.map(([, n]) => n));
  const ghosts = f.ghostScores.filter((g) => g.total > 0).slice(0, 3);
  return (
    <div className="flex w-full flex-1 flex-col items-center gap-[3vh]">
      <div className="text-center">
        <Big>{f.winner === "traitors" ? "The Traitors win" : "The Innocents win"}</Big>
        <p className="mt-[1vh] text-[min(2vw,2rem)] text-ink-muted">{view.settings.narration.finale || "The final reveal"}</p>
      </div>
      <PhotoWall game={game} players={view.players} size="sm" flip />
      <div className="grid w-full max-w-[80vw] grid-cols-1 gap-[3vw] landscape:grid-cols-2">
        {suspects.length ? (
          <div className="flex flex-col gap-[1vh]">
            <p className="font-display text-[min(2.4vw,2.4rem)] text-accent">The suspicion meter</p>
            {suspects.map(([id, n]) => (
              <div key={id} className="flex items-center gap-[1vw]">
                <span className="w-[12vw] truncate text-[min(1.8vw,1.8rem)]">{byId(view, id)?.displayName}</span>
                <span className="step h-[2.4vh] flex-1 overflow-hidden bg-surface-2 [--s:2px]">
                  <span className={`block h-full ${byId(view, id)?.role === "traitor" ? "bg-danger" : "bg-accent"}`} style={{ width: `${(n / most) * 100}%` }} />
                </span>
                <span className="w-[3vw] text-right font-display text-[min(1.8vw,1.8rem)] text-accent">{n}</span>
              </div>
            ))}
          </div>
        ) : null}
        {ghosts.length ? (
          <div className="flex flex-col gap-[1vh]">
            <p className="font-display text-[min(2.4vw,2.4rem)] text-accent">Best Ghost</p>
            {ghosts.map((g, i) => {
              const p = byId(view, g.playerId);
              return (
                <div key={g.playerId} className="flex items-center gap-[1vw]">
                  <span className="w-[2vw] font-display text-[min(1.8vw,1.8rem)] text-ink-muted">{i + 1}</span>
                  {p ? <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size="min(4vw,4rem)" /> : null}
                  <span className="flex-1 truncate text-[min(1.8vw,1.8rem)]">{p?.displayName}</span>
                  <span className="font-display text-[min(2vw,2rem)] text-accent">{g.total}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A Bhoot Bingo winner, announced for a few seconds. */
function BingoToast({ game }: { game: GameHandle }) {
  const view = game.view!;
  const e = [...view.events].reverse().find((x) => x.type === "bingo");
  if (!e || game.now() - (game.seenAt(e.id) ?? e.at) > 8_000) return null;
  return (
    <div className="absolute inset-x-0 top-[9vh] z-20 flex justify-center">
      <p className="step flex animate-arrive items-center gap-[1vw] bg-surface-2 px-[3vw] py-[1.2vh] text-[min(2.6vw,2.6rem)] text-ink">
        <Icon name="ghost" className="size-[min(3vw,3rem)] text-ghost" />
        {byId(view, e.data.playerId)?.displayName} got Bhoot Bingo!
      </p>
    </div>
  );
}

function ScreenMessage({ game }: { game: GameHandle }) {
  const m = game.view!.screenMessage;
  if (!m) return null;
  return (
    <div className="step frame relative z-20 mx-auto mb-[1vh] max-w-[85vw] animate-arrive px-[3vw] py-[1.6vh] text-center [--frame-strength:70%]">
      <p className="font-display text-[min(3.4vw,3.6rem)] leading-tight text-accent">{m.text}</p>
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
  const entranceMs = (e: EventView) => (e.type === "murderRevealed" && typeof e.data.entranceMs === "number" ? e.data.entranceMs : 0);
  const held = recent.find(
    (e) =>
      ["banished", "noBanishment", "murderRevealed", "endgameResult", "playerEliminated"].includes(e.type) &&
      now - startOf(e) < HOLD_MS + (spin ? SPIN_MS : 0) + entranceMs(e),
  );
  if (held && entranceMs(held) && now - startOf(held) < entranceMs(held)) return <Entrance game={game} event={held} start={startOf(held)} />;
  if (view.finalePending && (!held || now - startOf(held) > HOLD_MS + entranceMs(held))) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <Keyhole className="size-[min(22vh,18vw)]" />
        <Big>Hold on</Big>
        <Sub>The host will tell you what happens next.</Sub>
      </div>
    );
  }
  if (view.phase === "FINALE" && view.finale && (!held || now - startOf(held) > 8_000 + entranceMs(held))) return <Finale game={game} />;
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
          <Sub>{view.settings.narration.roles}</Sub>
          <PhotoWall game={game} players={alive} size="sm" />
        </div>
      );
    case "MISSION": {
      const m = view.missions.find((x) => x.id === view.currentMissionId);
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
          <Big>{m?.name ?? "Mission"}</Big>
          <p className="font-display text-[min(2.6vw,2.6rem)] text-accent">{m?.kind === "ghost" ? "Ghost challenge" : m?.kind === "team" ? "Team mission" : "Mission"}</p>
          <Sub>{m?.howItWorks || view.settings.narration.mission}</Sub>
          {m?.winRule ? <Sub>To win: {m.winRule}</Sub> : null}
          {m?.tieRule ? <Sub>If it&apos;s a tie: {m.tieRule}</Sub> : null}
        </div>
      );
    }
    case "PRIVATE_TALKS":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh]">
          <Big>Private talks</Big>
          <Sub>{view.settings.narration.talks}</Sub>
          <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} className="text-[min(8vw,8rem)]" />
          <PhotoWall game={game} players={alive} size="sm" />
        </div>
      );
    case "CIRCLE_DEBATE":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh]">
          <Big>Circle of Shaq</Big>
          <Sub>{view.settings.narration.debate}</Sub>
          <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} className="text-[min(8vw,8rem)]" />
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
            {endgame ? view.settings.narration.endgame : revote ? "Only the tied players are on the ballot." : view.settings.narration.vote}
          </Sub>
          {round ? (
            <p className="font-display text-[min(5vw,5rem)] text-accent">
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
          <Keyhole className="size-[min(22vh,18vw)]" />
          <Big>Night falls</Big>
          <Sub>{view.settings.narration.night}</Sub>
        </div>
      );
    case "MURDER_REVEAL":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[4vh]">
          <Big>Breakfast</Big>
          <Sub>{view.night?.revealed ? "Mission or Circle next." : view.settings.narration.breakfast}</Sub>
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
  const sound = useScreenSounds(game);
  const view = game.view;
  useHouseLights(actOf(view));
  if (game.notFound) {
    return <main className="flex min-h-dvh items-center justify-center font-display text-[4vw]">No game called {code.toUpperCase()}</main>;
  }
  if (!view) return <main className="flex min-h-dvh items-center justify-center text-[2vw] text-ink-muted">Opening the big screen…</main>;
  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden px-[4vw] pt-[4vh] pb-[4vh]">
      <div className="step frame absolute inset-[1.4vh] -z-10 [--frame-fill:var(--ground)] [--frame-strength:55%] [--s:1.2vh]" aria-hidden />
      <header className="flex items-center justify-between text-[min(1.8vw,1.8rem)] text-ink-muted">
        <span>
          {view.phase === "LOBBY" ? null : <span className="font-display text-ink">Traitors · </span>}Room <span className="font-display text-ink">{view.code}</span>
          {view.startingPlayerCount && view.phase !== "FINALE" ? ` · Day ${view.day}` : ""}
        </span>
        <span className="flex items-center gap-3">
          {view.finalePending ? "Hold on" : PHASE_TITLE[view.phase]}
          <span className={`inline-block size-3 ${game.connection === "live" ? "bg-jade" : game.connection === "offline" ? "bg-danger-ink" : "bg-notice"}`} />
          <button type="button" onClick={sound.toggle} className="px-3 py-1 text-[min(1.4vw,1.2rem)] underline-offset-4 hover:underline">
            {sound.on ? "Sound on" : "Sound off"}
          </button>
          <button
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
            className="px-3 py-1 text-[min(1.4vw,1.2rem)] underline-offset-4 hover:underline"
          >
            Full screen
          </button>
        </span>
      </header>
      <main className="flex min-h-0 flex-1 flex-col py-[2vh]">
        <FitBox>
          <Stage game={game} />
        </FitBox>
      </main>
      <ScreenMessage game={game} />
      <BingoToast game={game} />
      <Reactions code={view.code} active={view.phase === "CIRCLE_DEBATE" && view.settings.ghostGames.liveReactions} />
      {view.paused ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ground">
          <Big>Paused</Big>
          <Sub>The game will be back shortly.</Sub>
        </div>
      ) : null}
    </div>
  );
}
