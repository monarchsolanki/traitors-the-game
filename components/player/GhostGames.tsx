"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import type { GameHandle } from "@/lib/client/useGame";
import type { Role } from "@/lib/game/types";
import { Button } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { ErrorLine, gridPlayers, playerById } from "./shared";

function useSend(game: GameHandle) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (action: Parameters<GameHandle["act"]>[0]) => {
    setBusy(true);
    setError(null);
    const r = await game.act(action);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Something went wrong.");
    return r.ok;
  };
  return { busy, error, send };
}

const nameOf = (game: GameHandle, id: string | null) => (id ? playerById(game.view!, id)?.displayName ?? "?" : "Nobody dies");

/** Tap an emoji and it floats across the big screen. Nobody sees who sent it. */
function ReactionBar({ game, emoji }: { game: GameHandle; emoji: string[] }) {
  const [last, setLast] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const react = (e: string) => {
    setLast(e);
    setNote(null);
    api<{ ok: boolean; busy?: boolean }>(`/api/games/${game.view!.code}/react`, { kind: "player", body: { emoji: e } })
      .then((r) => r.busy && setNote("Lots of reactions right now; try again in a moment."))
      .catch((err) => setNote(err instanceof Error ? err.message : "That didn't go through."))
      .finally(() => setTimeout(() => setLast(null), 600));
  };
  return (
    <Card>
      <p className="mb-2 font-display text-xl text-accent">React on the big screen</p>
      <div className="grid grid-cols-4 gap-2">
        {emoji.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => react(e)}
            className={`grid h-14 place-items-center bg-surface-2 text-3xl ring-1 ring-line/15 transition active:scale-90 ${last === e ? "scale-110 ring-line" : ""}`}
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      {note ? <p className="mt-2 text-lg text-ink-muted">{note}</p> : null}
    </Card>
  );
}

function BetsCard({ game }: { game: GameHandle }) {
  const view = game.view!;
  const bets = view.me!.ghostGames!.bets!;
  const { busy, error, send } = useSend(game);
  const [pick, setPick] = useState<string | null>(null);
  const [nobody, setNobody] = useState(false);
  const alive = view.players.filter((p) => p.status === "alive");
  const kind = bets.banishOpen && !bets.banish ? "banish" : bets.murderOpen && !bets.murder ? "murder" : null;
  const openCalls = bets.calls?.filter((c) => !c.myCall) ?? [];
  const madeCalls = bets.calls?.filter((c) => c.myCall) ?? [];
  const call = (playerId: string, c: Role) => send({ type: "traitorCall", playerId, call: c });
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-display text-xl text-accent">Bhoot Bets</p>
        <p className="text-lg text-ink-muted">Guess what happens next. Right guesses score points for Best Ghost.</p>
      </div>
      {kind ? (
        <div className="flex flex-col gap-3">
          <p className="text-lg">{kind === "banish" ? "Who will be banished next?" : "Who will the Traitors murder tonight?"}</p>
          <PlayerGrid
            players={gridPlayers(game, alive)}
            selectedId={nobody ? null : pick}
            onSelect={(id) => {
              setPick(id);
              setNobody(false);
            }}
            size={52}
          />
          {kind === "murder" ? (
            <Button variant={nobody ? "primary" : "secondary"} size="md" onClick={() => setNobody((n) => !n)}>
              Nobody dies tonight
            </Button>
          ) : null}
          <ErrorLine message={error} />
          <Button
            disabled={!pick && !nobody}
            busy={busy}
            onClick={async () => {
              if (await send({ type: "ghostBet", kind, targetId: nobody ? null : pick })) {
                setPick(null);
                setNobody(false);
              }
            }}
          >
            {nobody ? "Bet on nobody dying" : pick ? `Bet on ${nameOf(game, pick)}` : "Pick someone"}
          </Button>
        </div>
      ) : null}
      {bets.banish ? <p>Your banishment bet: {nameOf(game, bets.banish.pick)}. It settles at the reveal.</p> : null}
      {bets.murder ? <p>Your murder bet: {nameOf(game, bets.murder.pick)}. It settles at breakfast.</p> : null}
      {!kind && !bets.banish && !bets.murder ? <p className="text-ink-muted">Bets open during the Circle and at night.</p> : null}
      {openCalls.length ? (
        <div className="flex flex-col gap-3">
          <p className="text-lg">Were they a Traitor? (scored at the final reveal)</p>
          {openCalls.map((c) => (
            <div key={c.playerId} className="flex items-center gap-2">
              <span className="flex-1 truncate">{nameOf(game, c.playerId)}</span>
              <Button size="sm" variant="danger" busy={busy} onClick={() => call(c.playerId, "traitor")}>
                Traitor
              </Button>
              <Button size="sm" variant="secondary" busy={busy} onClick={() => call(c.playerId, "innocent")}>
                Innocent
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {madeCalls.length ? (
        <p className="text-lg text-ink-muted">
          Your calls: {madeCalls.map((c) => `${nameOf(game, c.playerId)} ${c.myCall === "traitor" ? "Traitor" : "Innocent"}`).join(" · ")}
        </p>
      ) : null}
      {bets.history.length ? (
        <ul className="flex flex-col gap-1 text-lg">
          {bets.history.slice(0, 6).map((h, i) => (
            <li key={i} className={`flex items-center gap-1.5 ${h.correct ? "text-jade" : "text-ink-muted"}`}>
              <Icon name={h.correct ? "check" : "cross"} className="size-4 shrink-0" />
              <span className="sr-only">{h.correct ? "Right:" : "Wrong:"}</span>
              Day {h.day} {h.kind === "banish" ? "banishment" : "murder"}: {nameOf(game, h.pick)}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function CrystalCard({ game }: { game: GameHandle }) {
  const view = game.view!;
  const cb = view.me!.ghostGames!.crystalBall!;
  const { busy, error, send } = useSend(game);
  const [picks, setPicks] = useState<string[]>([]);
  const others = view.players.filter((p) => p.id !== view.me!.playerId);
  const toggle = (id: string) => setPicks((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < cb.size ? [...s, id] : s));
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-display text-xl text-accent">Crystal Ball</p>
        <p className="text-lg text-ink-muted">At each Circle, name the {cb.size} Traitors. Scored at the final reveal.</p>
      </div>
      {cb.myPicks ? (
        <p>Locked in for this Circle: {cb.myPicks.map((id) => nameOf(game, id)).join(", ")}</p>
      ) : cb.open ? (
        <>
          <PlayerGrid players={gridPlayers(game, others)} selectedIds={picks} onSelect={toggle} size={52} />
          <ErrorLine message={error} />
          <Button
            disabled={picks.length !== cb.size}
            busy={busy}
            onClick={async () => {
              if (await send({ type: "crystalBall", playerIds: picks })) setPicks([]);
            }}
          >
            {picks.length === cb.size ? "Lock in my guess" : `Pick ${cb.size - picks.length} more`}
          </Button>
        </>
      ) : (
        <p className="text-ink-muted">Opens at the next Circle.{cb.locked ? ` You've locked in ${cb.locked} ${cb.locked === 1 ? "guess" : "guesses"} so far.` : ""}</p>
      )}
    </Card>
  );
}

function BingoCard({ game }: { game: GameHandle }) {
  const view = game.view!;
  const b = view.me!.ghostGames!.bingo!;
  const { busy, error, send } = useSend(game);
  const winner = b.winnerId ? (b.winnerId === view.me!.playerId ? "You got Bhoot Bingo first!" : `${nameOf(game, b.winnerId)} got Bhoot Bingo first.`) : null;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-display text-xl text-accent">Bhoot Bingo</p>
        <p className="text-lg text-ink-muted">Tap a square when it happens. First full line, across, down or diagonal, wins.</p>
      </div>
      {winner ? <Notice title={winner} /> : b.hasLine ? <Notice title="You got a line!" /> : null}
      <div className="grid grid-cols-3 gap-2">
        {b.card.map((m) => {
          const on = b.marked.includes(m);
          return (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => send({ type: "markBingo", moment: m })}
              aria-pressed={on}
              className={`min-h-24 p-2 text-lg leading-snug ring-1 transition active:scale-95 ${on ? "bg-accent text-on-accent ring-line" : "bg-surface-2 text-ink ring-line/15"}`}
            >
              {m}
            </button>
          );
        })}
      </div>
      <ErrorLine message={error} />
    </Card>
  );
}

/** Everything a ghost can play: score-only side games that never touch the living game (section 8). */
export function GhostGames({ game }: { game: GameHandle }) {
  const g = game.view!.me!.ghostGames;
  if (!g) return <Notice>Ghost games are switched off.</Notice>;
  return (
    <div className="flex flex-col gap-4">
      {g.reactions?.open ? <ReactionBar game={game} emoji={g.reactions.emoji} /> : null}
      {g.bets ? <BetsCard game={game} /> : null}
      {g.crystalBall ? <CrystalCard game={game} /> : null}
      {g.bingo ? <BingoCard game={game} /> : null}
    </div>
  );
}
