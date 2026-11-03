"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { GameHandle } from "@/lib/client/useGame";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorLine, gridPlayers, playerById } from "./shared";

function PinInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  return (
    <label className="flex flex-col gap-2 text-center">
      <span className="text-lg text-ink-muted">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="mx-auto h-16 w-48 border border-line/50 bg-ground text-center text-4xl tracking-[0.5em] text-accent focus:border-accent focus:outline-none"
        aria-label={label}
      />
    </label>
  );
}

/** Tap your photo, then set a PIN (new seat) or enter it (coming back). */
export function JoinScreen({ game, code }: { game: GameHandle; code: string }) {
  const view = game.view!;
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = playerById(view, pickedId);
  const returning = !!picked?.seatClaimed;

  const close = () => {
    setPickedId(null);
    setPin("");
    setAgain("");
    setError(null);
  };

  const submit = async () => {
    if (!picked) return;
    if (pin.length !== 4) return setError("The PIN is 4 digits.");
    if (!returning && pin !== again) return setError("The two PINs don't match. Try again.");
    setBusy(true);
    setError(null);
    try {
      await api(`/api/games/${code}/seat`, { kind: "player", body: { playerId: picked.id, pin } });
      await game.refresh();
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-display text-[2.6rem] leading-none">Tap your photo</h2>
        <div className="speed-lines mx-auto my-3 w-16" aria-hidden />
        <p className="text-lg text-ink-muted">Room {view.code}</p>
      </div>
      <PlayerGrid
        players={gridPlayers(game, view.players, (p) => ({ ghost: false, note: p.seatClaimed ? "Taken" : undefined }))}
        onSelect={setPickedId}
      />
      <Sheet open={!!picked} onClose={close}>
        {picked ? (
          <div className="flex flex-col items-center gap-5">
            <Avatar name={picked.displayName} url={game.photoFor(picked.photoPath)} size={132} tall />
            <h2 className="text-center font-display text-3xl leading-tight">
              {returning ? `Welcome back, ${picked.displayName}` : `Are you ${picked.displayName}?`}
            </h2>
            <p className="-mt-3 text-center text-ink-muted">
              {returning
                ? "Enter your PIN to carry on, on this phone."
                : "Choose a 4-digit PIN. You'll need it if you refresh or switch phones."}
            </p>
            <PinInput label={returning ? "Your PIN" : "Choose a PIN"} value={pin} onChange={setPin} autoFocus />
            {!returning ? <PinInput label="Type it again" value={again} onChange={setAgain} /> : null}
            <ErrorLine message={error} />
            <Button onClick={submit} busy={busy}>
              {returning ? "Rejoin" : "That's me"}
            </Button>
            <Button variant="quiet" size="md" onClick={close}>
              Not me
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
