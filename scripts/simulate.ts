import { Game } from "../server/game.js";
import { tickBots } from "../server/bots.js";

const options: Record<string, number> = { players: 12, games: 1000, seed: 42 };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, ""),
    value = Number(args[i + 1]);
  if (!(key in options) || !Number.isSafeInteger(value)) {
    console.error(
      "Usage: npm run simulate -- --players 12 --games 1000 [--seed 42]",
    );
    process.exit(1);
  }
  options[key] = value;
}
if (
  options.players < 4 ||
  options.players > 16 ||
  options.games < 1 ||
  options.games > 100000
) {
  console.error("Players must be 4–16; games must be 1–100000.");
  process.exit(1);
}
let seed = options.seed >>> 0;
const random = () => {
  seed += 0x6d2b79f5;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let loyalScore = 0,
  spyScore = 0,
  loyalCount = 0,
  spyCount = 0,
  caught = 0,
  coop = 0;
const started = performance.now();
for (let i = 0; i < options.games; i++) {
  let time = 1_700_000_000_000;
  const game = new Game("SIMU", random, () => time);
  for (let p = 0; p < options.players; p++)
    game.addPlayer(`Bot ${p + 1}`, true);
  game.start();
  while (game.phase !== "RESULTS") {
    tickBots(game, true);
    time = game.deadline ?? time;
    game.advance();
  }
  for (const p of game.players) {
    if (p.role === "LOYAL") {
      loyalScore += p.score;
      loyalCount++;
    } else {
      spyScore += p.score;
      spyCount++;
    }
  }
  caught += game.results!.caught;
  coop += game.results!.cooperation.overall;
}
console.log(
  `\nDOUBLE AGENT — ${options.games.toLocaleString()} games × ${options.players} players × 8 rounds (seed ${options.seed})`,
);
console.log(
  `Average Loyal score:     ${(loyalScore / loyalCount).toFixed(2)} (includes accusation bonus)`,
);
console.log(
  `Average Saboteur score:  ${(spyScore / spyCount).toFixed(2)} (includes evasion bonus)`,
);
console.log(
  `Saboteur catch rate:     ${((100 * caught) / spyCount).toFixed(2)}% (strict majority of Loyals)`,
);
console.log(
  `Mean cooperation rate:  ${((100 * coop) / options.games).toFixed(2)}%`,
);
console.log(
  `Completed in ${((performance.now() - started) / 1000).toFixed(2)}s. Scores are separate scales, not a combined ranking.\n`,
);
