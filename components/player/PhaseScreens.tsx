"use client";

import { useEffect, useState } from "react";
import { describeEvent } from "@/lib/client/feed";
import type { GameHandle } from "@/lib/client/useGame";
import type { PlayerView, RoundView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Card, Notice, Segmented, Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Sheet } from "@/components/ui/Sheet";
import { HoldToReveal } from "@/components/ui/HoldToReveal";
import { GhostGames } from "./GhostGames";
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

/** One thing on an empty ground, for the screens where the phone has nothing to ask. */
function Still({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center">{children}</div>;
}

function Heading({ title, help }: { title: string; help?: string }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-[2.6rem] leading-[1.05] text-balance">{title}</h2>
      <div className="speed-lines mx-auto my-3 w-16" aria-hidden />
      {help ? <p className="mx-auto max-w-[34ch] text-lg leading-snug text-ink-muted">{help}</p> : null}
    </div>
  );
}

export function LobbyWait({ game }: { game: GameHandle }) {
  const view = game.view!;
  const me = playerById(view, view.me!.playerId)!;
  return (
    <Still>
      <Avatar name={me.displayName} url={game.photoFor(me.photoPath)} size={176} tall />
      <h2 className="font-display text-[2.6rem] leading-[1.05] text-balance">You&apos;re in, {me.displayName}</h2>
      <div className="speed-lines -my-3 w-16" aria-hidden />
      <p className="text-lg leading-snug text-ink-muted">
        {me.seatConfirmed ? "The host has confirmed your seat." : "Waiting for the host to confirm your seat."} Keep this page open;
        the game starts when the host deals the roles.
      </p>
      <p className="text-lg text-ink-muted">Not you? Ask the host to reset your seat.</p>
    </Still>
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

/** A private vote for who gets a mission's ability: mission winners, or the ghosts after a ghost challenge. */
export function RewardVoteCard({ game }: { game: GameHandle }) {
  const view = game.view!;
  const reward = view.me!.rewardVote;
  const { busy, error, send } = useSend(game);
  const [pick, setPick] = useState<string | null>(null);
  if (!reward) return null;
  if (reward.submitted) return <Notice>Your vote is in. Only the person who gets it will know.</Notice>;
  if (!reward.candidateIds.length) return null;
  const ghost = view.me!.isGhost;
  return (
    <Card className="flex flex-col gap-4">
      <p className="text-center text-lg">
        {ghost
          ? `The ghosts won! Vote for the living player who gets the ${reward.itemType}. Only the ghosts see this.`
          : `You won! Vote for who gets the ${reward.itemType}. Only the winners see this.`}
      </p>
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
  );
}

export function MissionScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const mission = view.missions.find((m) => m.id === view.currentMissionId);
  const reward = view.me!.rewardVote;
  return (
    <div className="flex flex-col gap-5">
      <Heading
        title={mission?.name ?? "Mission"}
        help={mission?.kind === "ghost" ? "A ghost challenge: if the ghosts win, they give a shield or dagger to a living player." : mission?.kind === "team" ? "A team game" : "An individual game"}
      />
      {mission?.winRule || mission?.tieRule ? (
        <Card className="flex flex-col gap-2">
          {mission.winRule ? <p><span className="text-ink-muted">To win: </span>{mission.winRule}</p> : null}
          {mission.tieRule ? <p><span className="text-ink-muted">If it&apos;s a tie: </span>{mission.tieRule}</p> : null}
        </Card>
      ) : null}
      {reward ? (
        <RewardVoteCard game={game} />
      ) : (
        <Notice>{mission?.kind === "ghost" ? "The ghosts are playing. Watch, or get a drink." : "Play the mission in the room. The host hands out any rewards in private."}</Notice>
      )}
    </div>
  );
}

/** Owner, 30 October: before each Circle, players split into small groups and talk in private. */
export function PrivateTalksScreen({ game }: { game: GameHandle }) {
  return (
    <Still>
      <Heading title="Private talks" help="Find someone and talk in private. Make allies, test suspicions, plant doubts." />
      <Countdown deadline={game.view!.deadline} pausedRemainingMs={game.view!.pausedRemainingMs} now={game.now} className="text-[5rem]" />
      <Notice>When the timer ends or the host calls time, your phone alerts and everyone comes back for the Circle of Shaq.</Notice>
    </Still>
  );
}

export function DebateScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  return (
    <Still>
      <Heading title="Talk it out" help="Who do you trust? Voting opens soon." />
      <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} className="text-[5rem]" />
    </Still>
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
            <Avatar name={t.displayName} url={game.photoFor(t.photoPath)} size={132} tall />
            <h2 className="text-center font-display text-3xl leading-tight">Banish {t.displayName}?</h2>
            <p className="-mt-2 text-center text-ink-muted">
              {ghost ? "This uses your one ghost vote for the whole game." : "Your vote is final once you send it."}
            </p>
            {vote.canUseDagger ? (
              <div className="step w-full bg-surface-2 px-4">
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
    <ul className="flex flex-col divide-y divide-line/25">
      {round.ballots.map((b, i) => {
        const voter = playerById(view, b.voterId);
        return (
          <li key={b.voterId} className={`flex items-center gap-3 py-2 ${i === round.ballots.length - 1 ? "animate-settle" : ""}`}>
            <Avatar name={voter?.displayName ?? "?"} url={game.photoFor(voter?.photoPath ?? null)} size={44} ghost={b.ghost} />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">{voter?.displayName}</span>
              <Icon name="arrow" className="size-4 shrink-0 text-ink-muted" />
              <span className="sr-only">voted for</span>
              <span className="truncate font-semibold text-accent">{b.choice ? (b.choice === "end" ? "End" : "Banish") : name(b.targetId)}</span>
            </span>
            {b.usedDagger ? <span className="step bg-danger px-2 py-0.5 text-lg font-semibold text-on-danger [--s:2px]">×{b.weight}</span> : null}
            {b.ghost ? <span className="text-lg text-ghost">ghost</span> : null}
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
        <Avatar name={p?.displayName ?? ""} url={game.photoFor(p?.photoPath ?? null)} size={112} tall ghost />
        <p className="font-display text-3xl leading-tight">{p?.displayName} is banished</p>
        {r.via === "spin" ? <p className="text-ink-muted">Chosen by the spin.</p> : null}
        {p?.role ? <p className="text-ink">{p.role === "traitor" ? "They were a Traitor." : "They were Innocent."}</p> : null}
      </Card>
    );
  }
  if (r.outcome === "nobody") {
    return <Notice title="Nobody is banished">The tie between {r.tiedIds.map(name).join(" and ")} stands. Night falls.</Notice>;
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
      <Still>
        <Heading title="Your vote is in" help={`You voted for ${t?.displayName ?? "…"}${vote.myBallot?.usedDagger ? " with your dagger" : ""}.`} />
        <p className="font-display text-3xl text-accent">
          {round.submittedCount} of {round.eligibleCount} votes in
        </p>
      </Still>
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
            ? "You have one ghost vote for the whole game. Use it now, or save it for a later vote."
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
              <li key={c.id} className={`step max-w-[85%] px-3 py-2 [--s:3px] ${mine ? "self-end bg-danger text-on-danger" : "self-start bg-surface-2"}`}>
                <span className={`block text-lg ${mine ? "" : "text-ink-muted"}`}>{mine ? "You" : playerById(view, c.authorId)?.displayName}</span>
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
            className="min-h-12 min-w-0 flex-1 border border-line/40 bg-ground px-4 text-lg text-ink placeholder:text-ink-muted/90 focus:border-accent focus:outline-none"
          />
          <Button size="md" type="submit" busy={busy}>
            Send
          </Button>
        </form>
      </div>
    </Sheet>
  );
}

function SuspectPoll({ game, others }: { game: GameHandle; others: PlayerView[] }) {
  const { error, send } = useSend(game);
  return (
    <>
      <PlayerGrid
        players={gridPlayers(game, others)}
        selectedId={game.view!.me!.suspectPoll!.myAnswer}
        onSelect={(id) => void send({ type: "suspectAnswer", targetId: id })}
      />
      <ErrorLine message={error} />
      <p className="text-center text-lg text-ink-muted">Who do you suspect? Answers stay secret until the final reveal.</p>
    </>
  );
}

/**
 * Owner, 4 November: an offer is a secret like a role. It stays behind the doors, the answer buttons wait for
 * the first peek and use neutral words, each answer asks once, and the poll stays below so the phone still
 * looks like the others.
 */
function RecruitOffer({ game, offer, children }: { game: GameHandle; offer: { deadline: number; blackmail: boolean }; children: React.ReactNode }) {
  const me = game.view!.me!;
  const { busy, error, send } = useSend(game);
  const [peeked, setPeeked] = useState(false);
  const [answering, setAnswering] = useState<"join" | "refuse" | null>(null);
  const { blackmail, deadline } = offer;
  const shielded = me.items.some((i) => i.type === "shield" && i.state === "held");
  // The doors sit above the poll, so an offer that lands mid-scroll would otherwise go unseen.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const refuseTitle = blackmail && !shielded ? "Refuse and die?" : "Refuse?";
  const refuseBody = !blackmail ? "They can't ask you again tonight." : shielded ? "Only your shield can save you now." : "You die tonight. This can't be undone.";
  return (
    <div className="flex flex-col gap-5">
      <Heading title="Night falls" help={children ? "Tap a player. Only you see your choice." : undefined} />
      <HoldToReveal compact label="You have a private message. Hold to read it." onReveal={() => setPeeked(true)}>
        <span className="flex flex-col items-center gap-3">
          <span className="font-display text-3xl leading-tight text-danger-bright">{blackmail ? "Join the Traitors or die" : "The Traitors want you"}</span>
          <span className="text-lg leading-snug text-ink">
            {!blackmail
              ? "Join them and become a Traitor, or refuse. Nobody else sees your answer."
              : shielded
                ? "The Traitors have chosen you. Join them, or refuse and trust your shield. No answer counts as refusing."
                : "The Traitors have chosen you. Join them, or refuse and die tonight. No answer counts as refusing."}
          </span>
          <Countdown deadline={deadline} pausedRemainingMs={null} now={game.now} className="text-3xl" />
        </span>
      </HoldToReveal>
      {peeked ? (
        <div className="flex gap-2">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => setAnswering("join")}>
            Yes, join
          </Button>
          <Button variant="secondary" size="md" className="flex-1" onClick={() => setAnswering("refuse")}>
            No, refuse
          </Button>
        </div>
      ) : null}
      {children}
      <Sheet open={!!answering} onClose={() => setAnswering(null)} title={answering === "join" ? "Join the Traitors?" : refuseTitle}>
        <div className="flex flex-col gap-3">
          <p className="text-center text-ink-muted">{answering === "join" ? "You become a Traitor. This can't be undone." : refuseBody}</p>
          <ErrorLine message={error} />
          <Button variant="danger" busy={busy} onClick={() => send({ type: "answerRecruit", accept: answering === "join" })}>
            {answering === "join" ? "Yes, join" : "Yes, refuse"}
          </Button>
          <Button variant="quiet" size="md" onClick={() => setAnswering(null)}>
            Go back
          </Button>
        </div>
      </Sheet>
    </div>
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

  const poll = me.suspectPoll ? <SuspectPoll game={game} others={others} /> : null;

  if (me.recruitOffer) return <RecruitOffer game={game} offer={me.recruitOffer}>{poll}</RecruitOffer>;

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
    // An offer that was turned down can't go to the same player again tonight.
    const recruiting = night.blackmail || (recruitMode && night.recruitmentAvailable);
    const turnedDown = new Set(tv.offerAnswers.map((x) => x.playerId));
    const pool = others.filter((p) =>
      recruiting ? !tv.fellowTraitorIds.includes(p.id) && !turnedDown.has(p.id) : view.settings.allowTraitorOnTraitor || !tv.fellowTraitorIds.includes(p.id),
    );
    const statuses = Object.values(night.pickStatus);
    const confirm = playerById(view, confirmId);
    return (
      <div className="flex flex-col gap-5">
        <Heading
          title="Night falls"
          help={night.blackmail ? "Blackmail night. Choose who joins you. If they refuse or don't answer, they die." : "Tap a player. Only you see your choice."}
        />
        <PlayerGrid
          players={gridPlayers(game, pool, (p) => ({
            badge: tv.fellowTraitorIds.includes(p.id) ? <span className="block size-3 rounded-full bg-danger ring-2 ring-ground" aria-label="fellow" /> : undefined,
          }))}
          selectedId={recruiting ? null : night.myPickId}
          onSelect={setConfirmId}
        />
        <p className="flex items-center justify-center gap-3 text-lg text-ink-muted">
          {statuses.length > 1 ? (
            <span>
              {statuses.filter(Boolean).length} of {statuses.length} picks in
            </span>
          ) : null}
          <Countdown deadline={view.deadline} pausedRemainingMs={view.pausedRemainingMs} now={game.now} quiet className="text-xl" />
        </p>
        <div className="flex gap-2">
          {view.settings.traitorChat ? (
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setChatOpen(true)}>
              Chat ({tv.chat?.length ?? 0})
            </Button>
          ) : null}
          {night.recruitmentAvailable && !night.blackmail ? (
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setRecruitMode((r) => !r)}>
              {recruiting ? "Murder instead" : `Recruit instead (${night.offersLeft} ${night.offersLeft === 1 ? "offer" : "offers"} left)`}
            </Button>
          ) : null}
        </div>
        <ErrorLine message={error} />
        <ChatSheet game={game} open={chatOpen} onClose={() => setChatOpen(false)} />
        <Sheet open={!!confirm} onClose={() => setConfirmId(null)}>
          {confirm ? (
            <div className="flex flex-col items-center gap-4">
              <Avatar name={confirm.displayName} url={game.photoFor(confirm.photoPath)} size={132} tall />
              <h2 className="text-center font-display text-3xl leading-tight">
                {recruiting ? `${night.blackmail ? "Blackmail" : "Recruit"} ${confirm.displayName}?` : `Pick ${confirm.displayName}?`}
              </h2>
              <p className="-mt-2 text-center text-ink-muted">
                {night.blackmail
                  ? "They get a private offer: join you or die. You can't change this once it's sent."
                  : recruiting
                  ? "They get a private offer. If they refuse or don't answer, you pick again."
                  : "You can change your pick until every Traitor has picked."}
              </p>
              <Button
                variant="danger"
                busy={busy}
                onClick={async () => {
                  if (await send({ type: "nightPick", targetId: confirm.id, mode: recruiting ? "recruit" : "murder" })) setConfirmId(null);
                }}
              >
                {recruiting ? "Send the offer" : "Pick"}
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

  if (poll) {
    return (
      <div className="flex flex-col gap-5">
        <Heading title="Night falls" help="Tap a player. Only you see your choice." />
        {poll}
      </div>
    );
  }

  return (
    <Still>
      <Heading title="Night falls" help="Close your eyes. The Traitors are choosing." />
    </Still>
  );
}

export function BreakfastScreen({ game }: { game: GameHandle }) {
  const view = game.view!;
  const night = view.night;
  if (!night?.revealed) {
    return (
      <Still>
        <Heading title="Breakfast" help="Everyone to the table. The host will reveal what happened in the night." />
      </Still>
    );
  }
  const victim = playerById(view, night.victimId);
  return (
    <Still>
      {victim ? (
        <>
          <Avatar name={victim.displayName} url={game.photoFor(victim.photoPath)} size={176} tall ghost />
          <Heading title={`${victim.displayName} was murdered`} help="They are now a ghost." />
        </>
      ) : (
        <Heading title="Nobody died last night" />
      )}
    </Still>
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
        <h2 className="font-display text-[3.2rem] leading-none text-balance">
          {f.winner === "traitors" ? "The Traitors win" : "The Innocents win"}
        </h2>
        <div className="speed-lines mx-auto my-3 w-16" aria-hidden />
        {view.me ? <p className="font-display text-2xl">{iWon ? "You win!" : "Better luck next time."}</p> : null}
      </div>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
        {view.players.map((p) => (
          <li key={p.id} className="text-center">
            <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size="fill" tall ghost={p.status !== "alive"} />
            <span className="mt-1.5 block truncate leading-tight">{p.displayName}</span>
            <span className={`text-lg ${p.role === "traitor" ? "font-semibold text-danger-ink" : "text-ink-muted"}`}>
              {p.role === "traitor" ? "Traitor" : "Innocent"}
            </span>
          </li>
        ))}
      </ul>
      {f.ghostScores.some((g) => g.total > 0) ? (
        <Card>
          <p className="mb-2 font-display text-xl text-accent">Best Ghost</p>
          <ol className="flex flex-col gap-1">
            {f.ghostScores.filter((g) => g.total > 0).slice(0, 5).map((g, i) => (
              <li key={g.playerId} className="flex justify-between gap-2">
                <span>
                  {i + 1}. {playerById(view, g.playerId)?.displayName}
                  {g.playerId === view.me?.playerId ? " (you)" : ""}
                </span>
                <span className="font-semibold text-accent tabular-nums">{g.total}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
      {suspects.length ? (
        <Card>
          <p className="mb-2 font-display text-xl text-accent">Most suspected at night</p>
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
  const [tab, setTab] = useState<"games" | "feed">("games");
  const canGhostVote = (view.phase === "CIRCLE_VOTE" || view.phase === "ENDGAME_BANISH") && !!me.vote?.canVote && me.vote.asGhost;
  const feed = view.events
    .map((e) => ({ id: e.id, text: describeEvent(e, view) }))
    .filter((e): e is { id: string; text: string } => !!e.text)
    .reverse()
    .slice(0, 30);
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="flex items-center justify-center gap-2 font-display text-[2.6rem] leading-none text-ghost">
          <Icon name="ghost" className="size-9" />
          You&apos;re a ghost
        </p>
        <div className="speed-lines mx-auto my-3 w-16" aria-hidden />
        <p className="text-lg leading-snug text-ink-muted">
          You&apos;re still in the room: join the private talks and the Circle, and make your case.
          {view.settings.ghostVote && !me.ghostVote.used ? " You still have your one ghost vote." : ""}
        </p>
      </div>
      {view.phase === "PRIVATE_TALKS" ? <PrivateTalksScreen game={game} /> : null}
      {me.rewardVote ? <RewardVoteCard game={game} /> : null}
      {canGhostVote ? <VoteScreen game={game} /> : null}
      {view.phase === "CIRCLE_REVEAL" ? <RevealScreen game={game} /> : null}
      {me.ghostGames ? (
        <Segmented
          label="Show"
          value={tab}
          options={[
            { value: "games", label: "Ghost games" },
            { value: "feed", label: "What's happening" },
          ]}
          onChange={setTab}
        />
      ) : null}
      {me.ghostGames && tab === "games" ? (
        <GhostGames game={game} />
      ) : (
        <Card>
          <p className="mb-2 font-display text-xl text-accent">What&apos;s happening</p>
          <ul className="flex flex-col gap-2 text-lg">
            {feed.map((e) => (
              <li key={e.id} className="text-ink">
                {e.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Time left before phones show the night's result, so the big screen's breakfast entrance plays first. */
export function entranceLeft(game: GameHandle): number {
  const view = game.view!;
  if (view.phase !== "MURDER_REVEAL" || !view.night?.revealed) return 0;
  const e = [...view.events].reverse().find((x) => x.type === "murderRevealed");
  const ms = typeof e?.data.entranceMs === "number" ? e.data.entranceMs : 0;
  if (!e || !ms) return 0;
  return Math.max(0, (game.seenAt(e.id) ?? e.at) + ms - game.now());
}

export function EntranceHold({ game }: { game: GameHandle }) {
  return (
    <Still>
      <Heading title="Breakfast is served" help="Watch the big screen: everyone is walking in, one by one." />
      <p className="font-display text-[5rem] leading-none text-accent">{Math.ceil(entranceLeft(game) / 1000)}</p>
    </Still>
  );
}
