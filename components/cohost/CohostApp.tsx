"use client";

import { useState } from "react";
import Link from "next/link";
import { PHASE_TITLE } from "@/lib/client/labels";
import { useGame, type GameHandle } from "@/lib/client/useGame";
import type { ItemType } from "@/lib/game/types";
import { Button } from "@/components/ui/Button";
import { Card, Notice, Segmented } from "@/components/ui/Field";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { TopBar } from "@/components/ui/TopBar";
import { ErrorLine, gridPlayers, playerById } from "@/components/player/shared";
import { useHostSend } from "@/components/host/GameControls";
import { MissionPicker, ScreenMessageCard } from "@/components/host/MissionCatalogue";

/** Mission winners and rewards, from the co-host's phone. Who holds what stays private, so it isn't shown. */
function MissionPanel({ game }: { game: GameHandle }) {
  const view = game.view!;
  const co = view.cohost!;
  const mission = view.missions.find((m) => m.id === view.currentMissionId);
  const { busy, error, send, setError } = useHostSend(game);
  const [itemType, setItemType] = useState<ItemType>("shield");
  const [voteMode, setVoteMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const alive = view.players.filter((p) => p.status === "alive");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const reward = co.rewardVote;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-display text-2xl text-gold">{mission?.name}</p>
        <p className="text-ink-muted">{mission?.kind === "team" ? "Team game" : "Individual game"}</p>
        {mission?.howItWorks ? <p className="mt-2 text-ink-muted">{mission.howItWorks}</p> : null}
        {mission?.winRule ? <p className="mt-2">To win: {mission.winRule}</p> : null}
        {mission?.tieRule ? <p>Tie: {mission.tieRule}</p> : null}
      </Card>
      {reward ? (
        <Card className="flex flex-col gap-3">
          <p className="font-semibold text-gold">Winners are voting for the {reward.itemType}</p>
          <p className="text-ink-muted">
            {reward.votedIds.length} of {reward.voterIds.length} voted. Waiting on:{" "}
            {reward.voterIds
              .filter((id) => !reward.votedIds.includes(id))
              .map((id) => playerById(view, id)?.displayName)
              .join(", ") || "nobody"}
          </p>
          <Button busy={busy} onClick={() => send({ type: "lockRewardVote" })}>
            Close the vote now
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <p className="font-semibold text-gold">Reward the winners (private)</p>
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
            {voteMode ? "Tap every winner. They vote in private for who gets it." : `Tap who gets a ${itemType}. Nobody can hold two; the app will say if someone can't take it.`}
          </p>
          <PlayerGrid players={gridPlayers(game, alive)} selectedIds={selected} onSelect={toggle} size={56} />
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
      <Button variant="secondary" disabled={!!reward} onClick={() => setPickerOpen(true)}>
        Another mission
      </Button>
      <Notice>When the missions are done, the host opens the Circle.</Notice>
      <MissionPicker game={game} catalogue={co.catalogue} open={pickerOpen} onClose={() => setPickerOpen(false)} send={(a) => send(a)} busy={busy} error={error} />
    </div>
  );
}

function StartMission({ game }: { game: GameHandle }) {
  const { busy, error, send } = useHostSend(game);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Notice>The host decides whether there&apos;s a mission now. When they say go, pick it here.</Notice>
      <Button onClick={() => setOpen(true)}>Run a mission</Button>
      <ErrorLine message={error} />
      <MissionPicker game={game} catalogue={game.view!.cohost!.catalogue} open={open} onClose={() => setOpen(false)} send={(a) => send(a)} busy={busy} error={error} />
    </div>
  );
}

function RevealPanel({ game }: { game: GameHandle }) {
  const round = game.view!.round!;
  const { busy, error, send } = useHostSend(game);
  const left = (round.ballotCount ?? 0) - round.revealedCount;
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold text-gold">The reveal</p>
      <p className="text-ink-muted">
        {round.revealedCount} of {round.ballotCount ?? 0} votes shown on the big screen.
      </p>
      <ErrorLine message={error} />
      <Button disabled={left <= 0} busy={busy} onClick={() => send({ type: "revealNextBallot" }, true)}>
        Reveal the next vote
      </Button>
      {left <= 0 ? <Notice>Every vote is shown. The host finishes the reveal.</Notice> : null}
    </Card>
  );
}

export function CohostApp({ code }: { code: string }) {
  const upper = code.toUpperCase();
  const game = useGame(upper, "cohost");
  const view = game.view;
  const { busy, error, send } = useHostSend(game);
  if (!view?.cohost) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-4xl text-gold">Co-host</p>
        <p className="text-ink-muted">{game.notFound ? `No game called ${upper}.` : game.error ?? "Opening the co-host controls…"}</p>
        <Link href={`/play/${upper}`} className="text-gold underline">
          Back to my player screen
        </Link>
      </main>
    );
  }
  const revealing = view.round?.status === "revealing";
  const choicePoint = view.phase === "ROLES" || (view.phase === "MURDER_REVEAL" && view.night?.revealed);
  let body: React.ReactNode = <Notice>Waiting for the host. Nothing for you to do in this part.</Notice>;
  if (view.phase === "MISSION") body = <MissionPanel game={game} />;
  else if (choicePoint) body = <StartMission game={game} />;
  else if (revealing) body = <RevealPanel game={game} />;
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={`Co-host · ${view.finalePending ? "Hold on" : PHASE_TITLE[view.phase]}`}
        subtitle={`Room ${view.code}${view.startingPlayerCount && view.phase !== "FINALE" ? ` · Day ${view.day}` : ""}`}
        deadline={view.deadline}
        pausedRemainingMs={view.pausedRemainingMs}
        paused={view.paused}
        now={game.now}
        connection={game.connection}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {body}
        {!view.closed ? (
          <Card>
            <ScreenMessageCard game={game} send={(a) => send(a)} busy={busy} error={error} />
          </Card>
        ) : null}
        <Link href={`/play/${view.code}`} className="text-center text-gold underline underline-offset-4">
          Back to my player screen
        </Link>
      </main>
    </div>
  );
}
