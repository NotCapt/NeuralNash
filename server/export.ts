import type { Game } from "./game.js";

const cell = (value: unknown) => {
  let text =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  // Names and JSON fields are untrusted spreadsheet input. Prevent formula execution.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function exportCsv(game: Game) {
  const data = game.exportLog();
  const rows: unknown[][] = [
    [
      "timestamp",
      "event",
      "round",
      "player_id",
      "name",
      "role",
      "move",
      "points",
      "total",
      "vote",
      "timed_out",
      "details_json",
    ],
  ];
  for (const event of data.events) {
    const payload = event.data as Record<string, unknown>;
    const entries =
      event.event === "round_score"
        ? (payload.players as Record<string, unknown>[])
        : event.event === "final_scores"
          ? (event.data as unknown as Record<string, unknown>[])
          : [payload];
    for (const entry of entries) {
      const player = data.players.find((p) => p.id === entry.id);
      rows.push([
        event.at,
        event.event,
        payload.round,
        entry.id,
        player?.name,
        entry.role ?? player?.role,
        entry.move,
        entry.points ?? entry.bonus,
        entry.total ?? entry.score,
        entry.target ?? entry.vote,
        entry.timedOut,
        event.data,
      ]);
    }
  }
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
