import { Game } from "../server/game.js";
import { tickBots } from "../server/bots.js";
import { exportCsv } from "../server/export.js";
import { z } from "zod";

interface Statement {
  bind(...args: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Env {
  DB: { prepare(sql: string): Statement };
}
interface Seat {
  kind: "host" | "player";
  playerId?: string;
  seen: number;
}
interface Stored {
  game: object;
  seats: Record<string, Seat>;
}
interface Row {
  state: string;
  version: number;
}
const settings = z
  .object({
    rounds: z.number().int().min(5).max(12),
    talkSeconds: z.number().int().min(0).max(180),
    decisionSeconds: z.number().int().min(5).max(120),
    accusationSeconds: z.number().int().min(15).max(180),
    saboteursKnowEachOther: z.boolean(),
    sound: z.boolean(),
  })
  .strict();
const sessionSchema = z.object({
  code: z.string().regex(/^[A-Z]{4}$/),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
function restore(code: string, stored: Stored, now: number) {
  const game = Object.assign(new Game(code), stored.game);
  // Replay elapsed server deadlines in order, never using a client clock.
  for (
    let i = 0;
    i < 70 && !game.paused && game.deadline !== null && game.deadline <= now;
    i++
  ) {
    const deadline = game.deadline;
    game.now = () => deadline - 1;
    tickBots(game, true);
    game.now = () => deadline;
    game.advance();
  }
  game.now = () => now;
  tickBots(game);
  return game;
}
function handle(
  game: Game,
  seats: Record<string, Seat>,
  event: string,
  data: unknown,
  seat?: Seat,
): object {
  const host = () => {
    if (seat?.kind !== "host") throw new Error("Only the host can do that.");
  };
  if (event === "sync" || event === "resume") return {};
  if (event === "join") {
    const name = z.object({ name: z.string().max(64) }).parse(data).name;
    const p = game.addPlayer(name),
      key = token();
    seats[key] = { kind: "player", playerId: p.id, seen: Date.now() };
    return { session: { code: game.code, token: key, kind: "player" } };
  }
  if (event === "choice") {
    if (!seat?.playerId) throw new Error("No player seat.");
    game.choose(seat.playerId, z.enum(["C", "D"]).parse(data));
  } else if (event === "vote") {
    if (!seat?.playerId) throw new Error("No player seat.");
    game.vote(seat.playerId, z.string().uuid().parse(data));
  } else if (event === "settings") {
    host();
    game.configure(settings.parse(data));
  } else if (event === "control") {
    host();
    const action = z
      .enum(["start", "pause", "skip", "end", "restart"])
      .parse(data);
    if (action === "start") game.start();
    else if (action === "pause") game.pause();
    else if (action === "end") game.endEarly();
    else if (action === "restart") game.restart();
    else {
      if (game.paused) throw new Error("Resume before skipping.");
      game.log("skip", { phase: game.phase });
      game.advance();
    }
  } else if (event === "kick") {
    host();
    const id = z.string().uuid().parse(data);
    game.kick(id);
    for (const key of Object.keys(seats))
      if (seats[key].playerId === id) delete seats[key];
  } else if (event === "fill") {
    host();
    if (game.phase !== "LOBBY")
      throw new Error("Bots can only join in the lobby.");
    let n = 1;
    while (game.players.length < 12) {
      const name = `Agent ${n++}`;
      if (
        !game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())
      )
        game.addPlayer(name, true);
    }
  } else if (event === "export") {
    host();
    const format = z.enum(["json", "csv"]).parse(data);
    return {
      filename: `double-agent-${game.code}.${format}`,
      content:
        format === "json"
          ? JSON.stringify(game.exportLog(), null, 2)
          : exportCsv(game),
    };
  } else throw new Error("Unknown action.");
  return {};
}
export async function gameRequest(input: unknown, env: Env) {
  const { event, data, session } = z
    .object({
      event: z.string().max(20),
      data: z.unknown().optional(),
      session: z.unknown().optional(),
    })
    .parse(input);
  const now = Date.now();
  if (event === "create") {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    for (let i = 0; i < 8; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(4));
      const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(
        "",
      );
      const key = token(),
        game = new Game(code),
        seats: Record<string, Seat> = { [key]: { kind: "host", seen: now } };
      const result = await env.DB.prepare(
        "INSERT OR IGNORE INTO rooms(code,version,state,updated_at) VALUES(?,0,?,?)",
      )
        .bind(code, JSON.stringify({ game, seats }), now)
        .run();
      if (result.meta.changes)
        return {
          ok: true,
          session: { code, token: key, kind: "host" },
          state: game.view(),
        };
    }
    throw new Error("Please try creating the room again.");
  }
  const auth =
    event === "join"
      ? null
      : sessionSchema.parse(event === "resume" ? data : session);
  const code =
    auth?.code ??
    z
      .object({ code: z.string().length(4) })
      .parse(data)
      .code.toUpperCase();
  for (let attempt = 0; attempt < 12; attempt++) {
    const row = await env.DB.prepare(
      "SELECT state,version FROM rooms WHERE code=?",
    )
      .bind(code)
      .first<Row>();
    if (!row)
      return {
        ok: false,
        expired: true,
        error: "Room not found. Create or join a new operation.",
      };
    const stored = JSON.parse(row.state) as Stored;
    const seat = auth ? stored.seats[auth.token] : undefined;
    if (auth && !seat)
      return {
        ok: false,
        expired: true,
        error: "This seat is no longer available.",
      };
    const game = restore(code, stored, now);
    if (seat) seat.seen = now;
    for (const p of game.players)
      p.connected =
        p.bot ||
        Object.values(stored.seats).some(
          (s) => s.playerId === p.id && now - s.seen < 15000,
        );
    let response: Record<string, any>;
    try {
      response = { ok: true, ...handle(game, stored.seats, event, data, seat) };
    } catch (error) {
      response = {
        ok: false,
        error:
          error instanceof z.ZodError
            ? "Invalid request. Check your values."
            : (error as Error).message,
      };
    }
    if (event === "resume") response.session = { ...auth, kind: seat!.kind };
    const receiver = response.session
      ? stored.seats[response.session.token]
      : seat;
    if (receiver)
      response.state = game.view(
        receiver.kind === "player" ? receiver.playerId : undefined,
      );
    const saved = await env.DB.prepare(
      "UPDATE rooms SET state=?,version=version+1,updated_at=? WHERE code=? AND version=?",
    )
      .bind(
        JSON.stringify({ game, seats: stored.seats }),
        now,
        code,
        row.version,
      )
      .run();
    if (saved.meta.changes) return response;
  }
  return { ok: false, error: "The room is busy. Please try again." };
}
