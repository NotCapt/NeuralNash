import { expect, it } from "vitest";
import { Game } from "../server/game.js";
import { tickBots } from "../server/bots.js";

it("audits every phase for every recipient throughout a complete game", () => {
  const game = new Game("SAFE");
  for (let i = 0; i < 9; i++) game.addPlayer(`Agent ${i}`, true);
  const expectedPublicKeys = ["bot", "connected", "id", "name"];
  function audit() {
    for (const id of [undefined, ...game.players.map((p) => p.id)]) {
      const wire = JSON.parse(JSON.stringify(game.view(id)));
      for (const p of wire.players)
        expect(Object.keys(p).sort()).toEqual(expectedPublicKeys);
      expect(wire).not.toHaveProperty("logs");
      expect(wire).not.toHaveProperty("choices");
      expect(wire).not.toHaveProperty("seats");
      expect(wire.history).toHaveLength(game.history.length);
      expect(JSON.stringify(wire)).not.toContain("timedOut");
      if (game.phase !== "RESULTS") {
        expect(wire).not.toHaveProperty("results");
        const publicOnly = { ...wire };
        delete publicOnly.self;
        expect(JSON.stringify(publicOnly)).not.toMatch(
          /"(?:role|score|choice|vote|allies|bonus)":/,
        );
      }
      if (id) {
        expect(wire.self.id).toBe(id);
        expect(wire.self.score).toBe(game.player(id).score);
        if (game.phase !== "LOBBY")
          expect(wire.self.role).toBe(game.player(id).role);
        expect(wire.self).not.toHaveProperty("allies");
      } else expect(wire).not.toHaveProperty("self");
    }
  }
  audit();
  game.start();
  while (game.phase !== "RESULTS") {
    tickBots(game, true);
    audit();
    game.advance();
  }
  audit();
});

it("counts caught saboteurs using a strict loyal majority, and excludes byes from cooperation rates", () => {
  const g = new Game("STAT");
  const [a, b, c, d, spy] = ["A", "B", "C", "D", "S"].map((name) =>
    g.addPlayer(name),
  );
  spy.role = "SABOTEUR";
  a.vote = spy.id;
  b.vote = spy.id;
  c.vote = a.id;
  d.vote = a.id;
  spy.vote = a.id;
  g.history = [
    {
      round: 1,
      pairs: [
        [a.id, b.id],
        [c.id, spy.id],
      ],
      bye: d.id,
      moves: { [a.id]: "C", [b.id]: "D", [c.id]: "C", [spy.id]: "D" },
    },
  ];
  let result = g.computeResults();
  expect(result.caught).toBe(0);
  expect(result.mostAccused).toEqual([a.id]);
  expect(result.cooperation).toEqual({
    overall: 0.5,
    loyal: 2 / 3,
    saboteur: 0,
  });
  c.vote = spy.id;
  result = g.computeResults();
  expect(result.caught).toBe(1);
});
