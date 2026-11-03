"use client";

import { useCallback, useEffect, useState } from "react";
import { api, newKey } from "@/lib/client/api";
import type { GameHandle } from "@/lib/client/useGame";
import { Button } from "@/components/ui/Button";
import { Card, TextField } from "@/components/ui/Field";
import { ErrorLine } from "@/components/player/shared";

export interface PresetSummary {
  id: string;
  name: string;
  players: number;
  photos: number;
  createdAt: string;
}

export function usePresets() {
  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    api<{ presets: PresetSummary[] }>("/api/presets", { kind: "host" })
      .then((r) => live && setPresets(r.presets))
      .catch((err) => live && setError(err instanceof Error ? err.message : "Couldn't load presets."));
    return () => {
      live = false;
    };
  }, [round]);
  const load = useCallback(() => setRound((n) => n + 1), []);
  return { presets, error, setError, load };
}

/** Save this game's settings, roster (with photos) and missions for next time; or use a saved one here. */
export function PresetsCard({ game }: { game: GameHandle }) {
  const view = game.view!;
  const { presets, error, setError, load } = usePresets();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-display text-xl text-accent">Presets</p>
      <p className="text-sm text-ink-muted">
        A preset keeps these settings, the players with their photos, and the mission list, so the next game starts ready.
      </p>
      <TextField label="Save this game as" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Saturday night" />
      <Button
        size="md"
        variant="secondary"
        disabled={!name.trim()}
        busy={busy === "save"}
        onClick={() =>
          run("save", async () => {
            await api("/api/presets", { kind: "host", body: { code: view.code, name } });
            setNote(`Saved “${name.trim()}”.`);
            setName("");
            load();
          })
        }
      >
        Save preset
      </Button>
      {note ? <p className="text-sm text-jade">{note}</p> : null}
      <ErrorLine message={error} />
      {presets?.length ? (
        <ul className="flex flex-col gap-2">
          {presets.map((p) => (
            <li key={p.id} className="step flex flex-col gap-2 bg-surface-2 p-3">
              <span>
                <span className="text-ink">{p.name}</span>
                <span className="block text-sm text-ink-muted">
                  {p.players} players · {p.photos} photos
                </span>
              </span>
              <span className="flex gap-2">
                {view.phase === "LOBBY" ? (
                  <Button
                    size="sm"
                    className="flex-1"
                    busy={busy === p.id}
                    onClick={() =>
                      run(p.id, async () => {
                        game.accept(await api(`/api/games/${view.code}/preset`, { kind: "host", body: { presetId: p.id, key: newKey() } }));
                        setNote(`Used “${p.name}”: settings and missions. Players stay as they are.`);
                      })
                    }
                  >
                    Use its settings here
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="quiet"
                  busy={busy === `del-${p.id}`}
                  onClick={() =>
                    run(`del-${p.id}`, async () => {
                      await api(`/api/presets?id=${p.id}`, { kind: "host", method: "DELETE" });
                      load();
                    })
                  }
                >
                  Delete
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
