"use client";

import { useState } from "react";
import { splitNames } from "@/lib/client/labels";
import type { GameHandle } from "@/lib/client/useGame";
import { MAX_PLAYERS } from "@/lib/game/settings";
import { Button } from "@/components/ui/Button";
import { Card, Notice, TextField } from "@/components/ui/Field";
import { ErrorLine } from "@/components/player/shared";
import { QrCode } from "@/components/screen/QrCode";
import { useHostSend } from "./GameControls";
import { TextArea } from "./MissionCatalogue";
import { Roster } from "./PlayersPanel";
import { presence } from "./SeatDot";

/** The way in for guests: QR, link and room code, with Copy and Share. */
function Invite({ code }: { code: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : "";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it.");
    }
  };
  return (
    <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
      <QrCode value={url} className="size-40 shrink-0" />
      <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
        <p className="text-ink-muted">Guests scan this, or open</p>
        <p className="font-display text-base break-all text-ink select-all">{url}</p>
        <p className="font-display text-5xl tracking-[0.25em] text-accent">{code}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="md" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare ? (
            <Button variant="secondary" size="md" onClick={() => navigator.share({ title: "Traitors: The Game", text: `Join room ${code}`, url }).catch(() => undefined)}>
              Share
            </Button>
          ) : null}
        </div>
        <a href={`/screen/${code}`} target="_blank" rel="noreferrer" className="inline-block min-h-12 py-3 text-accent underline underline-offset-4">
          Open the big screen
        </a>
        <ErrorLine message={error} />
      </div>
    </Card>
  );
}

/** Type a name and press Enter, or paste the whole guest list (owner, 7 November). */
function AddGuests({ game }: { game: GameHandle }) {
  const { busy, error, send } = useHostSend(game);
  const [name, setName] = useState("");
  const [pasting, setPasting] = useState(false);
  const [list, setList] = useState("");
  const pasted = splitNames(list);
  const full = game.view!.players.length >= MAX_PLAYERS;
  const add = (names: string[]) => send({ type: "addPlayers", names: names.slice(0, 40) });

  if (full) return <Notice>The game is full: {MAX_PLAYERS} players.</Notice>;
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (splitNames(name).length && (await add(splitNames(name)))) setName("");
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField label="Add a guest" placeholder="Name, then Enter" autoComplete="off" enterKeyHint="done" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" size="md" busy={busy && !pasting} disabled={!name.trim()}>
          Add
        </Button>
      </form>
      {pasting ? (
        <div className="flex flex-col gap-3">
          <TextArea label="Paste your guest list" hint="One name per line or comma. Names already in are skipped." rows={6} value={list} onChange={setList} />
          <Button
            variant="secondary"
            busy={busy}
            disabled={!pasted.length}
            onClick={async () => {
              if (await add(pasted)) {
                setList("");
                setPasting(false);
              }
            }}
          >
            {pasted.length ? `Add ${pasted.length} ${pasted.length === 1 ? "guest" : "guests"}` : "Add guests"}
          </Button>
        </div>
      ) : null}
      <Button variant="quiet" size="md" onClick={() => setPasting((v) => !v)}>
        {pasting ? "Close the list" : "Paste a guest list"}
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

/** The lobby in one place: invite, add guests, and watch who has joined. */
export function LobbyRoster({ game }: { game: GameHandle }) {
  const view = game.view!;
  const { busy, error, send } = useHostSend(game);
  const claimed = view.players.filter((p) => p.seatClaimed);
  const confirmed = claimed.filter((p) => p.seatConfirmed).length;
  const online = claimed.filter((p) => presence(game.seats.find((s) => s.playerId === p.id), game.now()) !== "offline").length;
  return (
    <div className="flex flex-col gap-4">
      <Invite code={view.code} />
      <div className="flex flex-col gap-1">
        <p className="font-display text-2xl text-ink">
          {view.players.length ? `${claimed.length} of ${view.players.length} joined · ${confirmed} confirmed` : "Who's coming"}
        </p>
        {claimed.length ? <p className="text-sm text-ink-muted">Phones connected: {online} of {claimed.length}</p> : null}
      </div>
      <AddGuests game={game} />
      {view.players.length ? (
        <Roster game={game} busy={busy} onConfirm={(playerId) => void send({ type: "confirmSeat", playerId })} />
      ) : (
        <Notice>No guests yet. Add each name above, or paste your guest list. Guests then tap their photo to join.</Notice>
      )}
      <ErrorLine message={error} />
    </div>
  );
}
