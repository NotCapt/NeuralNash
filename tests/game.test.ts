import { expect, it } from "vitest";
import { Game } from "../server/game.js";

function setup(n = 8) {
  let time = 1000;
  const game = new Game("TEST", Math.random, () => time);
  for (let i = 0; i < n; i++) game.addPlayer(`Agent ${i}`);
  return {
    game,
    elapse: (ms: number) => {
      time += ms;
      game.tick();
    },
  };
}
it("runs every state, defaults to C, scores once, and logs every transition", () => {
  const { game: g, elapse } = setup();
  g.start();
  expect(g.phase).toBe("ROLE_REVEAL");
  elapse(12000);
  expect(g.phase).toBe("PAIRING");
  elapse(2000);
  expect(g.phase).toBe("TALK");
  elapse(60000);
  expect(g.phase).toBe("DECISION");
  elapse(20000);
  expect(g.phase).toBe("REVEAL");
  expect(g.history[0].moves).toEqual(
    Object.fromEntries(g.players.map((p) => [p.id, "C"])),
  );
  expect(g.players.every((p) => p.score === (p.role === "LOYAL" ? 3 : 2))).toBe(
    true,
  );
  expect(JSON.stringify(g.logs)).toContain('"timedOut":true');
  while (g.phase !== "RESULTS") g.advance();
  expect(g.history).toHaveLength(8);
  expect(g.players.every((p) => p.vote && p.vote !== p.id)).toBe(true);
  expect(g.logs.filter((l) => l.event === "transition")).toHaveLength(36);
});
it("allows changes until the deadline; paused timers and choices stay frozen", () => {
  const { game: g, elapse } = setup();
  g.start();
  g.advance();
  g.advance();
  g.advance();
  const id = g.players[0].id;
  g.choose(id, "C");
  g.choose(id, "D");
  expect(g.choices[id]).toBe("D");
  elapse(5000);
  g.pause();
  elapse(90000);
  expect(g.phase).toBe("DECISION");
  expect(g.remainingMs).toBe(15000);
  expect(() => g.choose(id, "C")).toThrow();
  g.pause();
  elapse(15000);
  expect(g.phase).toBe("REVEAL");
  expect(() => g.choose(id, "C")).toThrow();
});
it("does not leak role, score, ballot, timeout status, or unrevealed choices to host or peers", () => {
  const { game: g } = setup();
  g.start();
  const a = g.players[0],
    b = g.players[1];
  for (let i = 0; i < 3; i++) g.advance();
  g.choose(a.id, "D");
  const host = g.view(),
    peer = g.view(b.id);
  expect(host.self).toBeUndefined();
  expect(host.results).toBeUndefined();
  expect(host.history).toEqual([]);
  for (const view of [host, peer]) {
    expect(
      view.players.every(
        (p) => Object.keys(p).sort().join(",") === "bot,connected,id,name",
      ),
    ).toBe(true);
    expect(view).not.toHaveProperty("choices");
    expect(view).not.toHaveProperty("logs");
    expect(JSON.stringify(view)).not.toContain("timedOut");
    expect(view.lockedCount).toBe(1);
  }
  expect(peer.self?.choice).toBeUndefined();
  expect(g.view(a.id).self?.choice).toBe("D");
  g.advance();
  expect(g.view().history[0].moves[a.id]).toBe("D");
  expect(g.view().results).toBeUndefined();
  g.endEarly();
  g.vote(a.id, b.id);
  expect(g.view(b.id).self?.vote).toBeUndefined();
  expect(g.view().voteCount).toBe(1);
  expect(() => g.exportLog()).toThrow();
  g.advance();
  expect(g.view().results?.players).toHaveLength(8);
});
it("reveals allies only with the explicit setting and only to saboteurs", () => {
  const { game: g } = setup();
  g.start();
  const spy = g.players.find((p) => p.role === "SABOTEUR")!,
    loyal = g.players.find((p) => p.role === "LOYAL")!;
  expect(g.view(spy.id).self?.allies).toBeUndefined();
  g.settings.saboteursKnowEachOther = true;
  expect(g.view(spy.id).self?.allies).toHaveLength(1);
  expect(g.view(loyal.id).self?.allies).toBeUndefined();
});
it("aborts an unscored round and resets all hidden state on restart", () => {
  const { game: g } = setup();
  g.start();
  g.advance();
  g.advance();
  g.advance();
  g.choose(g.players[0].id, "D");
  g.endEarly();
  expect(g.history).toHaveLength(0);
  expect(g.players.every((p) => !p.score)).toBe(true);
  g.advance();
  g.restart();
  expect(g.phase).toBe("LOBBY");
  expect(g.view(g.players[0].id).self?.role).toBeUndefined();
  expect(g.players.every((p) => !p.vote && !p.score)).toBe(true);
  expect(g.results).toBeUndefined();
});
