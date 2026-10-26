"use client";

import { MAX_PLAYERS, SETTING_META, defaultEndGameThreshold, maxTraitors, type GameSettings, type SettingKey } from "@/lib/game/settings";
import type { GameHandle } from "@/lib/client/useGame";
import { Card, Segmented, Stepper, Toggle } from "@/components/ui/Field";
import { formatClock } from "@/components/ui/Countdown";
import { ErrorLine } from "@/components/player/shared";
import { useHostSend } from "./GameControls";

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
        {(
          [
            ["bhootBets", "Bhoot Bets"],
            ["crystalBall", "Crystal Ball"],
            ["liveReactions", "Live reactions"],
            ["bhootBingo", "Bhoot Bingo"],
          ] as const
        ).map(([k, label]) => (
          <Toggle key={k} label={label} hint="Ghost game; arrives in a later step." checked={s.ghostGames[k]} onChange={(v) => set("ghostGames", { ...s.ghostGames, [k]: v })} />
        ))}
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
    </div>
  );
}
