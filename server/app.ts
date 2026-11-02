import express from "express";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { randomBytes, randomInt } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { Game } from "./game.js";
import { exportCsv } from "./export.js";

export const settingsSchema = z
  .object({
    rounds: z.number().int().min(5).max(12),
    talkSeconds: z.number().int().min(0).max(180),
    decisionSeconds: z.number().int().min(5).max(120),
    accusationSeconds: z.number().int().min(15).max(180),
    saboteursKnowEachOther: z.boolean(),
    sound: z.boolean(),
  })
  .strict();
interface Seat {
  kind: "host" | "player";
  playerId?: string;
  socketId?: string;
}
interface Room {
  game: Game;
  seats: Map<string, Seat>;
  touched: number;
}
export function lanAddresses() {
  // Wi-Fi is the usual event network; virtual Ethernet adapters often sort first.
  return Object.entries(networkInterfaces())
    .sort(
      ([a], [b]) =>
        Number(/wi-?fi|wlan|wireless/i.test(b)) -
        Number(/wi-?fi|wlan|wireless/i.test(a)),
    )
    .flatMap(([, list]) => list ?? [])
    .filter(
      (a) =>
        a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254."),
    )
    .map((a) => a.address);
}
export function createApp(
  options: { tickMs?: number; botTick?: (game: Game) => boolean } = {},
) {
  const app = express(),
    http = createServer(app),
    io = new Server(http, { maxHttpBufferSize: 16_384 });
  const rooms = new Map<string, Room>();
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/network", (_req, res) =>
    res.json({
      addresses: lanAddresses(),
      joinOrigin: process.env.JOIN_ORIGIN || null,
    }),
  );
  app.use(express.static(resolve("dist/client")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(resolve("dist/client/index.html")),
  );
  const broadcast = (room: Room) => {
    for (const seat of room.seats.values())
      if (seat.socketId) {
        // No shared room emission: each authorized recipient gets its own allowlisted view.
        io.to(seat.socketId).emit(
          "state",
          room.game.view(seat.kind === "player" ? seat.playerId : undefined),
        );
      }
  };
  function bind(socket: Socket, room: Room, token: string, seat: Seat) {
    const previous = seat.socketId;
    seat.socketId = socket.id;
    socket.data.code = room.game.code;
    socket.data.token = token;
    if (previous && previous !== socket.id)
      io.sockets.sockets.get(previous)?.disconnect(true);
    if (seat.playerId) room.game.player(seat.playerId).connected = true;
    room.touched = Date.now();
  }
  const ticker = setInterval(() => {
    for (const [code, room] of rooms) {
      let changed = room.game.tick();
      if (options.botTick?.(room.game)) changed = true;
      if (changed) broadcast(room);
      if (
        Date.now() - room.touched > 12 * 60 * 60 * 1000 &&
        [...room.seats.values()].every((s) => !s.socketId)
      )
        rooms.delete(code);
    }
  }, options.tickMs ?? 100);
  io.on("connection", (socket) => {
    let count = 0,
      since = Date.now();
    function handler(event: string, fn: (input: unknown) => object | void) {
      socket.on(event, (input: unknown, ack: unknown) => {
        if (typeof ack !== "function") return;
        try {
          if (Date.now() - since > 1000) {
            since = Date.now();
            count = 0;
          }
          if (++count > 30)
            throw new Error("Too many requests. Please wait a moment.");
          const result = fn(input);
          ack({ ok: true, ...result });
        } catch (error) {
          ack({
            ok: false,
            error:
              error instanceof z.ZodError
                ? "Invalid request. Check your values."
                : error instanceof Error
                  ? error.message
                  : "Request failed.",
          });
        }
      });
    }
    function authenticated(host = false) {
      const room = rooms.get(socket.data.code),
        seat = room?.seats.get(socket.data.token);
      if (!room || !seat || seat.socketId !== socket.id)
        throw new Error("Session expired. Please rejoin.");
      if (host && seat.kind !== "host")
        throw new Error("Only the host can do that.");
      room.touched = Date.now();
      // Resolve an elapsed phase before applying late requests or host actions.
      if (room.game.tick()) broadcast(room);
      return { room, seat, game: room.game };
    }
    const unbound = () => {
      if (socket.data.code)
        throw new Error("Already connected to a room. Leave it first.");
    };
    handler("create", () => {
      unbound();
      if (rooms.size >= 100) throw new Error("Server is at capacity.");
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      let code: string;
      do {
        code = Array.from(
          { length: 4 },
          () => alphabet[randomInt(alphabet.length)],
        ).join("");
      } while (rooms.has(code));
      const room: Room = {
        game: new Game(code),
        seats: new Map(),
        touched: Date.now(),
      };
      const token = randomBytes(32).toString("hex"),
        seat: Seat = { kind: "host" };
      room.seats.set(token, seat);
      rooms.set(code, room);
      bind(socket, room, token, seat);
      broadcast(room);
      return { session: { code, token, kind: "host" } };
    });
    handler("join", (input) => {
      unbound();
      const { code, name } = z
        .object({ code: z.string().length(4), name: z.string().max(64) })
        .parse(input);
      const room = rooms.get(code.toUpperCase());
      if (!room) throw new Error("Room not found. Check the four-letter code.");
      const player = room.game.addPlayer(name),
        token = randomBytes(32).toString("hex"),
        seat: Seat = { kind: "player", playerId: player.id };
      room.seats.set(token, seat);
      bind(socket, room, token, seat);
      broadcast(room);
      return { session: { code: room.game.code, token, kind: "player" } };
    });
    handler("resume", (input) => {
      unbound();
      const { code, token } = z
        .object({ code: z.string().length(4), token: z.string().length(64) })
        .parse(input);
      const room = rooms.get(code),
        seat = room?.seats.get(token);
      if (!room || !seat)
        throw new Error("This session is no longer available.");
      bind(socket, room, token, seat);
      broadcast(room);
      return { session: { code, token, kind: seat.kind } };
    });
    handler("settings", (input) => {
      const { room, game } = authenticated(true);
      game.configure(settingsSchema.parse(input));
      broadcast(room);
    });
    handler("control", (input) => {
      const action = z
        .enum(["start", "pause", "skip", "end", "restart"])
        .parse(input);
      const { room, game } = authenticated(true);
      if (action === "start") game.start();
      else if (action === "pause") game.pause();
      else if (action === "skip") {
        if (game.paused) throw new Error("Resume before skipping the timer.");
        game.log("skip", { phase: game.phase });
        game.advance();
      } else if (action === "end") game.endEarly();
      else game.restart();
      broadcast(room);
    });
    handler("kick", (input) => {
      const id = z.string().uuid().parse(input),
        { room, game } = authenticated(true);
      game.kick(id);
      for (const [token, seat] of room.seats)
        if (seat.playerId === id) {
          room.seats.delete(token);
          if (seat.socketId) {
            io.to(seat.socketId).emit("removed");
            io.sockets.sockets.get(seat.socketId)?.disconnect(true);
          }
        }
      broadcast(room);
    });
    handler("choice", (input) => {
      const move = z.enum(["C", "D"]).parse(input),
        { room, game, seat } = authenticated();
      if (!seat.playerId) throw new Error("The host has no player seat.");
      game.choose(seat.playerId, move);
      broadcast(room);
    });
    handler("vote", (input) => {
      const id = z.string().uuid().parse(input),
        { room, game, seat } = authenticated();
      if (!seat.playerId) throw new Error("The host has no ballot.");
      game.vote(seat.playerId, id);
      broadcast(room);
    });
    handler("fill", () => {
      const { room, game } = authenticated(true);
      if (game.phase !== "LOBBY")
        throw new Error("Bots can only join in the lobby.");
      const aliases = [
        "Cipher",
        "Vesper",
        "Ghost",
        "Echo",
        "Rook",
        "Morse",
        "Onyx",
        "Sable",
        "Wren",
        "Atlas",
        "Flint",
        "Nova",
        "Shade",
        "Lark",
        "Fox",
        "Iris",
      ];
      let i = 0;
      while (game.players.length < 12) {
        let name = aliases[i++ % aliases.length];
        if (
          game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())
        )
          name = `Bot ${i}`;
        if (
          !game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())
        )
          game.addPlayer(name, true);
      }
      broadcast(room);
    });
    handler("export", (input) => {
      const format = z.enum(["json", "csv"]).parse(input),
        { game } = authenticated(true);
      return {
        filename: `double-agent-${game.code}.${format}`,
        content:
          format === "json"
            ? JSON.stringify(game.exportLog(), null, 2)
            : exportCsv(game),
      };
    });
    socket.on("disconnect", () => {
      const room = rooms.get(socket.data.code),
        seat = room?.seats.get(socket.data.token);
      if (room && seat?.socketId === socket.id) {
        seat.socketId = undefined;
        if (seat.playerId) room.game.player(seat.playerId).connected = false;
        broadcast(room);
      }
    });
  });
  return {
    app,
    http,
    io,
    rooms,
    close: async () => {
      clearInterval(ticker);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
