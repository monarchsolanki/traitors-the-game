"use client";

import { useState } from "react";
import { api, ApiError, newKey } from "@/lib/client/api";
import type { GameHandle } from "@/lib/client/useGame";
import type { ViewResponse } from "@/lib/game/api-types";
import { Button } from "@/components/ui/Button";
import { Notice, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorLine } from "@/components/player/shared";

/** Takes the game back one host step (logged with a reason). Shows what it will undo first. */
export function UndoButton({
  game,
  label = "Undo last step",
  variant = "quiet",
}: {
  game: GameHandle;
  label?: string;
  variant?: "quiet" | "secondary";
}) {
  const view = game.view!;
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<{ available: boolean; summary?: string; reason?: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setOpen(true);
    setPlan(null);
    setError(null);
    try {
      setPlan(await api(`/api/games/${view.code}/undo`, { kind: "host" }));
    } catch (err) {
      setPlan({ available: false, reason: err instanceof Error ? err.message : "Couldn't check what to undo." });
    }
  };

  const undo = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<ViewResponse>(`/api/games/${view.code}/undo`, {
        kind: "host",
        body: { key: newKey(), expectedVersion: view.version, reason },
      });
      game.accept(r);
      setOpen(false);
      setReason("");
    } catch (err) {
      if (err instanceof ApiError) game.accept(err.body as Partial<ViewResponse>);
      setError(err instanceof Error ? err.message : "Couldn't undo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={variant === "quiet" ? "md" : "lg"} onClick={start}>
        {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Undo">
        <div className="flex flex-col gap-4">
          {!plan ? <p className="text-center text-ink-muted">Checking…</p> : null}
          {plan && !plan.available ? <Notice title="Can't undo right now">{plan.reason}</Notice> : null}
          {plan?.available ? (
            <>
              <Notice title="This takes back">{plan.summary}</Notice>
              <p className="text-sm text-ink-muted">The game goes back to just before that step, timers included. Tap again afterwards to go back further.</p>
              <TextField label="Reason (goes in the action log)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              <ErrorLine message={error} />
              <Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={undo}>
                Undo
              </Button>
            </>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
