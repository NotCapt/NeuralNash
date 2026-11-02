import type { Move } from "../shared/types.js";
import type { Game, Player } from "./game.js";
import { shuffle } from "./rules.js";

export function botMove(game: Game, player: Player): Move {
  if (player.role === "SABOTEUR") return game.random() < 0.6 ? "D" : "C";
  const partner = game.pairs
    .find((pair) => pair.includes(player.id))
    ?.find((id) => id !== player.id);
  if (!partner) return "C";
  const last = [...game.history].reverse().find((h) => h.moves[partner]);
  return last?.moves[partner] === "D" ? "D" : "C";
}
export function botVote(game: Game, player: Player): string {
  const candidates = shuffle(
    game.players.filter((p) => p.id !== player.id),
    game.random,
  );
  const rate = (id: string) => {
    const moves = game.history.flatMap((h) =>
      h.moves[id] ? [h.moves[id]] : [],
    );
    return moves.length
      ? moves.filter((move) => move === "D").length / moves.length
      : 0;
  };
  return candidates.sort((a, b) => rate(b.id) - rate(a.id))[0].id;
}

const schedules = new WeakMap<Game, { key: string; at: Map<string, number> }>();
export function tickBots(game: Game, immediate = false): boolean {
  if (game.paused || !["DECISION", "ACCUSATION"].includes(game.phase))
    return false;
  const key = `${game.round}:${game.phase}:${game.logs.find((e) => e.event === "roles")?.at}`;
  let schedule = schedules.get(game);
  if (!schedule || schedule.key !== key) {
    const total =
      (game.phase === "DECISION"
        ? game.settings.decisionSeconds
        : game.settings.accusationSeconds) * 1000;
    schedule = {
      key,
      at: new Map(
        game.players
          .filter((p) => p.bot)
          .map((p) => [p.id, total * (0.15 + game.random() * 0.55)]),
      ),
    };
    schedules.set(game, schedule);
  }
  const total =
    (game.phase === "DECISION"
      ? game.settings.decisionSeconds
      : game.settings.accusationSeconds) * 1000;
  const elapsed =
    total - Math.max(0, (game.deadline ?? game.now()) - game.now());
  let changed = false;
  for (const p of game.players) {
    if (!p.bot || (!immediate && elapsed < (schedule.at.get(p.id) ?? Infinity)))
      continue;
    if (game.phase === "DECISION" && p.id !== game.bye && !game.choices[p.id]) {
      game.choose(p.id, botMove(game, p));
      changed = true;
    } else if (game.phase === "ACCUSATION" && !p.vote) {
      game.vote(p.id, botVote(game, p));
      changed = true;
    }
  }
  return changed;
}
