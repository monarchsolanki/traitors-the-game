"use client";

import { useState } from "react";
import Link from "next/link";
import { PHASE_TITLE } from "@/lib/client/labels";
import { useGame } from "@/lib/client/useGame";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { TopBar } from "@/components/ui/TopBar";
import { JoinScreen } from "./JoinScreen";
import {
  BreakfastScreen,
  DebateScreen,
  EndgameVoteScreen,
  FinaleScreen,
  GhostScreen,
  LobbyWait,
  MissionScreen,
  NightScreen,
  RevealScreen,
  RolesScreen,
  VoteScreen,
} from "./PhaseScreens";
import { RoleCard } from "./RoleCard";

export function PlayerApp({ code }: { code: string }) {
  const game = useGame(code.toUpperCase(), "player");
  const [roleOpen, setRoleOpen] = useState(false);
  const view = game.view;

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
  const title = !game.seated ? "Join the game" : PHASE_TITLE[view.phase];
  const subtitle = `Room ${view.code}${dealt && view.phase !== "FINALE" ? ` · Day ${view.day}` : ""}`;

  let body: React.ReactNode;
  if (!game.seated || !me) body = <JoinScreen game={game} code={view.code} />;
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
        {body}
      </main>
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
