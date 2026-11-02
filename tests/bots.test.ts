import { expect, it } from "vitest";
import { Game } from "../server/game.js";
import { botMove, botVote, tickBots } from "../server/bots.js";
import { exportCsv } from "../server/export.js";

it("loyal bots use the current partner’s last public move, skipping byes", () => {
  const g = new Game("BOTS");
  const p = g.addPlayer("Loyal", true),
    q = g.addPlayer("Partner", true);
  g.pairs = [[p.id, q.id]];
  p.role = "LOYAL";
  expect(botMove(g, p)).toBe("C");
  g.history = [
    {
      round: 1,
      pairs: [[p.id, q.id]],
      bye: null,
      moves: { [q.id]: "D", [p.id]: "C" },
    },
    { round: 2, pairs: [], bye: q.id, moves: {} },
  ];
  expect(botMove(g, p)).toBe("D");
  g.history[0].moves[q.id] = "C";
  expect(botMove(g, p)).toBe("C");
});
it("saboteur probability boundary and highest-rate voting are exact", () => {
  const g = new Game("BOTS", () => 0.59),
    p = g.addPlayer("Spy", true),
    a = g.addPlayer("A"),
    b = g.addPlayer("B");
  p.role = "SABOTEUR";
  expect(botMove(g, p)).toBe("D");
  g.random = () => 0.6;
  expect(botMove(g, p)).toBe("C");
  g.history = [
    {
      round: 1,
      pairs: [],
      bye: null,
      moves: { [p.id]: "D", [a.id]: "D", [b.id]: "C" },
    },
  ];
  expect(botVote(g, p)).toBe(a.id);
  expect(botVote(g, a)).toBe(p.id);
});
it("bots complete full odd and even games using the same authoritative engine", () => {
  for (const n of [4, 5, 8, 12, 15, 16]) {
    const g = new Game("BOTS");
    for (let i = 0; i < n; i++) g.addPlayer(`Bot ${i}`, true);
    g.start();
    while (g.phase !== "RESULTS") {
      tickBots(g, true);
      g.advance();
    }
    expect(g.history).toHaveLength(8);
    expect(g.players.every((p) => p.vote && p.vote !== p.id)).toBe(true);
    expect(g.results!.loyalRanking.every((p) => p.role === "LOYAL")).toBe(true);
    expect(g.results!.saboteurRanking.every((p) => p.role === "SABOTEUR")).toBe(
      true,
    );
    expect(JSON.stringify(g.logs)).not.toContain('"timedOut":true');
    const csv = exportCsv(g);
    expect(csv).toContain('"final_scores"');
    expect(csv).toContain('"round_score"');
  }
});
it("CSV escapes spreadsheet formulas and exports all final ballots", () => {
  const g = new Game("BOTS");
  ["=1+1", "A", "B", "C"].forEach((name) => g.addPlayer(name, true));
  g.start();
  g.endEarly();
  tickBots(g, true);
  g.advance();
  expect(exportCsv(g)).toContain('"\'=1+1"');
  expect(g.exportLog().players.every((p) => p.vote)).toBe(true);
});
