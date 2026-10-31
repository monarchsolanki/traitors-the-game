"use client";

import { useState, type ReactNode } from "react";
import type { ClientAction } from "@/lib/game/actions";
import { downloadPaperFallback } from "@/lib/client/paper";
import type { GameHandle } from "@/lib/client/useGame";
import { SETTING_META, defaultEndGameThreshold, type GameSettings, type SettingKey } from "@/lib/game/settings";
import type { ItemType, Role } from "@/lib/game/types";
import type { PlayerView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, Notice, Segmented, Stepper, TextField, Toggle } from "@/components/ui/Field";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorLine, gridPlayers, playerById } from "@/components/player/shared";

/** Every fix after dealing asks for a reason and goes in the action log (section 4.3). */
export function OverrideSheet({
  game,
  open,
  title,
  action,
  label,
  danger,
  disabled,
  onClose,
  children,
}: {
  game: GameHandle;
  open: boolean;
  title: string;
  action: (reason: string) => ClientAction | null;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setReason("");
    setError(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="flex flex-col gap-4">
        {children}
        <TextField
          label="Reason (goes in the action log)"
          value={reason}
          maxLength={300}
          placeholder="e.g. Tapped the wrong photo"
          onChange={(e) => setReason(e.target.value)}
        />
        <ErrorLine message={error} />
        <Button
          variant={danger ? "danger" : "primary"}
          busy={busy}
          disabled={disabled || !reason.trim()}
          onClick={async () => {
            const a = action(reason.trim());
            if (!a) return;
            setBusy(true);
            setError(null);
            const r = await game.act(a);
            setBusy(false);
            if (r.ok) close();
            else setError(r.error ?? "Something went wrong.");
          }}
        >
          {label}
        </Button>
      </div>
    </Sheet>
  );
}

function PlayerFix({ game, player, onClose }: { game: GameHandle; player: PlayerView; onClose: () => void }) {
  const view = game.view!;
  const host = view.host!;
  const [sheet, setSheet] = useState<null | "out" | "revive" | "role" | "give" | { move: string } | { remove: string }>(null);
  const [outStatus, setOutStatus] = useState<"murdered" | "banished" | "left">("left");
  const [giveType, setGiveType] = useState<ItemType>("shield");
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const role = host.roles[player.id] as Role;
  const held = host.items.filter((i) => i.holderId === player.id && i.state === "held");
  const alive = player.status === "alive";
  const others = view.players.filter((p) => p.status === "alive" && p.id !== player.id);
  const close = () => setSheet(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={player.displayName} url={game.photoFor(player.photoPath)} size={64} ghost={!alive} />
        <div>
          <p className="text-xl">{player.displayName}</p>
          <p className="text-ink-muted">
            {role === "traitor" ? "Traitor" : "Innocent"} · {alive ? "In the game" : player.status === "left" ? "Left" : player.status === "murdered" ? "Murdered" : "Banished"}
            {held.length ? ` · holds ${held.map((i) => i.type).join(" and ")}` : ""}
          </p>
        </div>
      </div>
      {alive ? (
        <Button variant="secondary" onClick={() => setSheet("out")}>
          Mark as out of the game
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setSheet("revive")}>
          Bring back into the game
        </Button>
      )}
      <Button variant="secondary" onClick={() => setSheet("role")}>
        Change role to {role === "traitor" ? "Innocent" : "Traitor"}
      </Button>
      {alive ? (
        <Button variant="secondary" onClick={() => setSheet("give")}>
          Give a shield or dagger
        </Button>
      ) : null}
      {held.map((i) => (
        <div key={i.id} className="flex gap-2">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => setSheet({ move: i.id })}>
            Move {i.type}
          </Button>
          <Button variant="secondary" size="md" className="flex-1" onClick={() => setSheet({ remove: i.id })}>
            Remove {i.type}
          </Button>
        </div>
      ))}
      <Button variant="quiet" size="md" onClick={onClose}>
        Done
      </Button>

      <OverrideSheet
        game={game}
        open={sheet === "out"}
        title={`Mark ${player.displayName} as out?`}
        label="Mark as out"
        danger
        onClose={close}
        action={(reason) => ({ type: "eliminatePlayer", playerId: player.id, status: outStatus, reason })}
      >
        <Segmented
          label="How"
          value={outStatus}
          options={[
            { value: "left", label: "Left the game" },
            { value: "murdered", label: "Murdered" },
            { value: "banished", label: "Banished" },
          ]}
          onChange={setOutStatus}
        />
        <Notice>Their role stays secret{view.settings.revealOnElimination ? " (unless roles are revealed on elimination)" : ""}. Their items are lost.</Notice>
      </OverrideSheet>
      <OverrideSheet game={game} open={sheet === "revive"} title={`Bring ${player.displayName} back?`} label="Bring back" onClose={close} action={(reason) => ({ type: "revivePlayer", playerId: player.id, reason })} />
      <OverrideSheet
        game={game}
        open={sheet === "role"}
        title={`Make ${player.displayName} ${role === "traitor" ? "Innocent" : "a Traitor"}?`}
        label="Change role"
        danger
        onClose={close}
        action={(reason) => ({ type: "setRole", playerId: player.id, role: role === "traitor" ? "innocent" : "traitor", reason })}
      >
        <Notice>Their phone asks them to peek at their role again.</Notice>
      </OverrideSheet>
      <OverrideSheet game={game} open={sheet === "give"} title={`Give ${player.displayName}…`} label={`Give a ${giveType}`} onClose={close} action={(reason) => ({ type: "giveItem", itemType: giveType, playerId: player.id, reason })}>
        <Segmented label="Ability" value={giveType} options={[{ value: "shield", label: "Shield" }, { value: "dagger", label: "Dagger" }]} onChange={setGiveType} />
      </OverrideSheet>
      <OverrideSheet
        game={game}
        open={typeof sheet === "object" && sheet !== null && "move" in sheet}
        title="Move it to…"
        label="Move"
        disabled={!moveTo}
        onClose={() => {
          setMoveTo(null);
          close();
        }}
        action={(reason) => (sheet && typeof sheet === "object" && "move" in sheet && moveTo ? { type: "moveItem", itemId: sheet.move, toPlayerId: moveTo, reason } : null)}
      >
        <PlayerGrid players={gridPlayers(game, others)} selectedId={moveTo} onSelect={setMoveTo} size={52} />
      </OverrideSheet>
      <OverrideSheet
        game={game}
        open={typeof sheet === "object" && sheet !== null && "remove" in sheet}
        title="Take it back?"
        label="Remove"
        danger
        onClose={close}
        action={(reason) => (sheet && typeof sheet === "object" && "remove" in sheet ? { type: "removeItem", itemId: sheet.remove, reason } : null)}
      />
    </div>
  );
}

function VoteFix({ game }: { game: GameHandle }) {
  const view = game.view!;
  const host = view.host!;
  const round = host.rounds.find((r) => r.id === host.currentRoundId);
  const [sheet, setSheet] = useState<null | "ballot" | "rerun">(null);
  const [voter, setVoter] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [choice, setChoice] = useState<"end" | "banish">("end");
  if (!round || round.kind === "reward" || round.status === "done") return null;
  const canEnter = round.status === "open" || round.status === "revealing";
  const voters = view.players.filter((p) => p.status === "alive" && round.eligibleVoterIds.includes(p.id));
  const endgame = round.kind === "endgame";
  const targets = view.players.filter((p) => round.candidateIds.includes(p.id) && p.status === "alive" && p.id !== voter);
  const existing = round.ballots.find((b) => b.voterId === voter);
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold text-gold">Fix the vote</p>
      {canEnter ? (
        <Button variant="secondary" onClick={() => setSheet("ballot")}>
          Enter or correct a ballot
        </Button>
      ) : null}
      <Button variant="secondary" onClick={() => setSheet("rerun")}>
        Rerun the vote
      </Button>
      <OverrideSheet
        game={game}
        open={sheet === "ballot"}
        title="Enter a ballot"
        label="Save the ballot"
        disabled={!voter || (!endgame && !target)}
        onClose={() => {
          setSheet(null);
          setVoter(null);
          setTarget(null);
        }}
        action={(reason) => (voter ? { type: "setBallot", voterId: voter, targetId: endgame ? undefined : target ?? undefined, choice: endgame ? choice : undefined, reason } : null)}
      >
        <p className="text-ink-muted">Whose ballot?</p>
        <PlayerGrid players={gridPlayers(game, voters, (p) => ({ note: round.ballots.some((b) => b.voterId === p.id) ? "Voted" : undefined }))} selectedId={voter} onSelect={setVoter} size={48} />
        {voter && existing ? <Notice>This replaces their ballot; a dagger on it stays.</Notice> : null}
        {voter ? (
          endgame ? (
            <Segmented label="Their vote" value={choice} options={[{ value: "end", label: "End" }, { value: "banish", label: "Banish" }]} onChange={setChoice} />
          ) : (
            <>
              <p className="text-ink-muted">Their vote</p>
              <PlayerGrid players={gridPlayers(game, targets)} selectedId={target} onSelect={setTarget} size={48} />
            </>
          )
        ) : null}
      </OverrideSheet>
      <OverrideSheet
        game={game}
        open={sheet === "rerun"}
        title="Rerun the vote?"
        label="Clear every ballot and reopen"
        danger
        onClose={() => setSheet(null)}
        action={(reason) => ({ type: "rerunVote", reason })}
      >
        <Notice>Every ballot is cleared. Daggers and ghost votes used in this vote are given back.</Notice>
      </OverrideSheet>
    </Card>
  );
}

function NightFix({ game }: { game: GameHandle }) {
  const view = game.view!;
  const [open, setOpen] = useState(false);
  const [victim, setVictim] = useState<string | "nobody" | null>(null);
  if (view.phase !== "NIGHT") return null;
  const alive = view.players.filter((p) => p.status === "alive");
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold text-gold">Fix the night</p>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Decide the night by hand
      </Button>
      <OverrideSheet
        game={game}
        open={open}
        title="Who dies tonight?"
        label="Decide the night"
        danger
        disabled={!victim}
        onClose={() => {
          setOpen(false);
          setVictim(null);
        }}
        action={(reason) => (victim ? { type: "resolveNight", targetId: victim === "nobody" ? null : victim, reason } : null)}
      >
        <Button variant={victim === "nobody" ? "primary" : "secondary"} size="md" onClick={() => setVictim("nobody")}>
          Nobody dies
        </Button>
        <PlayerGrid players={gridPlayers(game, alive)} selectedId={victim === "nobody" ? null : victim} onSelect={setVictim} size={48} />
        <Notice>A shield still protects its holder.</Notice>
      </OverrideSheet>
    </Card>
  );
}

const RULE_KEYS: SettingKey[] = [
  "endGameThreshold",
  "daggerWeight",
  "allowTraitorOnTraitor",
  "murderRule",
  "tieRule",
  "tieRevotesBeforeChoice",
  "traitorChat",
  "revealOnElimination",
  "recruitment",
  "recruitOffersPerNight",
  "ghostVote",
  "eliminatedWinWithTeam",
];

function show(key: SettingKey, s: GameSettings): string {
  const v = s[key];
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (key === "daggerWeight") return `×${v}`;
  if (key === "tieRule") return v === "revote" ? "Revote" : v === "spin" ? "Spin at once" : "Host decides";
  if (key === "recruitment") return v === "off" ? "Off" : "Last Traitor";
  if (key === "murderRule") return v === "majority" ? "Majority" : "Unanimous";
  return String(v);
}

function RuleFix({ game }: { game: GameHandle }) {
  const view = game.view!;
  const s = view.settings;
  const start = view.startingPlayerCount ?? view.players.length;
  const [key, setKey] = useState<SettingKey | null>(null);
  const [value, setValue] = useState<unknown>(null);
  const pick = (k: SettingKey) => {
    setKey(k);
    setValue(k === "endGameThreshold" && s.endGameThreshold === "auto" ? defaultEndGameThreshold(start) : s[k]);
  };
  let control: ReactNode = null;
  if (key) {
    const cur = value;
    if (typeof s[key] === "boolean") control = <Toggle label={SETTING_META[key].label} checked={!!cur} onChange={setValue} />;
    else if (key === "tieRevotesBeforeChoice") control = <Stepper label="Revotes" value={Number(cur)} min={1} max={5} onChange={setValue} />;
    else if (key === "endGameThreshold") control = <Stepper label="Threshold" value={Number(cur)} min={2} max={start - 1} onChange={setValue} />;
    else if (key === "daggerWeight") control = <Segmented label="Dagger" value={Number(cur)} options={[{ value: 2, label: "×2" }, { value: 3, label: "×3" }]} onChange={setValue} />;
    else if (key === "murderRule") control = <Segmented label="Murder rule" value={String(cur)} options={[{ value: "majority", label: "Majority" }, { value: "unanimous", label: "Unanimous" }]} onChange={setValue} />;
    else if (key === "tieRule") control = <Segmented label="Tie rule" value={String(cur)} options={[{ value: "revote", label: "Revote" }, { value: "spin", label: "Spin at once" }, { value: "hostDecides", label: "I decide" }]} onChange={setValue} />;
    else if (key === "recruitOffersPerNight") control = <Stepper label="Offers" value={Number(cur)} min={1} max={5} onChange={setValue} />;
    else if (key === "recruitment") control = <Segmented label="Recruitment" value={String(cur)} options={[{ value: "off", label: "Off" }, { value: "lastTraitor", label: "Last Traitor" }]} onChange={setValue} />;
  }
  return (
    <Card className="flex flex-col gap-1">
      <p className="mb-1 font-semibold text-gold">Change a frozen rule</p>
      <ul className="flex flex-col divide-y divide-gold/10">
        {RULE_KEYS.map((k) => (
          <li key={k}>
            <button type="button" onClick={() => pick(k)} className="flex w-full items-center justify-between py-3 text-left">
              <span>{SETTING_META[k].label}</span>
              <span className="text-gold">{show(k, s)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">The number of Traitors can&apos;t change once roles are dealt.</p>
      <OverrideSheet
        game={game}
        open={!!key}
        title={key ? SETTING_META[key].label : ""}
        label="Change the rule"
        onClose={() => setKey(null)}
        action={(reason) => (key ? { type: "overrideSetting", key, value, reason } : null)}
      >
        {key ? <p className="text-ink-muted">{SETTING_META[key].help}</p> : null}
        {control}
      </OverrideSheet>
    </Card>
  );
}

function LatePlayer({ game }: { game: GameHandle }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("innocent");
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add a late player
      </Button>
      <OverrideSheet
        game={game}
        open={open}
        title="Add a late player"
        label="Add"
        disabled={!name.trim()}
        onClose={() => {
          setOpen(false);
          setName("");
          setDisplayName("");
        }}
        action={(reason) => ({ type: "addPlayer", name, displayName: displayName.trim() || undefined, role, reason })}
      >
        <TextField label="Full name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <TextField label="Shown as (optional)" value={displayName} maxLength={24} onChange={(e) => setDisplayName(e.target.value)} />
        <Segmented label="Role" value={role} options={[{ value: "innocent", label: "Innocent" }, { value: "traitor", label: "Traitor" }]} onChange={setRole} />
        <Notice>They then tap their photo on their phone and set a PIN; confirm their seat in the Players tab.</Notice>
      </OverrideSheet>
    </>
  );
}

export function FixPanel({ game }: { game: GameHandle }) {
  const view = game.view!;
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const player = playerById(view, playerId);
  if (!view.startingPlayerCount) {
    return <Notice title="Nothing to fix yet">These tools open once roles are dealt. Before that, change anything in the Players and Settings tabs.</Notice>;
  }
  if (view.phase === "FINALE") {
    return (
      <div className="flex flex-col gap-4">
        <Notice title="The game is over">The action log has everything that happened.</Notice>
        <Button variant="secondary" onClick={() => downloadPaperFallback(view)}>
          Download the offline copy of roles
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="font-semibold text-gold">Paper fallback</p>
        <p className="text-ink-muted">Save every role and blank ballot slips to this device, in case the internet drops for everyone. Keep it private.</p>
        <Button variant="secondary" onClick={() => downloadPaperFallback(view)}>
          Download the offline copy of roles
        </Button>
      </Card>
      <Card className="flex flex-col gap-3">
        <p className="font-semibold text-gold">Fix a player</p>
        <PlayerGrid players={gridPlayers(game, view.players)} onSelect={setPlayerId} size={52} />
      </Card>
      <VoteFix game={game} />
      <NightFix game={game} />
      <RuleFix game={game} />
      <LatePlayer game={game} />
      <Button variant="danger" onClick={() => setEndOpen(true)}>
        End the game now
      </Button>
      <Sheet open={!!player} onClose={() => setPlayerId(null)}>
        {player ? <PlayerFix key={player.id} game={game} player={player} onClose={() => setPlayerId(null)} /> : null}
      </Sheet>
      <OverrideSheet game={game} open={endOpen} title="End the game now?" label="End the game and reveal" danger onClose={() => setEndOpen(false)} action={(reason) => ({ type: "endGameEarly", reason })}>
        <Notice>The final reveal shows straight away: the Traitors win if any is still in the game.</Notice>
      </OverrideSheet>
    </div>
  );
}
