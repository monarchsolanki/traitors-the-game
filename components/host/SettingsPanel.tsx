"use client";

import { useState } from "react";
import {
  BINGO_SIDE,
  MAX_PLAYERS,
  NARRATION_KEYS,
  SETTING_META,
  defaultEndGameThreshold,
  maxTraitors,
  type GameSettings,
  type NarrationKey,
  type SettingKey,
} from "@/lib/game/settings";
import type { GameHandle } from "@/lib/client/useGame";
import { Button } from "@/components/ui/Button";
import { Card, Segmented, Stepper, TextField, Toggle } from "@/components/ui/Field";
import { formatClock } from "@/components/ui/Countdown";
import { ErrorLine } from "@/components/player/shared";
import { useHostSend } from "./GameControls";
import { TextArea } from "./MissionCatalogue";
import { PresetsCard } from "./PresetsCard";

const GHOST_GAME_LABELS = [
  ["bhootBets", "Bhoot Bets", "Ghosts bet on each banishment and murder, and call who was a Traitor."],
  ["crystalBall", "Crystal Ball", "At each Circle, ghosts guess the Traitors. Scored at the final reveal."],
  ["liveReactions", "Live reactions", "Ghosts float emoji across the big screen during the debate."],
  ["bhootBingo", "Bhoot Bingo", "A card of moments; the first full line wins."],
] as const;

const NARRATION_LABELS: Record<NarrationKey, string> = {
  lobby: "Lobby",
  roles: "Roles dealt",
  mission: "Mission",
  talks: "Private talks",
  debate: "Debate",
  vote: "Voting",
  reveal: "Vote reveal",
  night: "Night",
  breakfast: "Breakfast",
  endgame: "End Game",
  finale: "Final reveal",
};

export function SettingsPanel({ game }: { game: GameHandle }) {
  const view = game.view!;
  const s = view.settings;
  const dealt = view.startingPlayerCount !== null;
  const n = view.startingPlayerCount ?? view.players.length;
  const { error, send } = useHostSend(game);
  const locked = (k: SettingKey) => dealt && SETTING_META[k].afterDealing !== "anyTime";
  const set = <K extends SettingKey>(k: K, v: GameSettings[K]) => send({ type: "updateSettings", patch: { [k]: v } });
  const help = (k: SettingKey) => (locked(k) ? `${SETTING_META[k].help} Locked now that roles are dealt.` : SETTING_META[k].help);
  const threshold = s.endGameThreshold === "auto" ? defaultEndGameThreshold(n) : s.endGameThreshold;
  const clock = (v: number) => formatClock(v * 1000);

  return (
    <div className="flex flex-col gap-4">
      <ErrorLine message={error} />
      <Card>
        <p className="mb-1 font-semibold text-gold">Rules</p>
        <Stepper label={SETTING_META.traitorCount.label} hint={help("traitorCount")} value={s.traitorCount} min={1} max={Math.max(1, maxTraitors(Math.max(n, 3)))} disabled={locked("traitorCount")} onChange={(v) => set("traitorCount", v)} />
        <Segmented
          label={SETTING_META.endCondition.label}
          hint={help("endCondition")}
          value={s.endCondition}
          disabled={locked("endCondition")}
          options={[
            { value: "parity", label: "Until one side wins" },
            { value: "endgameVote", label: "End Game vote" },
          ]}
          onChange={(v) => set("endCondition", v)}
        />
        {s.endCondition === "endgameVote" ? (
          <>
        <Toggle
          label="Automatic End Game threshold"
          hint={`Half the starting players, rounded down (${defaultEndGameThreshold(n)} for ${n}).`}
          checked={s.endGameThreshold === "auto" && !dealt}
          disabled={locked("endGameThreshold")}
          onChange={(on) => set("endGameThreshold", on ? "auto" : defaultEndGameThreshold(n))}
        />
        <Stepper
          label={SETTING_META.endGameThreshold.label}
          hint={help("endGameThreshold")}
          value={threshold}
          min={2}
          max={Math.max(2, Math.min(MAX_PLAYERS - 1, n - 1))}
          disabled={locked("endGameThreshold") || s.endGameThreshold === "auto"}
          onChange={(v) => set("endGameThreshold", v)}
        />
          </>
        ) : null}
        <Segmented label={SETTING_META.daggerWeight.label} hint={help("daggerWeight")} value={s.daggerWeight} disabled={locked("daggerWeight")} options={[{ value: 2, label: "×2" }, { value: 3, label: "×3" }]} onChange={(v) => set("daggerWeight", v)} />
        <Toggle label={SETTING_META.allowTraitorOnTraitor.label} hint={help("allowTraitorOnTraitor")} checked={s.allowTraitorOnTraitor} disabled={locked("allowTraitorOnTraitor")} onChange={(v) => set("allowTraitorOnTraitor", v)} />
        <Segmented label={SETTING_META.murderRule.label} hint={help("murderRule")} value={s.murderRule} disabled={locked("murderRule")} options={[{ value: "majority", label: "Majority" }, { value: "unanimous", label: "Unanimous" }]} onChange={(v) => set("murderRule", v)} />
        <Segmented label={SETTING_META.tieRule.label} hint={help("tieRule")} value={s.tieRule} disabled={locked("tieRule")} options={[{ value: "revote", label: "Revote" }, { value: "spin", label: "Spin at once" }, { value: "hostDecides", label: "I decide" }]} onChange={(v) => set("tieRule", v)} />
        {s.tieRule === "revote" ? (
          <Stepper label={SETTING_META.tieRevotesBeforeChoice.label} hint={help("tieRevotesBeforeChoice")} value={s.tieRevotesBeforeChoice} min={1} max={5} disabled={locked("tieRevotesBeforeChoice")} onChange={(v) => set("tieRevotesBeforeChoice", v)} />
        ) : null}
        <Toggle label={SETTING_META.traitorChat.label} hint={help("traitorChat")} checked={s.traitorChat} disabled={locked("traitorChat")} onChange={(v) => set("traitorChat", v)} />
        <Toggle label={SETTING_META.revealOnElimination.label} hint={help("revealOnElimination")} checked={s.revealOnElimination} disabled={locked("revealOnElimination")} onChange={(v) => set("revealOnElimination", v)} />
        <Segmented label={SETTING_META.recruitment.label} hint={help("recruitment")} value={s.recruitment} disabled={locked("recruitment")} options={[{ value: "off", label: "Off" }, { value: "lastTraitor", label: "Last Traitor may recruit" }]} onChange={(v) => set("recruitment", v)} />
        <Toggle label={SETTING_META.eliminatedWinWithTeam.label} hint={help("eliminatedWinWithTeam")} checked={s.eliminatedWinWithTeam} disabled={locked("eliminatedWinWithTeam")} onChange={(v) => set("eliminatedWinWithTeam", v)} />
      </Card>
      <Card>
        <p className="mb-1 font-semibold text-gold">Night and ghosts</p>
        <Toggle label={SETTING_META.suspectPoll.label} hint={help("suspectPoll")} checked={s.suspectPoll} onChange={(v) => set("suspectPoll", v)} />
        <Toggle label={SETTING_META.ghostVote.label} hint={help("ghostVote")} checked={s.ghostVote} disabled={locked("ghostVote")} onChange={(v) => set("ghostVote", v)} />
        {GHOST_GAME_LABELS.map(([k, label, hint]) => (
          <Toggle key={k} label={label} hint={hint} checked={s.ghostGames[k]} onChange={(v) => set("ghostGames", { ...s.ghostGames, [k]: v })} />
        ))}
      </Card>
      <Card>
        <p className="mb-1 font-semibold text-gold">Each day</p>
        <Toggle label={SETTING_META.privateTalks.label} hint={SETTING_META.privateTalks.help} checked={s.privateTalks} onChange={(v) => set("privateTalks", v)} />
        {s.privateTalks ? (
          <Stepper label={SETTING_META.privateTalksSeconds.label} value={s.privateTalksSeconds} min={60} max={1800} step={60} format={clock} onChange={(v) => set("privateTalksSeconds", v)} />
        ) : null}
        <Stepper
          label={SETTING_META.ghostMissionFromMorning.label}
          hint={SETTING_META.ghostMissionFromMorning.help}
          value={s.ghostMissionFromMorning}
          min={1}
          max={10}
          format={(v) => (v === 1 ? "1st morning" : v === 2 ? "2nd morning" : v === 3 ? "3rd morning" : `${v}th morning`)}
          onChange={(v) => set("ghostMissionFromMorning", v)}
        />
      </Card>
      <GhostScoring game={game} />
      <Card>
        <p className="mb-1 font-semibold text-gold">Big screen</p>
        <Toggle label={SETTING_META.breakfastEntrance.label} hint={SETTING_META.breakfastEntrance.help} checked={s.breakfastEntrance} onChange={(v) => set("breakfastEntrance", v)} />
        {s.breakfastEntrance ? (
          <Stepper label={SETTING_META.entranceSeconds.label} value={s.entranceSeconds} min={5} max={60} step={5} format={(v) => `${v} s`} onChange={(v) => set("entranceSeconds", v)} />
        ) : null}
        <Narration game={game} />
      </Card>
      <Card>
        <p className="mb-1 font-semibold text-gold">Timers (change any time)</p>
        <Stepper label={SETTING_META.debateSeconds.label} value={s.debateSeconds} min={60} max={1800} step={60} format={clock} onChange={(v) => set("debateSeconds", v)} />
        <Stepper label={SETTING_META.voteSeconds.label} value={s.voteSeconds} min={30} max={600} step={30} format={clock} onChange={(v) => set("voteSeconds", v)} />
        <Stepper label={SETTING_META.nightSeconds.label} value={s.nightSeconds} min={60} max={600} step={30} format={clock} onChange={(v) => set("nightSeconds", v)} />
        <Stepper label={SETTING_META.recruitOfferSeconds.label} value={s.recruitOfferSeconds} min={30} max={300} step={30} format={clock} onChange={(v) => set("recruitOfferSeconds", v)} />
        <Stepper label={SETTING_META.rewardVoteSeconds.label} value={s.rewardVoteSeconds} min={30} max={300} step={30} format={clock} onChange={(v) => set("rewardVoteSeconds", v)} />
        <Stepper label={SETTING_META.pinMaxAttempts.label} value={s.pinMaxAttempts} min={3} max={10} onChange={(v) => set("pinMaxAttempts", v)} />
      </Card>
      <PresetsCard game={game} />
    </div>
  );
}

function GhostScoring({ game }: { game: GameHandle }) {
  const s = game.view!.settings;
  const { busy, error, send } = useHostSend(game);
  const [moments, setMoments] = useState(s.bingoMoments.join("\n"));
  const lines = moments.split("\n").map((l) => l.trim()).filter(Boolean);
  const points = (k: keyof GameSettings["ghostPoints"], v: number) => send({ type: "updateSettings", patch: { ghostPoints: { ...s.ghostPoints, [k]: v } } });
  return (
    <Card>
      <p className="mb-1 font-semibold text-gold">Ghost game points</p>
      <Stepper label="Right banishment bet" value={s.ghostPoints.banishBet} min={0} max={20} onChange={(v) => points("banishBet", v)} />
      <Stepper label="Right murder bet" value={s.ghostPoints.murderBet} min={0} max={20} onChange={(v) => points("murderBet", v)} />
      <Stepper label="Right Traitor call" value={s.ghostPoints.traitorCall} min={0} max={20} onChange={(v) => points("traitorCall", v)} />
      <Stepper label="Each Traitor found in Crystal Ball" value={s.ghostPoints.crystalBall} min={0} max={20} onChange={(v) => points("crystalBall", v)} />
      <Stepper label="First Bhoot Bingo line" value={s.ghostPoints.bingo} min={0} max={20} onChange={(v) => points("bingo", v)} />
      <div className="mt-3 flex flex-col gap-2">
        <TextArea
          label={`${SETTING_META.bingoMoments.label} (one per line, at least ${BINGO_SIDE * BINGO_SIDE})`}
          hint={SETTING_META.bingoMoments.help}
          value={moments}
          rows={8}
          onChange={setMoments}
        />
        <ErrorLine message={error} />
        <Button
          size="md"
          variant="secondary"
          disabled={lines.length < BINGO_SIDE * BINGO_SIDE || lines.join("\n") === s.bingoMoments.join("\n")}
          busy={busy}
          onClick={() => send({ type: "updateSettings", patch: { bingoMoments: lines } })}
        >
          Save Bingo moments ({lines.length})
        </Button>
      </div>
    </Card>
  );
}

function Narration({ game }: { game: GameHandle }) {
  const s = game.view!.settings;
  const { busy, error, send } = useHostSend(game);
  const [draft, setDraft] = useState(s.narration);
  const changed = NARRATION_KEYS.some((k) => draft[k] !== s.narration[k]);
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-base text-ink">{SETTING_META.narration.label}</p>
      <p className="-mt-2 text-sm text-ink-muted">{SETTING_META.narration.help}</p>
      {NARRATION_KEYS.map((k) => (
        <TextField key={k} label={NARRATION_LABELS[k]} value={draft[k]} maxLength={140} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
      ))}
      <ErrorLine message={error} />
      <Button size="md" variant="secondary" disabled={!changed} busy={busy} onClick={() => send({ type: "updateSettings", patch: { narration: draft } })}>
        Save narrator lines
      </Button>
    </div>
  );
}
