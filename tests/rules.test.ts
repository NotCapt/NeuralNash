import { describe, expect, it } from "vitest";
import {
  accusationBonuses,
  pairKey,
  pairPlayers,
  saboteurCount,
  scorePair,
} from "../server/rules.js";
import type { Move, Role } from "../shared/types.js";

describe("all payoff / role combinations", () => {
  const cases: [Move, Move, number, number][] = [
    ["C", "C", 3, 3],
    ["C", "D", 0, 5],
    ["D", "C", 5, 0],
    ["D", "D", 1, 1],
  ];
  for (const [a, b, x, y] of cases)
    for (const ra of ["LOYAL", "SABOTEUR"] as Role[])
      for (const rb of ["LOYAL", "SABOTEUR"] as Role[]) {
        it(`${a}/${b} as ${ra}/${rb}`, () =>
          expect(scorePair(a, b, ra, rb)).toEqual([
            ra === "LOYAL" ? x : 5 - y,
            rb === "LOYAL" ? y : 5 - x,
          ]));
      }
});
it("assigns the exact saboteur counts for 4–16 players", () => {
  expect(Array.from({ length: 13 }, (_, i) => saboteurCount(i + 4))).toEqual([
    1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4,
  ]);
});
it("applies loyal accuracy and per-saboteur evasion bonuses, ignoring saboteur ballots", () => {
  expect(
    accusationBonuses([
      { id: "a", role: "LOYAL", vote: "s" },
      { id: "b", role: "LOYAL", vote: "a" },
      { id: "c", role: "LOYAL", vote: "t" },
      { id: "s", role: "SABOTEUR", vote: "t" },
      { id: "t", role: "SABOTEUR", vote: "s" },
    ]),
  ).toEqual({ a: 3, b: 0, c: 3, s: 4, t: 4 });
});
it("finds a no-repeat matching even where a greedy pairing gets stuck", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const allowed = new Set(["a:b", "a:c", "b:d", "e:f"]);
  const meetings = Object.fromEntries(
    ids.flatMap((a, i) =>
      ids
        .slice(i + 1)
        .map((b) => [pairKey(a, b), allowed.has(pairKey(a, b)) ? 0 : 1]),
    ),
  );
  const { pairs } = pairPlayers(ids, meetings, {}, () => 0.99);
  expect(pairs.every(([a, b]) => !meetings[pairKey(a, b)])).toBe(true);
});
it("spreads byes fairly across two full cycles for every odd room size", () => {
  for (const n of [5, 7, 9, 11, 13, 15]) {
    const ids = Array.from({ length: n }, (_, i) => `${i}`),
      byes: Record<string, number> = {},
      meetings: Record<string, number> = {};
    for (let r = 0; r < n * 2; r++) {
      const { pairs, bye } = pairPlayers(ids, meetings, byes);
      expect(new Set([...pairs.flat(), bye]).size).toBe(n);
      byes[bye!] = (byes[bye!] ?? 0) + 1;
      expect(
        Math.max(...ids.map((id) => byes[id] ?? 0)) -
          Math.min(...ids.map((id) => byes[id] ?? 0)),
      ).toBeLessThanOrEqual(1);
      pairs.forEach(([a, b]) => {
        meetings[pairKey(a, b)] = (meetings[pairKey(a, b)] ?? 0) + 1;
      });
    }
  }
});
