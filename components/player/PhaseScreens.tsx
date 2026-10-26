"use client";

import { useState } from "react";
import { describeEvent } from "@/lib/client/feed";
import type { GameHandle } from "@/lib/client/useGame";
import type { RoundView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Card, Notice, Toggle } from "@/components/ui/Field";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Sheet } from "@/components/ui/Sheet";
import { RoleCard } from "./RoleCard";
import { ErrorLine, gridPlayers, playerById } from "./shared";

function useSend(game: GameHandle) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (action: Parameters<GameHandle["act"]>[0]) => {
    setBusy(true);
    setError(null);
    const r = await game.act(action);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Something went wrong.");
    return r.ok;
  };
  return { busy, error, send, setError };
}

function Heading({ title, help }: { title: string; help?: string }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-4xl font-semibold text-gold">{title}</h2>
      {help ? <p className="mt-1 text-base text-ink-muted">{help}</p> : null}
    </div>
  );
}

export function LobbyWait({ game }: { game: GameHandle }) {
  const view = game.view!;
  const me = playerById(view, view.me!.playerId)!;
  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <Avatar name={me.displayName} url={game.photoFor(me.photoPath)} size={112} />
      <h2 className="font-display text-3xl font-semibold text-gold">You&apos;re in, {me.displayName}</h2>
      <p className="text-ink-muted">
        {me.seatConfirmed ? "The host has confirmed your seat." : "Waiting for the host to confirm your seat."} Keep this page open;
        the game starts when the host deals the roles.
      </p>
      <p className="text-sm text-ink-muted">Not you? Ask the host to reset your seat.</p>
    </Card>
  );
}

export function RolesScreen({ game }: { game: GameHandle }) {
  return (
    <div className="flex flex-col gap-5">
      <Heading title="Your role" help="Keep it to yourself. Shield your screen." />
      <RoleCard game={game} />
      <Notice>You can peek again any time with the &ldquo;My role&rdquo; button at the top.</Notice>
    </div>
  );
}

export function MissionScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const mission = view.missions.find((m) => m.id === view.currentMissionId);
  const reward = view.me!.rewardVote;
  const { busy, error, send } = useSend(game);
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <Heading title={mission?.name ?? "Mission"} help={mission?.kind === "team" ? "A team game" : "An individual game"} />
      {mission?.winRule || mission?.tieRule ? (
        <Card className="flex flex-col gap-2">
          {mission.winRule ? <p><span className="text-ink-muted">To win: </span>{mission.winRule}</p> : null}
          {mission.tieRule ? <p><span className="text-ink-muted">If it&apos;s a tie: </span>{mission.tieRule}</p> : null}
        </Card>
      ) : null}
      {reward && !reward.submitted && reward.candidateIds.length ? (
        <Card className="flex flex-col gap-4">
          <p className="text-center text-lg">You won! Vote for who gets the {reward.itemType}. Only the winners see this.</p>
          <PlayerGrid
            players={gridPlayers(game, view.players.filter((p) => reward.candidateIds.includes(p.id) && p.id !== view.me!.playerId))}
            selectedId={pick}
            onSelect={setPick}
          />
          <ErrorLine message={error} />
          <Button disabled={!pick} busy={busy} onClick={() => pick && send({ type: "castRewardVote", targetId: pick })}>
            Vote
          </Button>
        </Card>
      ) : reward?.submitted ? (
        <Notice>Your reward vote is in.</Notice>
      ) : (
        <Notice>Play the mission in the room. The host hands out any rewards in private.</Notice>
      )}
    </div>
  );
}

export function DebateScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Heading title="Talk it out" help="Who do you trust? Voting opens soon." />
      <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} className="text-6xl" />
    </div>
  );
}

function VoteGrid({ game, ghost }: { game: GameHandle; ghost: boolean }) {
  const view = game.view!;
  const me = view.me!;
  const round = view.round!;
  const vote = me.vote!;
  const { busy, error, send } = useSend(game);
  const [target, setTarget] = useState<string | null>(null);
  const [dagger, setDagger] = useState(false);
  const candidates = view.players.filter((p) => round.candidateIds.includes(p.id) && p.id !== me.playerId && p.status === "alive");
  const t = playerById(view, target);
  return (
    <>
      <PlayerGrid players={gridPlayers(game, candidates)} selectedId={target} onSelect={(id) => setTarget(id)} />
      <Sheet open={!!t} onClose={() => setTarget(null)}>
        {t ? (
          <div className="flex flex-col items-center gap-4">
            <Avatar name={t.displayName} url={game.photoFor(t.photoPath)} size={112} />
            <h2 className="text-center font-display text-3xl font-semibold text-gold">Banish {t.displayName}?</h2>
            <p className="-mt-2 text-center text-ink-muted">
              {ghost ? "This uses your one ghost vote for the whole game." : "Your vote is final once you send it."}
            </p>
            {vote.canUseDagger ? (
              <div className="w-full rounded-2xl bg-surface-2 px-4">
                <Toggle
                  label={`Use your dagger (counts ×${view.settings.daggerWeight})`}
                  hint="One use only. Everyone sees it when the votes are revealed."
                  checked={dagger}
                  onChange={setDagger}
                />
              </div>
            ) : null}
            <ErrorLine message={error} />
            <Button
              variant="danger"
              busy={busy}
              onClick={async () => {
                if (await send({ type: "castVote", targetId: t.id, useDagger: dagger })) setTarget(null);
              }}
            >
              Vote to banish {t.displayName}
            </Button>
            <Button variant="quiet" size="md" onClick={() => setTarget(null)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function Ballots({ game, round }: { game: GameHandle; round: RoundView }) {
  const view = game.view!;
  const name = (id: string | null) => playerById(view, id)?.displayName ?? "";
  if (!round.ballots.length) {
    return <Notice>{round.status === "revealing" ? "The host is about to reveal the votes." : "No ballots were cast."}</Notice>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {round.ballots.map((b) => {
        const voter = playerById(view, b.voterId);
        return (
          <li key={b.voterId} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2">
            <Avatar name={voter?.displayName ?? "?"} url={game.photoFor(voter?.photoPath ?? null)} size={40} ghost={b.ghost} />
            <span className="flex-1 truncate">
              {voter?.displayName}
              <span className="text-ink-muted"> → </span>
              <span className="font-semibold text-gold">{b.choice ? (b.choice === "end" ? "End" : "Banish") : name(b.targetId)}</span>
            </span>
            {b.usedDagger ? <span className="rounded-full bg-kumkum px-2 py-0.5 text-sm font-semibold">×{b.weight}</span> : null}
            {b.ghost ? <span className="rounded-full bg-ghost/25 px-2 py-0.5 text-sm text-ghost">ghost</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function RoundOutcome({ game, round }: { game: GameHandle; round: RoundView }) {
  const view = game.view!;
  const r = round.result;
  if (!r) return null;
  const name = (id: string) => playerById(view, id)?.displayName ?? "";
  if (r.outcome === "banish") {
    const p = playerById(view, r.playerId);
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <Avatar name={p?.displayName ?? ""} url={game.photoFor(p?.photoPath ?? null)} size={96} ghost />
        <p className="font-display text-3xl text-gold">{p?.displayName} is banished</p>
        {r.via === "spin" ? <p className="text-ink-muted">Chosen by the spin.</p> : null}
        {p?.role ? <p className="text-ink">{p.role === "traitor" ? "They were a Traitor." : "They were Innocent."}</p> : null}
      </Card>
    );
  }
  if (r.outcome === "tie") {
    return (
      <Notice title="It's a tie">
        Between {r.tiedIds.map(name).join(" and ")}. {r.method === "revote" ? "A revote is next." : r.method === "spin" ? "A spin decides." : r.method === "choose" ? "The host chooses: a spin or another revote." : "The host decides."}
      </Notice>
    );
  }
  return null;
}

/** Circle vote, revote and End Game banishment. */
export function VoteScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const me = view.me!;
  const round = view.round;
  const vote = me.vote;
  if (!round) return <Notice>Waiting for the host.</Notice>;
  const revote = round.kind === "revote" || round.kind === "endgameRevote";
  if (round.status !== "open") return <RevealScreen game={game} />;
  if (vote?.submitted) {
    const t = playerById(view, vote.myBallot?.targetId);
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Heading title="Your vote is in" help={`You voted for ${t?.displayName ?? "…"}${vote.myBallot?.usedDagger ? " with your dagger" : ""}.`} />
        <p className="text-ink-muted">
          {round.submittedCount} of {round.eligibleCount} votes in
        </p>
      </div>
    );
  }
  if (!vote?.canVote) {
    return <Notice>{me.isGhost ? "Ghosts watch this vote." : "You can't vote in this round."}</Notice>;
  }
  return (
    <div className="flex flex-col gap-5">
      <Heading
        title={revote ? "Revote" : vote.asGhost ? "Your ghost vote" : "Who do you banish?"}
        help={
          vote.asGhost
            ? "You have one ghost vote for the whole game. Use it now, or save it for a later Circle."
            : revote
              ? "Only the tied players are on the ballot. No daggers."
              : "Tap a photo. You can't change your vote after sending it."
        }
      />
      <VoteGrid game={game} ghost={vote.asGhost} />
    </div>
  );
}

export function RevealScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const round = view.round ?? view.pastRounds[view.pastRounds.length - 1];
  if (!round) return <Notice>Waiting for the host.</Notice>;
  return (
    <div className="flex flex-col gap-5">
      <Heading title="The votes" help={round.status === "revealing" ? `${round.revealedCount} of ${round.ballotCount} shown` : undefined} />
      <Ballots game={game} round={round} />
      <RoundOutcome game={game} round={round} />
    </div>
  );
}

function ChatSheet({ game, open, onClose }: { game: GameHandle; open: boolean; onClose: () => void }) {
  const view = game.view!;
  const [text, setText] = useState("");
  const { busy, error, send } = useSend(game);
  const chat = view.traitor?.chat ?? [];
  return (
    <Sheet open={open} onClose={onClose} title="Traitors only">
      <div className="flex flex-col gap-3">
        <ul className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
          {chat.length === 0 ? <li className="text-center text-ink-muted">No messages yet.</li> : null}
          {chat.map((c) => {
            const mine = c.authorId === view.me!.playerId;
            return (
              <li key={c.id} className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "self-end bg-kumkum/30" : "self-start bg-surface-2"}`}>
                <span className="block text-xs text-ink-muted">{mine ? "You" : playerById(view, c.authorId)?.displayName}</span>
                {c.text}
              </li>
            );
          })}
        </ul>
        <ErrorLine message={error} />
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (text.trim() && (await send({ type: "sendChat", text }))) setText("");
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Message your fellow Traitors"
            className="min-h-12 flex-1 rounded-xl border border-gold/25 bg-night px-4 text-base text-ink focus:border-gold focus:outline-none"
          />
          <Button size="md" type="submit" busy={busy}>
            Send
          </Button>
        </form>
      </div>
    </Sheet>
  );
}

/** Night looks the same for everyone at a glance: one title, one grid of photos. */
export function NightScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const me = view.me!;
  const tv = view.traitor;
  const { busy, error, send } = useSend(game);
  const [chatOpen, setChatOpen] = useState(false);
  const [recruitMode, setRecruitMode] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const others = view.players.filter((p) => p.status === "alive" && p.id !== me.playerId);

  if (me.recruitOffer) {
    return (
      <div className="flex flex-col gap-5">
        <Heading title="Night falls" />
        <Card className="flex flex-col items-center gap-4 text-center">
          <p className="font-display text-3xl text-kumkum">The Traitors want you</p>
          <p className="text-ink">Join them and become a Traitor, or refuse. If you refuse, nobody dies tonight.</p>
          <Countdown deadline={me.recruitOffer.deadline} pausedRemainingMs={null} now={game.now} className="text-3xl" />
          <ErrorLine message={error} />
          <Button variant="danger" busy={busy} onClick={() => send({ type: "answerRecruit", accept: true })}>
            Join the Traitors
          </Button>
          <Button variant="secondary" busy={busy} onClick={() => send({ type: "answerRecruit", accept: false })}>
            Refuse
          </Button>
        </Card>
      </div>
    );
  }

  if (tv?.night) {
    const night = tv.night;
    if (night.offer) {
      const target = playerById(view, night.offer.targetId);
      return (
        <div className="flex flex-col gap-5">
          <Heading title="Night falls" help={`Your offer went to ${target?.displayName}. Waiting for an answer.`} />
          <Countdown deadline={night.offer.deadline} pausedRemainingMs={null} now={game.now} className="mx-auto text-4xl" />
        </div>
      );
    }
    const pool = others.filter((p) => (recruitMode ? !(tv.fellowTraitorIds.includes(p.id)) : view.settings.allowTraitorOnTraitor || !tv.fellowTraitorIds.includes(p.id)));
    const statuses = Object.values(night.pickStatus);
    const confirm = playerById(view, confirmId);
    return (
      <div className="flex flex-col gap-5">
        <Heading title="Night falls" help="Tap a player. Only you see your choice." />
        <PlayerGrid
          players={gridPlayers(game, pool, (p) => ({
            badge: tv.fellowTraitorIds.includes(p.id) ? <span className="block size-3 rounded-full bg-kumkum ring-2 ring-night" aria-label="fellow" /> : undefined,
          }))}
          selectedId={recruitMode ? null : night.myPickId}
          onSelect={setConfirmId}
        />
        {statuses.length > 1 ? (
          <p className="text-center text-sm text-ink-muted">
            {statuses.filter(Boolean).length} of {statuses.length} picks in
          </p>
        ) : null}
        <div className="flex gap-2">
          {view.settings.traitorChat ? (
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setChatOpen(true)}>
              Chat ({tv.chat?.length ?? 0})
            </Button>
          ) : null}
          {night.recruitmentAvailable ? (
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setRecruitMode((r) => !r)}>
              {recruitMode ? "Murder instead" : "Recruit instead"}
            </Button>
          ) : null}
        </div>
        <ErrorLine message={error} />
        <ChatSheet game={game} open={chatOpen} onClose={() => setChatOpen(false)} />
        <Sheet open={!!confirm} onClose={() => setConfirmId(null)}>
          {confirm ? (
            <div className="flex flex-col items-center gap-4">
              <Avatar name={confirm.displayName} url={game.photoFor(confirm.photoPath)} size={112} />
              <h2 className="text-center font-display text-3xl font-semibold text-kumkum">
                {recruitMode ? `Recruit ${confirm.displayName}?` : `Pick ${confirm.displayName}?`}
              </h2>
              <p className="-mt-2 text-center text-ink-muted">
                {recruitMode
                  ? "They get a private offer. If they refuse or don't answer, nobody dies."
                  : "You can change your pick until every Traitor has picked."}
              </p>
              <Button
                variant="danger"
                busy={busy}
                onClick={async () => {
                  if (await send({ type: "nightPick", targetId: confirm.id, mode: recruitMode ? "recruit" : "murder" })) setConfirmId(null);
                }}
              >
                {recruitMode ? "Send the offer" : "Pick"}
              </Button>
              <Button variant="quiet" size="md" onClick={() => setConfirmId(null)}>
                Cancel
              </Button>
            </div>
          ) : null}
        </Sheet>
      </div>
    );
  }

  if (me.suspectPoll) {
    return (
      <div className="flex flex-col gap-5">
        <Heading title="Night falls" help="Tap a player. Only you see your choice." />
        <PlayerGrid
          players={gridPlayers(game, others)}
          selectedId={me.suspectPoll.myAnswer}
          onSelect={(id) => void send({ type: "suspectAnswer", targetId: id })}
        />
        <ErrorLine message={error} />
        <p className="text-center text-sm text-ink-muted">Who do you suspect? Answers stay secret until the final reveal.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Heading title="Night falls" help="Close your eyes. The Traitors are choosing." />
    </div>
  );
}

export function BreakfastScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const night = view.night;
  if (!night?.revealed) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Heading title="Breakfast" help="Everyone to the table. The host will reveal what happened in the night." />
      </div>
    );
  }
  const victim = playerById(view, night.victimId);
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {victim ? (
        <>
          <Avatar name={victim.displayName} url={game.photoFor(victim.photoPath)} size={128} ghost />
          <Heading title={`${victim.displayName} was murdered`} help="They are now a ghost." />
        </>
      ) : (
        <Heading title="Nobody died last night" />
      )}
    </div>
  );
}

export function EndgameVoteScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const round = view.round;
  const vote = view.me!.vote;
  const { busy, error, send } = useSend(game);
  const [choice, setChoice] = useState<"end" | "banish" | null>(null);
  if (!round) return <Notice>Waiting for the host.</Notice>;
  if (round.status !== "open") return <RevealScreen game={game} />;
  if (vote?.submitted) {
    return <Heading title="Your vote is in" help={`You voted ${vote.myBallot?.choice === "end" ? "End" : "Banish"}.`} />;
  }
  if (!vote?.canVote) return <Notice>Ghosts watch the End Game.</Notice>;
  return (
    <div className="flex flex-col gap-5">
      <Heading
        title="End or Banish?"
        help="Everyone must vote End to finish the game. Any Banish vote means one more banishment."
      />
      <Button onClick={() => setChoice("end")}>End the game</Button>
      <Button variant="danger" onClick={() => setChoice("banish")}>
        Banish one more
      </Button>
      <Sheet open={!!choice} onClose={() => setChoice(null)} title={choice === "end" ? "Vote End?" : "Vote Banish?"}>
        <div className="flex flex-col gap-3">
          <p className="text-center text-ink-muted">Your vote is final once you send it.</p>
          <ErrorLine message={error} />
          <Button
            busy={busy}
            variant={choice === "end" ? "primary" : "danger"}
            onClick={async () => {
              if (choice && (await send({ type: "castEndgameVote", choice }))) setChoice(null);
            }}
          >
            Send my vote
          </Button>
          <Button variant="quiet" size="md" onClick={() => setChoice(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export function FinaleScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const f = view.finale;
  if (!f) return null;
  const iWon = !!view.me && f.winnerIds.includes(view.me.playerId);
  const suspects = Object.entries(f.suspicion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-sm tracking-[0.3em] text-ink-muted uppercase">The final reveal</p>
        <h2 className={`font-display text-5xl font-semibold ${f.winner === "traitors" ? "text-kumkum" : "text-gold"}`}>
          {f.winner === "traitors" ? "The Traitors win" : "The Innocents win"}
        </h2>
        {view.me ? <p className="mt-2 text-xl">{iWon ? "You win!" : "Better luck next time."}</p> : null}
      </div>
      <Card>
        <ul className="grid grid-cols-2 gap-3">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={40} ghost={p.status !== "alive"} />
              <span className="min-w-0">
                <span className="block truncate">{p.displayName}</span>
                <span className={`text-sm ${p.role === "traitor" ? "text-kumkum" : "text-ink-muted"}`}>
                  {p.role === "traitor" ? "Traitor" : "Innocent"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {suspects.length ? (
        <Card>
          <p className="mb-2 font-semibold text-gold">Most suspected at night</p>
          <ol className="flex flex-col gap-1">
            {suspects.map(([id, n]) => (
              <li key={id}>
                {playerById(view, id)?.displayName}: {n} {n === 1 ? "vote" : "votes"}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}

export function GhostScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const me = view.me!;
  const canGhostVote = view.phase === "CIRCLE_VOTE" && !!me.vote?.canVote && me.vote.asGhost;
  const feed = view.events
    .map((e) => ({ id: e.id, text: describeEvent(e, view) }))
    .filter((e): e is { id: string; text: string } => !!e.text)
    .reverse()
    .slice(0, 30);
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="font-display text-4xl font-semibold text-ghost">You&apos;re a ghost</p>
        <p className="mt-1 text-ink-muted">
          Stay close and watch. Don&apos;t talk about the game with living players.
          {view.settings.ghostVote && !me.ghostVote.used ? " You still have your one ghost vote." : ""}
        </p>
      </div>
      {canGhostVote ? <VoteScreen game={game} /> : null}
      {view.phase === "CIRCLE_REVEAL" ? <RevealScreen game={game} /> : null}
      <Card>
        <p className="mb-2 font-semibold text-gold">What&apos;s happening</p>
        <ul className="flex flex-col gap-2 text-base">
          {feed.map((e) => (
            <li key={e.id} className="text-ink">
              {e.text}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
