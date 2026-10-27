import type { GameView } from "@/lib/game/view";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STATUS: Record<string, string> = { alive: "In the game", murdered: "Murdered", banished: "Banished", left: "Left" };

/**
 * The paper fallback (section 9.6): a self-contained page with every role, item and status, plus
 * blank ballot slips, so the game can carry on if the internet drops. Host view only.
 */
export function paperFallbackHtml(view: GameView, generatedAt: Date): string {
  const host = view.host;
  if (!host) throw new Error("The paper copy needs the host view.");
  const items = (id: string) =>
    host.items
      .filter((i) => i.holderId === id && i.state === "held")
      .map((i) => (i.type === "shield" ? "Shield" : "Dagger"))
      .join(", ") || "—";
  const rows = view.players
    .map(
      (p) => `<tr>
  <td>${p.seat}</td>
  <td>${esc(p.displayName)}<div class="muted">${esc(p.name)}</div></td>
  <td class="${host.roles[p.id] === "traitor" ? "traitor" : ""}">${host.roles[p.id] === "traitor" ? "Traitor" : "Innocent"}</td>
  <td>${STATUS[p.status] ?? p.status}</td>
  <td>${items(p.id)}</td>
</tr>`,
    )
    .join("\n");
  const traitors = view.players.filter((p) => host.roles[p.id] === "traitor").map((p) => esc(p.displayName));
  const slips = view.players
    .filter((p) => p.status === "alive")
    .map(
      () => `<div class="slip">
  <p>Day ____ &nbsp; Circle / Revote / End Game</p>
  <p>My name: ______________________</p>
  <p>I vote to banish: ______________________</p>
  <p>End Game: &#9744; End &nbsp; &#9744; Banish &nbsp;&nbsp;&nbsp; Dagger used: &#9744;</p>
</div>`,
    )
    .join("\n");
  const when = generatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Traitors ${esc(view.code)}: offline copy (secret)</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { margin: 0 0 4px; } .muted { color: #666; font-size: 12px; }
  .warn { background: #fde8e8; border: 1px solid #c8283e; padding: 8px 12px; border-radius: 8px; margin: 12px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  .traitor { color: #c8283e; font-weight: 700; }
  .slips { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; page-break-before: always; }
  .slip { border: 1px dashed #999; padding: 8px 12px; border-radius: 6px; font-size: 14px; }
  .slip p { margin: 6px 0; }
  .print { font: inherit; padding: 10px 18px; border-radius: 10px; border: 1px solid #111; background: #fff; cursor: pointer; }
  @media print {
    body { margin: 0; }
    .print { display: none; }
    .warn, .traitor { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr, .slip { break-inside: avoid; }
  }
</style>
</head>
<body>
<button class="print" onclick="window.print()">Print this page</button>
<h1>Traitors: The Game, room ${esc(view.code)}</h1>
<p class="muted">Offline copy saved ${esc(when)}, day ${view.day}. Rules: ${view.settings.traitorCount} Traitors, dagger counts ×${view.settings.daggerWeight}, End Game at ${view.endGameThreshold} players or fewer.</p>
<p class="warn"><strong>Secret.</strong> This page shows every role. Keep it on the host's device or folded in a pocket. Use it only if the internet drops for everyone.</p>
<p><strong>Traitors:</strong> ${traitors.join(", ") || "none"}</p>
<table>
<thead><tr><th>Seat</th><th>Player</th><th>Role</th><th>Status</th><th>Holding</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<h2>If the internet drops</h2>
<ol>
  <li>Hand out the ballot slips below. Each living player writes their name and vote, folds it and hands it to you.</li>
  <li>Read the votes out one by one. A ticked dagger counts ×${view.settings.daggerWeight} at a normal Circle only.</li>
  <li>At night, Traitors whisper their pick to you in private.</li>
  <li>When the internet is back, enter the results in the host app (Fix tab) with "Paper ballots" as the reason.</li>
</ol>
<div class="slips">
${slips}
</div>
</body>
</html>`;
}

export function downloadPaperFallback(view: GameView): void {
  const html = paperFallbackHtml(view, new Date());
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `traitors-${view.code}-roles-day${view.day}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
