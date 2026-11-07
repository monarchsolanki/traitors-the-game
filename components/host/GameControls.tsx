"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientAction } from "@/lib/game/actions";
import type { GameHandle } from "@/lib/client/useGame";
import { api } from "@/lib/client/api";
import { itemLabel } from "@/lib/client/labels";
import { MIN_PLAYERS, maxTraitors, validateSettings } from "@/lib/game/settings";
import type { ItemType, VoteRound } from "@/lib/game/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, Notice, Segmented, Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorLine, gridPlayers, playerById } from "@/components/player/shared";
import { downloadPaperFallback } from "@/lib/client/paper";
import { OverrideSheet } from "./FixPanel";
import { MissionPicker, ScreenMessageCard } from "./MissionCatalogue";
import { presence } from "./SeatDot";
import { LobbyRoster } from "./LobbyRoster";
import { UndoButton } from "./UndoButton";

export function useHostSend(game: GameHandle) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (action: ClientAction, strict = false) => {
    setBusy(true);
    setError(null);
    const r = await game.act(action, { strict });
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Something went wrong.");
    return r.ok;
  };
  return { busy, error, send, setError };
}

function Confirm({
  open,
  title,
  body,
  action,
  danger,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  action: string;
  danger?: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {body ? <div className="text-center text-ink-muted">{body}</div> : null}
        <ErrorLine message={error} />
        <Button variant={danger ? "danger" : "primary"} busy={busy} onClick={onConfirm}>
          {action}
        </Button>
        <Button variant="quiet" size="md" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

/** With private talks on, the next step from a mission or breakfast is private talks, then the Circle. */
function circleLabel(game: GameHandle): string {
  return game.view!.settings.privateTalks ? "Start private talks" : "Go to the Circle of Shaq";
}

function names(game: GameHandle, ids: string[]): string {
  return ids.map((id) => playerById(game.view!, id)?.displayName ?? id).join(", ");
}

/** Names with "(phone off)" after anyone whose phone isn't connected, for the waiting-on lists. */
function namesWithPresence(game: GameHandle, ids: string[]): string {
  const now = game.now();
  return ids
    .map((id) => {
      const n = playerById(game.view!, id)?.displayName ?? id;
      return presence(game.seats.find((s) => s.playerId === id), now) === "offline" ? `${n} (phone off)` : n;
    })
    .join(", ");
}

function TimerControls({ game }: { game: GameHandle }) {
  const view = game.view!;
  const { busy, error, send } = useHostSend(game);
  const hasTimer = view.deadline !== null || view.pausedRemainingMs !== null;
  if (!view.startingPlayerCount || view.phase === "FINALE") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {hasTimer ? (
          <>
            <Button variant="secondary" size="md" className="flex-1" busy={busy} onClick={() => send({ type: "adjustTimer", deltaSeconds: -60 })}>
              −1 min
            </Button>
            <Button variant="secondary" size="md" className="flex-1" busy={busy} onClick={() => send({ type: "adjustTimer", deltaSeconds: 60 })}>
              +1 min
            </Button>
          </>
        ) : null}
        <Button variant="secondary" size="md" className="flex-1" busy={busy} onClick={() => send({ type: view.paused ? "resume" : "pause" })}>
          {view.paused ? "Resume" : "Pause"}
        </Button>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

/** Host-only list of every role, hidden until switched on so a glance at the host's phone is safe. */
export function RolesList({ game }: { game: GameHandle }) {
  const view = game.view!;
  const [show, setShow] = useState(false);
  if (!view.startingPlayerCount) return null;
  return (
    <Card>
      <Toggle label="Show everyone's role" hint="Only you see this. Switch it off before others look." checked={show} onChange={setShow} />
      {show ? (
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={32} ghost={p.status !== "alive"} />
              <span className="truncate">{p.displayName}</span>
              <span className={`ml-auto text-sm ${p.role === "traitor" ? "text-danger-ink" : "text-ink-muted"}`}>
                {p.role === "traitor" ? "Traitor" : "Innocent"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function ChoicePoint({ game, children }: { game: GameHandle; children?: React.ReactNode }) {
  const [missionOpen, setMissionOpen] = useState(false);
  const { busy, error, send } = useHostSend(game);
  return (
    <div className="flex flex-col gap-3">
      {children}
      <Button onClick={() => setMissionOpen(true)}>Run a mission</Button>
      <Button variant="secondary" busy={busy} onClick={() => send({ type: "openCircle" })}>
        {circleLabel(game)}
      </Button>
      <ErrorLine message={error} />
      <MissionPicker
        game={game}
        catalogue={game.view!.host!.missionCatalogue}
        open={missionOpen}
        onClose={() => setMissionOpen(false)}
        send={(a) => send(a)}
        busy={busy}
        error={error}
      />
    </div>
  );
}

function MissionControls({ game }: { game: GameHandle }) {
  const view = game.view!;
  const host = view.host!;
  const mission = view.missions.find((m) => m.id === view.currentMissionId);
  const { busy, error, send, setError } = useHostSend(game);
  const [itemType, setItemType] = useState<ItemType>("shield");
  const [selected, setSelected] = useState<string[]>([]);
  const [voteMode, setVoteMode] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const round = host.rounds.find((r) => r.id === host.currentRoundId);
  const rewardOpen = round?.kind === "reward" && round.status === "open" ? round : null;
  const alive = view.players.filter((p) => p.status === "alive");
  const holding = (id: string, t: ItemType) => host.items.some((i) => i.holderId === id && i.type === t && i.state === "held");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const thisMission = host.items.filter((i) => i.missionId === mission?.id);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-display text-2xl text-accent">{mission?.name}</p>
        <p className="text-ink-muted">{mission?.kind === "ghost" ? "Ghost challenge" : mission?.kind === "team" ? "Team game" : "Individual game"}</p>
        {mission?.howItWorks ? <p className="mt-2 text-ink-muted">{mission.howItWorks}</p> : null}
        {mission?.winRule ? <p className="mt-2">To win: {mission.winRule}</p> : null}
        {mission?.tieRule ? <p>Tie: {mission.tieRule}</p> : null}
      </Card>
      {rewardOpen ? (
        <Card className="flex flex-col gap-3">
          <p className="font-display text-xl text-accent">Winners are voting for the {rewardOpen.itemType}</p>
          <p className="text-ink-muted">
            {rewardOpen.ballots.length} of {rewardOpen.eligibleVoterIds.length} voted. Waiting on:{" "}
            {names(game, rewardOpen.eligibleVoterIds.filter((id) => !rewardOpen.ballots.some((b) => b.voterId === id))) || "nobody"}
          </p>
          <Button busy={busy} onClick={() => send({ type: "lockRewardVote" })}>
            Close the vote now
          </Button>
        </Card>
      ) : mission?.kind === "ghost" ? (
        <GhostReward game={game} />
      ) : (
        <Card className="flex flex-col gap-4">
          <p className="font-display text-xl text-accent">Reward the winners (private)</p>
          <Segmented
            label="Ability"
            value={itemType}
            options={[
              { value: "shield", label: "Shield" },
              { value: "dagger", label: "Dagger" },
            ]}
            onChange={(v) => {
              setItemType(v);
              setError(null);
            }}
          />
          <Segmented
            label="How"
            value={voteMode ? "vote" : "direct"}
            options={[
              { value: "direct", label: "I pick" },
              { value: "vote", label: "Winners vote" },
            ]}
            onChange={(v) => setVoteMode(v === "vote")}
          />
          <p className="text-sm text-ink-muted">
            {voteMode ? "Tap every winner. They vote in private for who gets it." : `Tap who gets a ${itemType}. Nobody can hold two.`}
          </p>
          <PlayerGrid
            players={gridPlayers(game, alive, (p) => ({
              note: holding(p.id, itemType) ? `Has a ${itemType}` : undefined,
              disabled: !voteMode && holding(p.id, itemType),
            }))}
            selectedIds={selected}
            onSelect={toggle}
            size={56}
          />
          <ErrorLine message={error} />
          <Button
            disabled={!selected.length}
            busy={busy}
            onClick={async () => {
              const ok = voteMode
                ? await send({ type: "openRewardVote", itemType, voterIds: selected })
                : await send({ type: "awardItem", itemType, playerIds: selected });
              if (ok) setSelected([]);
            }}
          >
            {voteMode ? "Open the winners' vote" : `Give a ${itemType} to ${selected.length || "…"}`}
          </Button>
        </Card>
      )}
      {thisMission.length ? (
        <Notice title="Given in this mission">
          {thisMission.map((i) => `${itemLabel(i.type)}: ${playerById(view, i.holderId)?.displayName}`).join(" · ")}
        </Notice>
      ) : null}
      <Button variant="secondary" disabled={!!rewardOpen} onClick={() => setMissionOpen(true)}>
        Another mission
      </Button>
      <Button disabled={!!rewardOpen} busy={busy} onClick={() => send({ type: "openCircle" })}>
        {circleLabel(game)}
      </Button>
      <MissionPicker game={game} catalogue={host.missionCatalogue} open={missionOpen} onClose={() => setMissionOpen(false)} send={(a) => send(a)} busy={busy} error={error} />
    </div>
  );
}

/** After a ghost challenge: if the ghosts won, they give the ability to a living player of their choice. */
function GhostReward({ game }: { game: GameHandle }) {
  const view = game.view!;
  const host = view.host!;
  const { busy, error, send } = useHostSend(game);
  const [itemType, setItemType] = useState<ItemType>("shield");
  const [voteMode, setVoteMode] = useState(true);
  const [pick, setPick] = useState<string | null>(null);
  const ghosts = view.players.filter((p) => p.status !== "alive").map((p) => p.id);
  const alive = view.players.filter((p) => p.status === "alive");
  const holding = (id: string) => host.items.some((i) => i.holderId === id && i.type === itemType && i.state === "held");
  return (
    <Card className="flex flex-col gap-4">
      <p className="font-display text-xl text-accent">If the ghosts won</p>
      <p className="text-sm text-ink-muted">They give the ability to any living player they choose, in private. If they lost, just move on.</p>
      <Segmented
        label="Ability"
        value={itemType}
        options={[
          { value: "shield", label: "Shield" },
          { value: "dagger", label: "Dagger" },
        ]}
        onChange={setItemType}
      />
      <Segmented
        label="How they choose"
        value={voteMode ? "vote" : "direct"}
        options={[
          { value: "vote", label: "Ghosts vote" },
          { value: "direct", label: "They tell me" },
        ]}
        onChange={(v) => setVoteMode(v === "vote")}
      />
      {voteMode ? (
        <p className="text-ink-muted">Every ghost votes on their phone: {names(game, ghosts) || "no ghosts yet"}. Most votes wins; a tie is settled at random.</p>
      ) : (
        <PlayerGrid
          players={gridPlayers(game, alive, (p) => ({ note: holding(p.id) ? `Has a ${itemType}` : undefined, disabled: holding(p.id) }))}
          selectedId={pick}
          onSelect={setPick}
          size={56}
        />
      )}
      <ErrorLine message={error} />
      <Button
        disabled={voteMode ? !ghosts.length : !pick}
        busy={busy}
        onClick={async () => {
          const ok = voteMode
            ? await send({ type: "openRewardVote", itemType, voterIds: ghosts })
            : await send({ type: "awardItem", itemType, playerIds: [pick!] });
          if (ok) setPick(null);
        }}
      >
        {voteMode ? "The ghosts won: open their vote" : `Give the ${itemType} to ${pick ? playerById(view, pick)?.displayName : "…"}`}
      </Button>
    </Card>
  );
}

function TalksControls({ game }: { game: GameHandle }) {
  const { busy, error, send } = useHostSend(game);
  return (
    <div className="flex flex-col gap-4">
      <Notice>Private talks: players split up and talk. When the timer ends (or you tap below), every phone alerts and the Circle of Shaq opens.</Notice>
      <Button busy={busy} onClick={() => send({ type: "openCircle" }, true)}>
        End private talks and open the Circle
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

function VotingControls({ game, round }: { game: GameHandle; round: VoteRound }) {
  const view = game.view!;
  const { busy, error, send } = useHostSend(game);
  const [confirm, setConfirm] = useState(false);
  const has = (id: string) => round.ballots.some((b) => b.voterId === id);
  const living = round.eligibleVoterIds.filter((id) => playerById(view, id)?.status === "alive");
  const waiting = living.filter((id) => !has(id));
  const ghostsLeft = round.ghostVoterIds.filter((id) => !has(id) && !view.host!.players.find((p) => p.id === id)?.ghostVoteUsed);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-lg">
          <span className="font-semibold text-accent">{living.length - waiting.length}</span> of {living.length} living players have voted
          {round.ballots.some((b) => b.ghost) ? ` (+${round.ballots.filter((b) => b.ghost).length} ghost)` : ""}.
        </p>
        <p className="mt-1 text-ink-muted">{waiting.length ? `Waiting on: ${namesWithPresence(game, waiting)}` : "Every living vote is in."}</p>
        {ghostsLeft.length ? (
          <p className="mt-1 text-sm text-ink-muted">Ghosts who could still use their one vote: {names(game, ghostsLeft)}</p>
        ) : null}
      </Card>
      <Button onClick={() => setConfirm(true)}>Lock voting</Button>
      <Confirm
        open={confirm}
        title="Lock voting?"
        body={waiting.length ? `${names(game, waiting)} haven't voted. They'll count as abstaining.` : "Every living vote is in."}
        action="Lock voting"
        busy={busy}
        error={error}
        onConfirm={async () => (await send({ type: "lockVoting" })) && setConfirm(false)}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function RevealControls({ game, round }: { game: GameHandle; round: VoteRound }) {
  const view = game.view!;
  const { busy, error, send } = useHostSend(game);
  const [pick, setPick] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const [handPick, setHandPick] = useState<string | null>(null);
  const [nobody, setNobody] = useState(false);
  const shown = round.revealOrder.slice(0, round.revealedCount).map((id) => round.ballots.find((b) => b.voterId === id)!);
  const name = (id: string | null) => playerById(view, id)?.displayName ?? "";
  const tie = round.status === "tied" && round.result?.outcome === "tie" ? round.result : null;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="mb-2 text-ink-muted">
          {round.revealedCount} of {round.ballots.length} shown on screens
        </p>
        <ul className="flex flex-col gap-1">
          {shown.map((b) => (
            <li key={b.voterId}>
              {name(b.voterId)} <Icon name="arrow" className="inline size-4 align-[-2px] text-ink-muted" /> <span className="font-semibold text-accent">{b.choice ? (b.choice === "end" ? "End" : "Banish") : name(b.targetId)}</span>
              {b.usedDagger ? ` ×${b.weight}` : ""}
              {b.ghost ? " (ghost)" : ""}
            </li>
          ))}
        </ul>
      </Card>
      {tie ? (
        <Card className="flex flex-col gap-3">
          <p className="text-lg">Tie between {names(game, tie.tiedIds)}.</p>
          {tie.method === "revote" ? (
            <Button busy={busy} onClick={() => send({ type: "startRevote" })}>
              Start the revote
            </Button>
          ) : null}
          {tie.method === "choose" ? (
            <>
              <p className="text-ink-muted">Still tied after {view.settings.tieRevotesBeforeChoice} {view.settings.tieRevotesBeforeChoice === 1 ? "revote" : "revotes"}. Your call:</p>
              <Button busy={busy} onClick={() => send({ type: "startRevote" })}>
                Vote again
              </Button>
              <Button variant="secondary" busy={busy} onClick={() => send({ type: "spinTie" }, true)}>
                Spin
              </Button>
            </>
          ) : null}
          {tie.method === "spin" ? (
            <Button busy={busy} onClick={() => send({ type: "spinTie" }, true)}>
              Spin
            </Button>
          ) : null}
          {round.kind === "circle" || round.kind === "revote" ? (
            <Button variant="secondary" busy={busy} onClick={() => setNobody(true)}>
              Banish nobody
            </Button>
          ) : null}
          <Confirm
            open={nobody}
            title="Banish nobody?"
            body="The tie stands: nobody leaves the game. You start the night next."
            action="Banish nobody"
            busy={busy}
            error={error}
            onConfirm={async () => (await send({ type: "noBanishment" }, true)) && setNobody(false)}
            onClose={() => setNobody(false)}
          />
          {tie.method !== "host" ? (
            <Button variant="quiet" size="md" onClick={() => setByHand(true)}>
              Decide by hand instead
            </Button>
          ) : null}
          <OverrideSheet
            game={game}
            open={byHand}
            title="Decide the tie by hand"
            label={handPick ? `Banish ${name(handPick)}` : "Pick a player"}
            danger
            disabled={!handPick}
            onClose={() => {
              setByHand(false);
              setHandPick(null);
            }}
            action={(reason) => (handPick ? { type: "decideTie", playerId: handPick, reason } : null)}
          >
            <PlayerGrid
              players={gridPlayers(game, view.players.filter((p) => tie.tiedIds.includes(p.id) && p.status === "alive"))}
              selectedId={handPick}
              onSelect={setHandPick}
              size={56}
            />
          </OverrideSheet>
          {tie.method === "host" ? (
            <>
              <PlayerGrid players={gridPlayers(game, view.players.filter((p) => tie.tiedIds.includes(p.id)))} selectedId={pick} onSelect={setPick} size={56} />
              <Button disabled={!pick} busy={busy} onClick={() => pick && send({ type: "decideTie", playerId: pick })}>
                Banish {name(pick)}
              </Button>
            </>
          ) : null}
        </Card>
      ) : (
        <>
          <Button
            disabled={round.revealedCount >= round.ballots.length}
            busy={busy}
            onClick={() => send({ type: "revealNextBallot" }, true)}
          >
            Reveal the next vote
          </Button>
          <Button variant="secondary" busy={busy} onClick={() => send({ type: "finishReveal" })}>
            {round.revealedCount >= round.ballots.length ? "Show the result" : "Skip to the result"}
          </Button>
        </>
      )}
      <ErrorLine message={error} />
    </div>
  );
}

/** Owner, 6 November: after the result, every screen shows it with all the votes until the host starts the night. */
function NightStartControls({ game }: { game: GameHandle }) {
  const view = game.view!;
  const { busy, error, send } = useHostSend(game);
  const result = view.pastRounds[view.pastRounds.length - 1]?.result;
  const who = result?.outcome === "banish" ? playerById(view, result.playerId)?.displayName : null;
  return (
    <div className="flex flex-col gap-4">
      <Notice title={who ? `${who} is banished` : "Nobody is banished"}>
        Every screen shows the result and all the votes. The night, and the Traitors&apos; timer, start when you tap below.
      </Notice>
      <Button busy={busy} onClick={() => send({ type: "startNight" }, true)}>
        Start the night
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

function NightControls({ game }: { game: GameHandle }) {
  const view = game.view!;
  const host = view.host!;
  const night = host.nights[host.nights.length - 1];
  const { busy, error, send } = useHostSend(game);
  const [confirm, setConfirm] = useState(false);
  const traitors = view.players.filter((p) => p.status === "alive" && p.role === "traitor");
  const innocents = view.players.filter((p) => p.status === "alive" && p.role === "innocent");
  const answered = innocents.filter((p) => night?.suspectAnswers[p.id]).length;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="mb-2 font-display text-xl text-accent">Traitors&apos; picks (only you see this)</p>
        <ul className="flex flex-col gap-1">
          {traitors.map((t) => (
            <li key={t.id}>
              {t.displayName} <Icon name="arrow" className="inline size-4 align-[-2px] text-ink-muted" /> {night?.picks[t.id] ? playerById(view, night.picks[t.id])?.displayName : <span className="text-ink-muted">choosing…</span>}
            </li>
          ))}
        </ul>
        {night?.blackmail ? <p className="mt-2 text-danger-ink">Tonight is a blackmail night.</p> : null}
        {night?.refused.map((r) => (
          <p key={r.targetId} className="mt-2 text-ink-muted">
            Recruit offer to {playerById(view, r.targetId)?.displayName}: {r.answer === "refused" ? "refused" : "no answer"}
          </p>
        ))}
        {night?.recruit ? (
          <p className="mt-2">
            Recruit offer to {playerById(view, night.recruit.targetId)?.displayName}: {night.recruit.answer ?? "waiting"}
          </p>
        ) : null}
        {view.settings.suspectPoll ? (
          <p className="mt-2 text-ink-muted">
            Suspect poll: {answered} of {innocents.length} answered
          </p>
        ) : null}
      </Card>
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        End the night now
      </Button>
      <Confirm
        open={confirm}
        title="End the night now?"
        body={night?.blackmail && night.recruit && !night.recruit.answer ? "The blackmail offer is off and nobody dies." : "The night resolves with the picks made so far."}
        action="End the night"
        busy={busy}
        error={error}
        onConfirm={async () => (await send({ type: "resolveNight" })) && setConfirm(false)}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

const REASON: Record<string, string> = {
  murdered: "The Traitors' pick was carried out.",
  shield: "A shield saved the target.",
  noValidPicks: "The Traitors made no valid pick.",
  notUnanimous: "The Traitors didn't agree.",
  recruitAccepted: "The recruit accepted and is now a Traitor.",
  recruitRefused: "The recruit refused.",
  recruitTimeout: "The recruit didn't answer in time.",
  blackmailRefused: "They refused the blackmail, so they die.",
  blackmailTimeout: "They didn't answer the blackmail in time, so they die.",
  host: "You resolved it by hand.",
};

function BreakfastControls({ game }: { game: GameHandle }) {
  const view = game.view!;
  const host = view.host!;
  const night = host.nights[host.nights.length - 1];
  const { busy, error, send } = useHostSend(game);
  const [confirm, setConfirm] = useState(false);
  if (night?.revealed) {
    return (
      <ChoicePoint game={game}>
        <Notice>{night.victimId ? `${playerById(view, night.victimId)?.displayName} was murdered.` : "Nobody died."} Now: a mission, or straight to the Circle?</Notice>
      </ChoicePoint>
    );
  }
  const victim = playerById(view, night?.victimId);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm text-ink-muted">Only you see this until you reveal it:</p>
        <p className="font-display text-3xl text-accent">{victim ? `${victim.displayName} was murdered` : "Nobody died"}</p>
        {night?.reason ? <p className="text-ink-muted">{REASON[night.reason]}</p> : null}
      </Card>
      <Button onClick={() => setConfirm(true)}>Reveal to everyone</Button>
      <Confirm
        open={confirm}
        title="Reveal the night?"
        body="Every screen shows who died, or that nobody died. Never why."
        action="Reveal"
        busy={busy}
        error={error}
        onConfirm={async () => (await send({ type: "revealMurder" })) && setConfirm(false)}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function LobbyControls({ game }: { game: GameHandle; }) {
  const view = game.view!;
  const { busy, error, send, setError } = useHostSend(game);
  const [confirm, setConfirm] = useState(false);
  const [botBusy, setBotBusy] = useState(false);
  const n = view.players.length;
  const claimed = view.players.filter((p) => p.seatClaimed);
  const unconfirmed = claimed.filter((p) => !p.seatConfirmed);
  const open = view.players.filter((p) => !p.seatClaimed);
  // What still stops the deal, in plain words; the engine checks it all again when the host deals.
  const blockers: Array<{ text: string; fix?: { label: string; action: ClientAction } }> = [];
  if (n < MIN_PLAYERS) blockers.push({ text: `Add at least ${MIN_PLAYERS} players (${MIN_PLAYERS - n} more).` });
  if (open.length) blockers.push({ text: `Waiting on ${open.length} to join: ${names(game, open.map((p) => p.id))}.` });
  if (unconfirmed.length) blockers.push({ text: `Confirm ${unconfirmed.length} ${unconfirmed.length === 1 ? "seat" : "seats"}: ${names(game, unconfirmed.map((p) => p.id))}.` });
  if (n >= MIN_PLAYERS) {
    const v = validateSettings(view.settings, n);
    if (!v.ok) {
      for (const text of v.errors) {
        const tooMany = view.settings.traitorCount > maxTraitors(n) && text.startsWith("Traitors:");
        blockers.push({
          text: tooMany ? `${view.settings.traitorCount} Traitors needs at least ${view.settings.traitorCount * 3} players.` : text,
          fix: tooMany ? { label: `Use ${maxTraitors(n)} ${maxTraitors(n) === 1 ? "Traitor" : "Traitors"}`, action: { type: "updateSettings", patch: { traitorCount: maxTraitors(n) } } } : undefined,
        });
      }
    }
  }

  const confirmAll = async () => {
    for (const p of unconfirmed) if (!(await send({ type: "confirmSeat", playerId: p.id }))) break;
  };
  const fillBots = async () => {
    setBotBusy(true);
    setError(null);
    try {
      const r = await api(`/api/games/${view.code}/seats`, { kind: "host", body: { op: "fillBots" } });
      game.accept(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add bots.");
    } finally {
      setBotBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <LobbyRoster game={game} />
      {blockers.length ? (
        <Card className="flex flex-col gap-3">
          <p className="font-display text-xl text-accent">Before you deal</p>
          <ul className="flex flex-col gap-2">
            {blockers.map((b) => (
              <li key={b.text} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">{b.text}</span>
                {b.fix ? (
                  <Button variant="secondary" size="sm" busy={busy} onClick={() => send(b.fix!.action)}>
                    {b.fix.label}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {unconfirmed.length > 1 ? (
        <Button variant="secondary" busy={busy} onClick={confirmAll}>
          Confirm all {unconfirmed.length} claimed seats
        </Button>
      ) : null}
      {open.length ? (
        <Button variant="secondary" busy={botBusy} onClick={fillBots}>
          Fill {open.length} empty {open.length === 1 ? "seat" : "seats"} with bots (for testing)
        </Button>
      ) : null}
      <Button disabled={!!blockers.length} onClick={() => setConfirm(true)}>
        Deal roles
      </Button>
      <ErrorLine message={error} />
      <Confirm
        open={confirm}
        title="Deal the roles?"
        body={`${view.settings.traitorCount} Traitors among ${view.players.length} players. Rule settings freeze once roles are dealt.`}
        action="Deal roles"
        busy={busy}
        error={error}
        onConfirm={async () => (await send({ type: "dealRoles" })) && setConfirm(false)}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function FinaleControls({ game }: { game: GameHandle }) {
  const view = game.view!;
  const { busy, error, send } = useHostSend(game);
  const [confirm, setConfirm] = useState(false);
  const f = view.finale!;
  const revealed = !view.finalePending;
  return (
    <div className="flex flex-col gap-4">
      <Card className="text-center">
        {!revealed ? <p className="text-sm text-ink-muted">Only you see this. Everyone else sees &ldquo;Hold on&rdquo;.</p> : null}
        <p className={`font-display text-4xl ${f.winner === "traitors" ? "text-danger-ink" : "text-accent"}`}>
          {f.winner === "traitors" ? "The Traitors win" : "The Innocents win"}
        </p>
        <p className="text-ink-muted">{f.reason}</p>
        <p className="mt-2">Winners: {names(game, f.winnerIds)}</p>
      </Card>
      {f.ghostScores.some((g) => g.total > 0) ? (
        <Card>
          <p className="mb-2 font-display text-xl text-accent">Best Ghost</p>
          <ol className="flex flex-col gap-1">
            {f.ghostScores.filter((g) => g.total > 0).map((g, i) => (
              <li key={g.playerId} className="flex justify-between gap-2">
                <span>
                  {i + 1}. {playerById(view, g.playerId)?.displayName}
                </span>
                <span className="font-display text-accent">{g.total}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
      {!revealed ? (
        <>
          <Button onClick={() => setConfirm(true)}>Reveal to everyone</Button>
          <UndoButton game={game} label="Undo the win and keep playing" variant="secondary" />
          <Notice>Take your time: do the build-up in the room first. The big screen and every phone show the final reveal the moment you tap.</Notice>
          <Confirm
            open={confirm}
            title="Reveal the result?"
            body="The big screen and every phone show who won and every role."
            action="Reveal now"
            busy={busy}
            error={error}
            onConfirm={async () => (await send({ type: "revealFinale" }, true)) && setConfirm(false)}
            onClose={() => setConfirm(false)}
          />
        </>
      ) : !view.closed ? (
        <Button variant="secondary" busy={busy} onClick={() => send({ type: "closeGame" })}>
          Close the game
        </Button>
      ) : (
        <Notice>This game is closed.</Notice>
      )}
      <ErrorLine message={error} />
    </div>
  );
}

function BigScreenCard({ game }: { game: GameHandle }) {
  const { busy, error, send } = useHostSend(game);
  if (game.view!.closed) return null;
  return (
    <Card>
      <ScreenMessageCard game={game} send={(a) => send(a)} busy={busy} error={error} />
    </Card>
  );
}

/** Runs bot seats from the host's screen while the switch is on. */
function BotRunner({ game }: { game: GameHandle }) {
  const view = game.view!;
  const hasBots = game.seats.some((s) => s.isBot);
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!hasBots || !on || view.phase === "FINALE" || view.paused) return;
    let stop = false;
    const t = setInterval(() => {
      if (stop) return;
      void api(`/api/games/${view.code}/bots`, { kind: "host", body: {} }).catch(() => undefined);
    }, 1500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [hasBots, on, view.code, view.paused, view.phase]);
  if (!hasBots) return null;
  return (
    <Card>
      <Toggle label="Bots play automatically" hint="Bots vote, pick and answer at random. They don't press host buttons." checked={on} onChange={setOn} />
    </Card>
  );
}

export function GameControls({ game }: { game: GameHandle }) {
  const view = game.view!;
  const host = view.host!;
  const round = useMemo(() => host.rounds.find((r) => r.id === host.currentRoundId) ?? null, [host]);
  let body: React.ReactNode = null;
  switch (view.phase) {
    case "LOBBY":
      body = <LobbyControls game={game} />;
      break;
    case "ROLES": {
      const unseen = view.players.filter((p) => !host.roleSeen[p.id]).map((p) => p.id);
      body = (
        <ChoicePoint game={game}>
          <Notice>{unseen.length ? `Still to open their role: ${names(game, unseen)}` : "Everyone has opened their role."}</Notice>
          <Button variant="secondary" onClick={() => downloadPaperFallback(view)}>
            Save the offline copy of roles
          </Button>
        </ChoicePoint>
      );
      break;
    }
    case "MISSION":
      body = <MissionControls game={game} />;
      break;
    case "PRIVATE_TALKS":
      body = <TalksControls game={game} />;
      break;
    case "CIRCLE_DEBATE":
      body = <OpenVoting game={game} />;
      break;
    case "CIRCLE_VOTE":
    case "CIRCLE_REVEAL":
    case "ENDGAME_VOTE":
    case "ENDGAME_BANISH":
      body = !round ? view.phase === "CIRCLE_REVEAL" ? <NightStartControls game={game} /> : <Notice>Waiting…</Notice> : round.status === "open" ? <VotingControls game={game} round={round} /> : <RevealControls game={game} round={round} />;
      break;
    case "NIGHT":
      body = <NightControls game={game} />;
      break;
    case "MURDER_REVEAL":
      body = <BreakfastControls game={game} />;
      break;
    case "FINALE":
      body = <FinaleControls game={game} />;
      break;
  }
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <TimerControls game={game} />
        {body}
        {view.startingPlayerCount && view.phase !== "FINALE" ? <BlackmailCard game={game} /> : null}
        {view.startingPlayerCount && !(view.phase === "FINALE") ? <UndoButton game={game} /> : null}
      </div>
      <div className="flex flex-col gap-4">
        <BigScreenCard game={game} />
        <BotRunner game={game} />
        <RolesList game={game} />
      </div>
    </div>
  );
}

/** Owner, 2 November: the host chooses which nights are blackmail nights. Only the host and the Traitor know. */
function BlackmailCard({ game }: { game: GameHandle }) {
  const view = game.view!;
  const host = view.host!;
  const { busy, error, send } = useHostSend(game);
  const night = host.nights[host.nights.length - 1];
  const lone = view.players.filter((p) => p.status === "alive" && p.role === "traitor").length === 1;
  const tonight = view.phase === "NIGHT" && lone && !!night && !night.resolved;
  const offerOut = tonight && !!night.recruit;
  return (
    <Card>
      <Toggle
        label={tonight ? "Blackmail tonight" : "Blackmail night"}
        hint={
          offerOut
            ? "The offer is out, so this can't change now."
            : `${tonight ? "" : "Applies to the next night with one Traitor alive. "}The Traitor can't murder: they pick someone to join them, and if that player refuses or doesn't answer, they die.`
        }
        checked={tonight ? night.blackmail : host.blackmailNext}
        disabled={busy || offerOut}
        onChange={(on) => void send({ type: "setBlackmail", on })}
      />
      <ErrorLine message={error} />
    </Card>
  );
}

function OpenVoting({ game }: { game: GameHandle }) {
  const { busy, error, send } = useHostSend(game);
  return (
    <div className="flex flex-col gap-4">
      <Notice>Let the room debate. Voting opens by itself when the timer runs out.</Notice>
      <Button busy={busy} onClick={() => send({ type: "openVoting" })}>
        Open voting now
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}
