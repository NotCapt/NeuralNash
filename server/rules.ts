import type { Move, Role } from "../shared/types.js";

export const saboteurCount = (n: number) => Math.max(1, Math.floor(n / 4));
export function basePayoffs(a: Move, b: Move): [number, number] {
  if (a === "C") return b === "C" ? [3, 3] : [0, 5];
  return b === "C" ? [5, 0] : [1, 1];
}
export function scorePair(
  a: Move,
  b: Move,
  roleA: Role,
  roleB: Role,
): [number, number] {
  const [x, y] = basePayoffs(a, b);
  return [roleA === "LOYAL" ? x : 5 - y, roleB === "LOYAL" ? y : 5 - x];
}
export function accusationBonuses(
  players: { id: string; role: Role; vote?: string }[],
): Record<string, number> {
  return Object.fromEntries(
    players.map((p) => [
      p.id,
      p.role === "LOYAL"
        ? players.some(
            (target) => target.id === p.vote && target.role === "SABOTEUR",
          )
          ? 3
          : 0
        : 2 *
          players.filter((v) => v.role === "LOYAL" && v.vote !== p.id).length,
    ]),
  );
}
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export const pairKey = (a: string, b: string) => [a, b].sort().join(":");

// Exact minimum-cost perfect matching (at most 16 players). A repeat has a
// large penalty, so a zero-repeat matching always wins when one exists.
export function pairPlayers(
  ids: string[],
  meetings: Record<string, number>,
  byes: Record<string, number>,
  random = Math.random,
) {
  let pool = shuffle(ids, random);
  let bye: string | null = null;
  if (pool.length % 2) {
    const least = Math.min(...pool.map((id) => byes[id] ?? 0));
    bye = pool.find((id) => (byes[id] ?? 0) === least)!;
    pool = pool.filter((id) => id !== bye);
  }
  const memo = new Map<number, { cost: number; pairs: [string, string][] }>();
  function solve(mask: number): { cost: number; pairs: [string, string][] } {
    if (!mask) return { cost: 0, pairs: [] };
    const cached = memo.get(mask);
    if (cached) return cached;
    const i = pool.findIndex((_, bit) => Boolean(mask & (1 << bit)));
    let best = { cost: Infinity, pairs: [] as [string, string][] };
    for (let j = i + 1; j < pool.length; j++) {
      if (!(mask & (1 << j))) continue;
      const count = meetings[pairKey(pool[i], pool[j])] ?? 0;
      const tail = solve(mask & ~(1 << i) & ~(1 << j));
      const cost = tail.cost + (count ? 10000 + count * count : 0);
      if (cost < best.cost)
        best = { cost, pairs: [[pool[i], pool[j]], ...tail.pairs] };
    }
    memo.set(mask, best);
    return best;
  }
  return { pairs: solve((1 << pool.length) - 1).pairs, bye };
}
