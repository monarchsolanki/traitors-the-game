"use client";

import { useRef, useState } from "react";
import { api, ApiError, newKey } from "@/lib/client/api";
import type { GameHandle } from "@/lib/client/useGame";
import type { PlayerView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, Notice, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorLine } from "@/components/player/shared";
import { useHostSend } from "./GameControls";
import { presence, SeatDot } from "./SeatDot";

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Shrinks a phone photo to at most 720 px before upload, so it stays small and loads fast. */
async function resizePhoto(file: File, max = 720): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/jpeg", 0.85),
  );
}

function seatLabel(game: GameHandle, p: PlayerView): { text: string; tone: string } {
  const seat = game.seats.find((s) => s.playerId === p.id);
  if (seat?.locked) return { text: "Locked (wrong PINs)", tone: "text-danger-ink" };
  if (seat?.isBot) return { text: "Bot", tone: "text-ghost" };
  if (!p.seatClaimed) return { text: "Seat open", tone: "text-ink-muted" };
  if (!p.seatConfirmed) return { text: "Claimed, not confirmed", tone: "text-notice" };
  return { text: "Seated", tone: "text-jade" };
}

function EditPlayer({ game, player, onClose }: { game: GameHandle; player: PlayerView; onClose: () => void }) {
  const view = game.view!;
  const { busy, error, send, setError } = useHostSend(game);
  const [name, setName] = useState(player.name);
  const [displayName, setDisplayName] = useState(player.displayName);
  const [photoBusy, setPhotoBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const seat = game.seats.find((s) => s.playerId === player.id);
  const lobby = view.phase === "LOBBY";

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("playerId", player.id);
      form.set("file", await resizePhoto(f), "photo.jpg");
      await api(`/api/games/${view.code}/photo`, { kind: "host", form });
      await game.refresh();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't upload the photo.");
    } finally {
      setPhotoBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  const seatOp = async (op: "unlock" | "reset") => {
    setError(null);
    try {
      const r = await api(`/api/games/${view.code}/seats`, { kind: "host", body: { op, playerId: player.id, key: newKey() } });
      game.accept(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the seat.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3">
        <Avatar name={displayName || player.displayName} url={game.photoFor(player.photoPath)} size={112} />
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <div className="flex gap-2">
          <Button variant="secondary" size="md" busy={photoBusy} onClick={() => file.current?.click()}>
            {player.photoPath ? "Change photo" : "Add photo"}
          </Button>
          {player.photoPath ? (
            <Button
              variant="quiet"
              size="md"
              onClick={async () => {
                await api(`/api/games/${view.code}/photo?playerId=${player.id}`, { kind: "host", method: "DELETE" }).catch(() => undefined);
                await game.refresh();
              }}
            >
              Remove photo
            </Button>
          ) : null}
        </div>
      </div>
      <TextField label="Full name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <TextField label="Shown as" hint="What everyone sees on screens. Must be unique." value={displayName} maxLength={24} onChange={(e) => setDisplayName(e.target.value)} />
      <Button
        busy={busy}
        disabled={name === player.name && displayName === player.displayName}
        onClick={async () => {
          if (await send({ type: "editPlayer", playerId: player.id, name, displayName })) onClose();
        }}
      >
        Save name
      </Button>
      <div className="flex flex-wrap gap-2">
        {seat?.locked ? (
          <Button variant="secondary" size="md" onClick={() => seatOp("unlock")}>
            Unlock seat
          </Button>
        ) : null}
        {player.seatClaimed ? (
          <Button variant="secondary" size="md" onClick={() => seatOp("reset")}>
            Reset seat and PIN
          </Button>
        ) : null}
        {lobby ? (
          <Button
            variant="danger"
            size="md"
            onClick={async () => {
              if (await send({ type: "removePlayer", playerId: player.id })) onClose();
            }}
          >
            Remove from game
          </Button>
        ) : null}
      </div>
      {!view.closed ? (
        <div className="step flex flex-col gap-2 bg-surface-2 p-4">
          <p className="font-display text-xl text-accent">{view.host!.cohostId === player.id ? `${player.displayName} is the co-host` : "Co-host"}</p>
          <p className="text-sm text-ink-muted">
            The co-host runs missions, rewards and the big-screen message from their own phone. They never see roles, picks or who holds what.
          </p>
          <Button
            variant="secondary"
            size="md"
            busy={busy}
            onClick={() => send({ type: "setCohost", playerId: view.host!.cohostId === player.id ? null : player.id })}
          >
            {view.host!.cohostId === player.id ? "Stop being co-host" : `Make ${player.displayName} co-host`}
          </Button>
        </div>
      ) : null}
      <ErrorLine message={error} />
    </div>
  );
}

/** The roster rows and the edit sheet, shared by the Players tab and the lobby on the Game tab. */
export function Roster({ game, onConfirm, busy }: { game: GameHandle; onConfirm?: (playerId: string) => void; busy?: boolean }) {
  const view = game.view!;
  const [editing, setEditing] = useState<string | null>(null);
  const player = view.players.find((p) => p.id === editing);
  const lobby = view.phase === "LOBBY";
  return (
    <>
      <Card className="p-2">
        <ul className="flex flex-col divide-y divide-line/10">
          {view.players.map((p) => {
            const seat = seatLabel(game, p);
            return (
              <li key={p.id} className="flex items-center gap-2 pr-2">
                <button type="button" onClick={() => setEditing(p.id)} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left">
                  <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={52} ghost={p.status !== "alive"} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-lg">
                      <span className="truncate">{p.displayName}</span>
                      {view.host?.cohostId === p.id ? <span className="text-xs text-accent">co-host</span> : null}
                      <SeatDot state={presence(game.seats.find((x) => x.playerId === p.id), game.now())} />
                    </span>
                    <span className={`text-sm ${seat.tone}`}>
                      {p.status !== "alive" ? `${p.status === "left" ? "Left" : p.status === "murdered" ? "Murdered" : "Banished"} · ` : ""}
                      {seat.text}
                      {lobby && !p.photoPath ? <span className="text-ink-muted"> · no photo</span> : null}
                    </span>
                  </span>
                  {onConfirm && p.seatClaimed && !p.seatConfirmed ? null : <Icon name="chevron" className="size-5 shrink-0 text-ink-muted" />}
                </button>
                {onConfirm && p.seatClaimed && !p.seatConfirmed ? (
                  <Button variant="secondary" size="sm" busy={busy} aria-label={`Confirm ${p.displayName}'s seat`} onClick={() => onConfirm(p.id)}>
                    Confirm
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
      <Sheet open={!!player} onClose={() => setEditing(null)} title={player?.displayName}>
        {player ? <EditPlayer key={player.id} game={game} player={player} onClose={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

export function PlayersPanel({ game }: { game: GameHandle }) {
  const view = game.view!;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { busy, error, send } = useHostSend(game);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted">Tap a player to add their photo, rename them, or fix their seat.</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span className="flex items-center gap-1.5"><SeatDot state="online" /> phone connected</span>
        <span className="flex items-center gap-1.5"><SeatDot state="offline" /> not connected</span>
        <span className="flex items-center gap-1.5"><SeatDot state="bot" /> bot</span>
      </p>
      {view.players.length ? <Roster game={game} /> : <Notice>No players yet. Add them on the Game tab, or below.</Notice>}
      {view.phase === "LOBBY" ? (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Add a player
        </Button>
      ) : null}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a player">
        <div className="flex flex-col gap-4">
          <TextField label="Full name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <TextField label="Shown as (optional)" value={displayName} maxLength={24} onChange={(e) => setDisplayName(e.target.value)} />
          <ErrorLine message={error} />
          <Button
            disabled={!name.trim()}
            busy={busy}
            onClick={async () => {
              if (await send({ type: "addPlayer", name, displayName: displayName.trim() || undefined })) {
                setName("");
                setDisplayName("");
                setAdding(false);
              }
            }}
          >
            Add
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
