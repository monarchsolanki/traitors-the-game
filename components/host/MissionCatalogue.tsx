"use client";

import { useState } from "react";
import type { ClientAction } from "@/lib/game/actions";
import type { GameHandle } from "@/lib/client/useGame";
import { MISSION_LIMITS, type MissionTemplate } from "@/lib/game/settings";
import { Button } from "@/components/ui/Button";
import { Segmented, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorLine } from "@/components/player/shared";

type Draft = Omit<MissionTemplate, "id"> & { id?: string };

const BLANK: Draft = {
  name: "",
  kind: "team",
  howItWorks: "",
  minutes: 15,
  props: "",
  winRule: "",
  tieRule: "",
  reward: null,
  traitorAngle: "",
};

export function TextArea({
  label,
  value,
  onChange,
  maxLength,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-muted">{label}</span>
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-base text-ink ring-1 ring-gold/20 outline-none focus:ring-2 focus:ring-gold"
      />
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

/**
 * Pick a mission from the catalogue (section 7), tweak the rules, and start it; or add and edit missions.
 * Used by the host and the co-host; `send` goes through their own sender.
 */
export function MissionPicker({
  game,
  catalogue,
  open,
  onClose,
  send,
  busy,
  error,
}: {
  game: GameHandle;
  catalogue: MissionTemplate[];
  open: boolean;
  onClose: () => void;
  send: (a: ClientAction) => Promise<boolean>;
  busy: boolean;
  error: string | null;
}) {
  const view = game.view!;
  const [mode, setMode] = useState<"list" | "start" | "edit">("list");
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const played = new Set(view.missions.map((m) => m.name.toLowerCase()));
  const close = () => {
    setMode("list");
    setConfirmDelete(false);
    onClose();
  };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const pick = (t: MissionTemplate, next: "start" | "edit") => {
    setDraft({ ...t });
    setConfirmDelete(false);
    setMode(next);
  };

  const groups: Array<{ title: string; items: MissionTemplate[] }> = [
    { title: "Team games", items: catalogue.filter((t) => t.kind === "team") },
    { title: "Individual games", items: catalogue.filter((t) => t.kind === "individual") },
  ];

  return (
    <Sheet open={open} onClose={close} title={mode === "list" ? "Pick a mission" : mode === "start" ? draft.name || "Mission" : draft.id ? "Edit mission" : "New mission"}>
      {mode === "list" ? (
        <div className="flex flex-col gap-5">
          {groups.map((g) =>
            g.items.length ? (
              <div key={g.title} className="flex flex-col gap-2">
                <p className="text-sm tracking-widest text-ink-muted uppercase">{g.title}</p>
                {g.items.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => pick(t, "start")}
                      className="flex min-w-0 flex-1 flex-col rounded-2xl bg-surface-2 px-4 py-3 text-left ring-1 ring-gold/15 active:scale-[0.99]"
                    >
                      <span className="truncate text-base text-ink">{t.name}</span>
                      <span className="text-sm text-ink-muted">
                        {t.minutes} min{t.reward ? ` · suggests a ${t.reward}` : ""}
                        {played.has(t.name.toLowerCase()) ? " · played" : ""}
                      </span>
                    </button>
                    <Button variant="quiet" size="sm" onClick={() => pick(t, "edit")}>
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            ) : null,
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(BLANK);
              setMode("edit");
            }}
          >
            Add a mission
          </Button>
          <Button
            variant="quiet"
            size="md"
            onClick={() => {
              setDraft({ ...BLANK, name: "" });
              setMode("start");
            }}
          >
            Start one that isn&apos;t listed
          </Button>
        </div>
      ) : mode === "start" ? (
        <div className="flex flex-col gap-4">
          {draft.howItWorks ? <p className="text-ink-muted">{draft.howItWorks}</p> : null}
          {draft.props ? <p className="text-sm text-ink-muted">Props: {draft.props}</p> : null}
          {draft.traitorAngle ? <p className="text-sm text-ink-muted">Traitor angle: {draft.traitorAngle}</p> : null}
          <TextField label="Mission name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={MISSION_LIMITS.name} />
          <Segmented
            label="Type"
            value={draft.kind}
            options={[
              { value: "team", label: "Team game" },
              { value: "individual", label: "Individual" },
            ]}
            onChange={(v) => set("kind", v)}
          />
          <TextField label="How to win (shown to everyone)" value={draft.winRule} onChange={(e) => set("winRule", e.target.value)} maxLength={MISSION_LIMITS.rule} />
          <TextField label="If it's a tie" value={draft.tieRule} onChange={(e) => set("tieRule", e.target.value)} maxLength={MISSION_LIMITS.rule} />
          <ErrorLine message={error} />
          <Button
            disabled={!draft.name.trim()}
            busy={busy}
            onClick={async () => {
              const ok = await send({
                type: "startMission",
                name: draft.name,
                kind: draft.kind,
                winRule: draft.winRule,
                tieRule: draft.tieRule,
                ...(draft.id ? { templateId: draft.id } : {}),
              });
              if (ok) close();
            }}
          >
            Start the mission
          </Button>
          <Button variant="quiet" size="md" onClick={() => setMode("list")}>
            Back to the list
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TextField label="Mission name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={MISSION_LIMITS.name} />
          <Segmented
            label="Type"
            value={draft.kind}
            options={[
              { value: "team", label: "Team game" },
              { value: "individual", label: "Individual" },
            ]}
            onChange={(v) => set("kind", v)}
          />
          <TextArea label="How it works" value={draft.howItWorks} onChange={(v) => set("howItWorks", v)} maxLength={MISSION_LIMITS.howItWorks} />
          <TextField
            label="Minutes"
            inputMode="numeric"
            value={String(draft.minutes)}
            onChange={(e) => set("minutes", Math.max(1, Math.min(MISSION_LIMITS.minutes, Number(e.target.value.replace(/\D/g, "")) || 1)))}
          />
          <TextField label="Props" value={draft.props} onChange={(e) => set("props", e.target.value)} maxLength={MISSION_LIMITS.props} />
          <TextField label="How to win" value={draft.winRule} onChange={(e) => set("winRule", e.target.value)} maxLength={MISSION_LIMITS.rule} />
          <TextField label="If it's a tie" value={draft.tieRule} onChange={(e) => set("tieRule", e.target.value)} maxLength={MISSION_LIMITS.rule} />
          <Segmented
            label="Suggested reward"
            value={draft.reward ?? "none"}
            options={[
              { value: "shield", label: "Shield" },
              { value: "dagger", label: "Dagger" },
              { value: "none", label: "None" },
            ]}
            onChange={(v) => set("reward", v === "none" ? null : v)}
          />
          <TextField label="Traitor angle (a tip, optional)" value={draft.traitorAngle} onChange={(e) => set("traitorAngle", e.target.value)} maxLength={MISSION_LIMITS.traitorAngle} />
          <ErrorLine message={error} />
          <Button
            disabled={!draft.name.trim()}
            busy={busy}
            onClick={async () => {
              if (await send({ type: "saveMissionTemplate", template: draft })) setMode("list");
            }}
          >
            Save to the catalogue
          </Button>
          {draft.id ? (
            confirmDelete ? (
              <Button
                variant="danger"
                busy={busy}
                onClick={async () => {
                  if (await send({ type: "deleteMissionTemplate", templateId: draft.id! })) setMode("list");
                }}
              >
                Yes, remove {draft.name}
              </Button>
            ) : (
              <Button variant="quiet" size="md" onClick={() => setConfirmDelete(true)}>
                Remove from the catalogue
              </Button>
            )
          ) : null}
          <Button variant="quiet" size="md" onClick={() => setMode("list")}>
            Back to the list
          </Button>
        </div>
      )}
    </Sheet>
  );
}

/** A message on the big screen (host and co-host). */
export function ScreenMessageCard({ game, send, busy, error }: { game: GameHandle; send: (a: ClientAction) => Promise<boolean>; busy: boolean; error: string | null }) {
  const current = game.view!.screenMessage;
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-gold">Big-screen message</p>
      {current ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-ink">“{current.text}”</p> : <p className="text-sm text-ink-muted">Nothing showing.</p>}
      <TextField label="New message" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="Dinner in 10 minutes" />
      <ErrorLine message={error} />
      <div className="flex gap-2">
        <Button
          size="md"
          className="flex-1"
          disabled={!text.trim()}
          busy={busy}
          onClick={async () => {
            if (await send({ type: "setScreenMessage", text })) setText("");
          }}
        >
          Show it
        </Button>
        {current ? (
          <Button size="md" variant="secondary" className="flex-1" busy={busy} onClick={() => send({ type: "setScreenMessage", text: null })}>
            Clear it
          </Button>
        ) : null}
      </div>
    </div>
  );
}
