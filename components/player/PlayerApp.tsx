"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PHASE_TITLE } from "@/lib/client/labels";
import { useGame } from "@/lib/client/useGame";
import { useTicker } from "@/lib/client/useTicker";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { TopBar } from "@/components/ui/TopBar";
import { CircleCall } from "./CircleCall";
import { JoinScreen } from "./JoinScreen";
import {
  BreakfastScreen,
  DebateScreen,
  EndgameVoteScreen,
  EntranceHold,
  entranceLeft,
  FinaleScreen,
  GhostScreen,
  LobbyWait,
  MissionScreen,
  NightScreen,
  PrivateTalksScreen,
  RevealScreen,
  RolesScreen,
  VoteScreen,
} from "./PhaseScreens";
import { RoleCard } from "./RoleCard";
import { playerById } from "./shared";

/**
 * Owner, 1 November: the last Traitor hears how each recruit offer went. A refusal sends them back to
 * pick again; an acceptance shows at breakfast. Android phones also buzz (iPhones can't from a website).
 */
function OfferNews({ game }: { game: ReturnType<typeof useGame> }) {
  const view = game.view!;
  const answers = view.traitor?.offerAnswers ?? [];
  const last = answers[answers.length - 1];
  const key = last ? `${answers.length}:${last.playerId}:${last.answer}` : "";
  const seen = useRef(key);
  useEffect(() => {
    if (key && key !== seen.current) {
      try {
        navigator.vibrate?.([300, 150, 300]);
      } catch {
        // Not supported (iPhone): the card does the job.
      }
    }
    seen.current = key;
  }, [key]);
  if (!last) return null;
  const name = playerById(view, last.playerId)?.displayName ?? "Your recruit";
  if (last.answer === "accepted") {
    return (
      <div className="mb-4">
        <Notice title="Recruitment done">{name} said yes and is now a Traitor with you.</Notice>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <Notice title={last.answer === "refused" ? `${name} said no` : `${name} didn't answer in time`}>
        {view.traitor?.night?.recruitmentAvailable ? "Pick again: murder someone, or send an offer to someone else." : "Pick someone to murder."}
      </Notice>
    </div>
  );
}

/** A banishment moves the game straight on, so phones say who went for a minute afterwards. */
function RecentNews({ game }: { game: ReturnType<typeof useGame> }) {
  const view = game.view!;
  const e = [...view.events].reverse().find((x) => x.type === "banished" || x.type === "noBanishment");
  if (!e || game.now() - e.at > 60_000 || view.phase === "CIRCLE_REVEAL" || view.phase === "FINALE") return null;
  if (e.type === "noBanishment") {
    return (
      <div className="mb-4">
        <Notice title="Nobody was banished">The host let the tie stand.</Notice>
      </div>
    );
  }
  const p = playerById(view, e.data.playerId as string);
  if (!p) return null;
  return (
    <div className="mb-4">
      <Notice title={`${p.displayName} was banished`}>
        {e.data.role ? (e.data.role === "traitor" ? "They were a Traitor." : "They were Innocent.") : "Their role stays secret until the final reveal."}
      </Notice>
    </div>
  );
}

function HoldOn() {
  return (
    <div className="flex flex-col items-center gap-3 pt-10 text-center">
      <p className="font-display text-4xl font-semibold text-gold">Hold on</p>
      <p className="text-lg text-ink-muted">The host will tell you what happens next.</p>
    </div>
  );
}

export function PlayerApp({ code }: { code: string }) {
  const game = useGame(code.toUpperCase(), "player");
  const [roleOpen, setRoleOpen] = useState(false);
  const view = game.view;
  useTicker(500, view?.phase === "MURDER_REVEAL");

  if (game.notFound) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-4xl text-gold">No game called {code.toUpperCase()}</p>
        <p className="text-ink-muted">Check the room code with the host.</p>
        <Link href="/" className="text-gold underline">
          Back
        </Link>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-ink-muted">
        {game.error ?? "Opening the game…"}
      </main>
    );
  }

  const me = view.me;
  const dealt = view.startingPlayerCount !== null;
  const title = !game.seated ? "Join the game" : view.finalePending ? "Hold on" : PHASE_TITLE[view.phase];
  const subtitle = `Room ${view.code}${dealt && view.phase !== "FINALE" ? ` · Day ${view.day}` : ""}`;

  let body: React.ReactNode;
  if (!game.seated || !me) body = <JoinScreen game={game} code={view.code} />;
  else if (view.finalePending) body = <HoldOn />;
  else if (entranceLeft(game) > 0) body = <EntranceHold game={game} />;
  else if (view.phase === "FINALE") body = <FinaleScreen game={game} />;
  else if (me.isGhost) body = <GhostScreen game={game} />;
  else {
    switch (view.phase) {
      case "LOBBY":
        body = <LobbyWait game={game} />;
        break;
      case "ROLES":
        body = <RolesScreen game={game} />;
        break;
      case "MISSION":
        body = <MissionScreen game={game} />;
        break;
      case "PRIVATE_TALKS":
        body = <PrivateTalksScreen game={game} />;
        break;
      case "CIRCLE_DEBATE":
        body = <DebateScreen game={game} />;
        break;
      case "CIRCLE_VOTE":
      case "ENDGAME_BANISH":
        body = <VoteScreen game={game} />;
        break;
      case "CIRCLE_REVEAL":
        body = <RevealScreen game={game} />;
        break;
      case "NIGHT":
        body = <NightScreen game={game} />;
        break;
      case "MURDER_REVEAL":
        body = <BreakfastScreen game={game} />;
        break;
      case "ENDGAME_VOTE":
        body = <EndgameVoteScreen game={game} />;
        break;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={title}
        subtitle={subtitle}
        deadline={view.deadline}
        pausedRemainingMs={view.pausedRemainingMs}
        paused={view.paused}
        now={game.now}
        connection={game.connection}
        right={
          game.seated && me && dealt && view.phase !== "ROLES" ? (
            <Button variant="secondary" size="sm" onClick={() => setRoleOpen(true)}>
              My role
            </Button>
          ) : null
        }
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {view.paused ? (
          <div className="mb-4">
            <Notice title="The game is paused">Hang tight; the host will resume it.</Notice>
          </div>
        ) : null}
        {game.seated ? <RecentNews game={game} /> : null}
        {game.seated && !view.paused ? <OfferNews game={game} /> : null}
        {game.seated && me?.isCohost && view.phase !== "FINALE" ? (
          <Link href={`/cohost/${view.code}`} className="mb-4 block rounded-2xl bg-gold/10 px-4 py-3 text-center text-gold ring-1 ring-gold/30">
            You&apos;re the co-host · open the co-host controls
          </Link>
        ) : null}
        {body}
      </main>
      {game.seated && me && dealt ? <CircleCall game={game} /> : null}
      {me && dealt ? (
        <Sheet open={roleOpen} onClose={() => setRoleOpen(false)}>
          <RoleCard game={game} />
          <Button variant="quiet" size="md" className="mt-3 w-full" onClick={() => setRoleOpen(false)}>
            Close
          </Button>
        </Sheet>
      ) : null}
    </div>
  );
}
