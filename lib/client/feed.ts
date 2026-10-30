import type { EventView, GameView } from "@/lib/game/view";

/** Turns events into short sentences for the ghost feed and the host. Unknown events are skipped. */
export function describeEvent(e: EventView, view: GameView): string | null {
  const name = (id: unknown) => view.players.find((p) => p.id === id)?.displayName ?? "Someone";
  const d = e.data;
  switch (e.type) {
    case "rolesDealt":
      return `Roles were dealt: ${d.traitorCount} Traitors among ${d.playerCount} players.`;
    case "missionStarted":
      return `Mission: ${d.name}.`;
    case "circleOpened":
      return "The Circle of Shaq began.";
    case "votingOpened":
      return "Voting opened.";
    case "votingLocked":
      return "Voting closed.";
    case "tie":
      return `A tie between ${(d.tiedIds as string[]).map(name).join(" and ")}.`;
    case "revoteOpened":
      return "A revote opened between the tied players.";
    case "spin":
      return `The spin chose ${name(d.playerId)}.`;
    case "banished":
      return `${name(d.playerId)} was banished${d.role ? ` (${d.role === "traitor" ? "a Traitor" : "an Innocent"})` : ""}.`;
    case "nightFell":
      return "Night fell.";
    case "dawn":
      return "Morning came.";
    case "murderRevealed":
      return d.victimId ? `${name(d.victimId)} was murdered.` : "Nobody died last night.";
    case "endgameStarted":
      return "The End Game began.";
    case "endgameResult":
      return d.end ? "Everyone voted to end the game." : "Not everyone voted End, so one more banishment.";
    case "finale":
      return `The final reveal: the ${d.winner === "traitors" ? "Traitors" : "Innocents"} win.`;
    case "paused":
      return "The host paused the game.";
    case "resumed":
      return "The game resumed.";
    case "playerEliminated":
      return d.status === "left" ? `${name(d.playerId)} left the game.` : `${name(d.playerId)} is out.`;
    case "playerRevived":
      return `${name(d.playerId)} is back in the game.`;
    case "itemAwarded":
      return `You received a ${d.itemType === "shield" ? "shield" : "dagger"}.`;
    case "itemRemoved":
      return `Your ${d.itemType === "shield" ? "shield" : "dagger"} was taken back.`;
    case "recruited":
      return "You joined the Traitors.";
    case "newTraitor":
      return `${name(d.playerId)} joined the Traitors.`;
    case "undone":
      return "The host took back the last step.";
    case "roleChanged":
      return "The host changed your role. Hold your role card to check it.";
    case "privateTalksStarted":
      return "Private talks started.";
    case "bingo":
      return `${name(d.playerId)} got Bhoot Bingo!`;
    case "cohostChanged":
      return d.cohost ? "The host made you co-host. Open the co-host controls from the top of your screen." : "You're no longer the co-host.";
    default:
      return null;
  }
}
