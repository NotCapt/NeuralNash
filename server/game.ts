import { randomUUID } from "node:crypto";
import {
  DEFAULT_SETTINGS,
  type Move,
  type Phase,
  type Results,
  type Role,
  type RoomView,
  type RoundHistory,
  type Settings,
} from "../shared/types.js";
import {
  accusationBonuses,
  pairKey,
  pairPlayers,
  saboteurCount,
  scorePair,
  shuffle,
} from "./rules.js";

export interface Player {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  role: Role;
  score: number;
  bonus: number;
  vote?: string;
  lastResult?: {
    round: number;
    points: number;
    myMove?: Move;
    partnerMove?: Move;
    bye: boolean;
  };
}
export interface LogEntry {
  at: string;
  event: string;
  data: unknown;
}
export class Game {
  players: Player[] = [];
  phase: Phase = "LOBBY";
  settings: Settings = { ...DEFAULT_SETTINGS };
  round = 0;
  pairs: [string, string][] = [];
  bye: string | null = null;
  history: RoundHistory[] = [];
  choices: Record<string, Move> = {};
  meetings: Record<string, number> = {};
  byes: Record<string, number> = {};
  logs: LogEntry[] = [];
  deadline: number | null = null;
  paused = false;
  remainingMs = 0;
  results?: Results;
  constructor(
    public code: string,
    public random = Math.random,
    public now = () => Date.now(),
  ) {
    this.log("transition", { from: null, to: "LOBBY" });
  }
  log(event: string, data: unknown) {
    this.logs.push({ at: new Date(this.now()).toISOString(), event, data });
  }
  player(id: string) {
    const p = this.players.find((p) => p.id === id);
    if (!p) throw new Error("Seat not found. Join again.");
    return p;
  }
  addPlayer(name: string, bot = false) {
    if (this.phase !== "LOBBY")
      throw new Error("This operation has already started.");
    if (this.players.length >= 16)
      throw new Error("The room is full (16 agents maximum).");
    name = name.trim();
    if (!name || [...name].length > 16 || /[\p{Cc}\p{Cf}]/u.test(name))
      throw new Error("Use a name with 1–16 visible characters.");
    if (
      this.players.some(
        (p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw new Error("That name is taken. Choose another.");
    const p: Player = {
      id: randomUUID(),
      name,
      bot,
      connected: true,
      role: "LOYAL",
      score: 0,
      bonus: 0,
    };
    this.players.push(p);
    this.log("join", { id: p.id, name, bot });
    return p;
  }
  kick(id: string) {
    if (this.phase !== "LOBBY")
      throw new Error("Agents can only be removed in the lobby.");
    this.player(id);
    this.players = this.players.filter((p) => p.id !== id);
    this.log("kick", { id });
  }
  configure(settings: Settings) {
    if (this.phase !== "LOBBY")
      throw new Error("Settings are locked during the operation.");
    this.settings = { ...settings };
    this.log("settings", this.settings);
  }
  transition(phase: Phase, seconds: number | null) {
    const from = this.phase;
    this.phase = phase;
    this.remainingMs = (seconds ?? 0) * 1000;
    this.deadline =
      seconds === null || this.paused ? null : this.now() + this.remainingMs;
    this.log("transition", { from, to: phase, round: this.round });
  }
  start() {
    if (this.phase !== "LOBBY") throw new Error("Game already started.");
    if (this.players.length < 4)
      throw new Error("At least 4 agents are required.");
    const spies = new Set(
      shuffle(this.players, this.random)
        .slice(0, saboteurCount(this.players.length))
        .map((p) => p.id),
    );
    this.players.forEach((p) => {
      p.role = spies.has(p.id) ? "SABOTEUR" : "LOYAL";
    });
    this.log(
      "roles",
      this.players.map((p) => ({ id: p.id, role: p.role })),
    );
    this.transition("ROLE_REVEAL", 12);
  }
  startRound() {
    this.round++;
    this.choices = {};
    const pairing = pairPlayers(
      this.players.map((p) => p.id),
      this.meetings,
      this.byes,
      this.random,
    );
    this.pairs = pairing.pairs;
    this.bye = pairing.bye;
    for (const [a, b] of this.pairs)
      this.meetings[pairKey(a, b)] = (this.meetings[pairKey(a, b)] ?? 0) + 1;
    if (this.bye) this.byes[this.bye] = (this.byes[this.bye] ?? 0) + 1;
    this.log("pairing", { round: this.round, ...pairing });
    this.transition("PAIRING", 2);
  }
  choose(id: string, move: Move) {
    this.player(id);
    if (
      this.phase !== "DECISION" ||
      this.paused ||
      this.deadline === null ||
      this.now() >= this.deadline
    )
      throw new Error("The decision window is closed.");
    if (id === this.bye) throw new Error("You have a bye this round.");
    this.choices[id] = move;
    this.log("choice", { round: this.round, id, move });
  }
  vote(id: string, target: string) {
    const p = this.player(id);
    this.player(target);
    if (
      this.phase !== "ACCUSATION" ||
      this.paused ||
      this.deadline === null ||
      this.now() >= this.deadline
    )
      throw new Error("Voting is closed.");
    if (id === target) throw new Error("Choose another agent.");
    p.vote = target;
    this.log("vote", { id, target });
  }
  reveal() {
    const moves: Record<string, Move> = {};
    for (const [a, b] of this.pairs) {
      const pa = this.player(a),
        pb = this.player(b);
      const ma = this.choices[a] ?? "C",
        mb = this.choices[b] ?? "C";
      const [sa, sb] = scorePair(ma, mb, pa.role, pb.role);
      moves[a] = ma;
      moves[b] = mb;
      pa.score += sa;
      pb.score += sb;
      pa.lastResult = {
        round: this.round,
        points: sa,
        myMove: ma,
        partnerMove: mb,
        bye: false,
      };
      pb.lastResult = {
        round: this.round,
        points: sb,
        myMove: mb,
        partnerMove: ma,
        bye: false,
      };
      this.log("round_score", {
        round: this.round,
        players: [
          {
            id: a,
            role: pa.role,
            move: ma,
            points: sa,
            total: pa.score,
            timedOut: !this.choices[a],
          },
          {
            id: b,
            role: pb.role,
            move: mb,
            points: sb,
            total: pb.score,
            timedOut: !this.choices[b],
          },
        ],
      });
    }
    if (this.bye) {
      const p = this.player(this.bye);
      p.lastResult = { round: this.round, points: 0, bye: true };
      this.log("bye", {
        round: this.round,
        id: p.id,
        role: p.role,
        points: 0,
        total: p.score,
      });
    }
    this.history.push({
      round: this.round,
      pairs: this.pairs.map((p) => [...p]),
      bye: this.bye,
      moves,
    });
    this.transition("REVEAL", 7);
  }
  finish() {
    // Exactly one ballot per seat, including offline seats. Defaults are audited.
    for (const p of this.players)
      if (!p.vote) {
        p.vote = shuffle(
          this.players.filter((other) => other.id !== p.id),
          this.random,
        )[0].id;
        this.log("vote", { id: p.id, target: p.vote, timedOut: true });
      }
    const bonus = accusationBonuses(this.players);
    this.players.forEach((p) => {
      p.bonus = bonus[p.id];
      p.score += p.bonus;
    });
    this.results = this.computeResults();
    this.log("final_scores", this.results.players);
    this.transition("RESULTS", null);
  }
  advance() {
    switch (this.phase) {
      case "ROLE_REVEAL":
        this.startRound();
        break;
      case "PAIRING":
        this.transition("TALK", this.settings.talkSeconds);
        break;
      case "TALK":
        this.transition("DECISION", this.settings.decisionSeconds);
        break;
      case "DECISION":
        this.reveal();
        break;
      case "REVEAL":
        if (this.round < this.settings.rounds) this.startRound();
        else this.transition("ACCUSATION", this.settings.accusationSeconds);
        break;
      case "ACCUSATION":
        this.finish();
        break;
    }
  }
  tick() {
    if (!this.paused && this.deadline !== null && this.now() >= this.deadline) {
      this.advance();
      return true;
    }
    return false;
  }
  pause() {
    if (this.phase === "LOBBY" || this.phase === "RESULTS")
      throw new Error("No active timer.");
    if (this.paused) {
      this.deadline = this.now() + this.remainingMs;
      this.paused = false;
    } else {
      this.remainingMs = Math.max(
        0,
        (this.deadline ?? this.now()) - this.now(),
      );
      this.deadline = null;
      this.paused = true;
    }
    this.log(this.paused ? "pause" : "resume", {
      remainingMs: this.remainingMs,
    });
  }
  endEarly() {
    if (["LOBBY", "RESULTS", "ACCUSATION"].includes(this.phase))
      throw new Error("Cannot end this phase early.");
    this.log("end_early", {
      completedRounds: this.history.length,
      discardedRound: this.phase === "REVEAL" ? null : this.round,
    });
    this.choices = {};
    this.pairs = [];
    this.bye = null;
    this.paused = false;
    this.transition("ACCUSATION", this.settings.accusationSeconds);
  }
  restart() {
    this.players.forEach((p) => {
      p.role = "LOYAL";
      p.score = 0;
      p.bonus = 0;
      delete p.vote;
      delete p.lastResult;
    });
    this.round = 0;
    this.history = [];
    this.pairs = [];
    this.bye = null;
    this.choices = {};
    this.meetings = {};
    this.byes = {};
    this.results = undefined;
    this.paused = false;
    this.logs = [];
    this.transition("LOBBY", null);
  }
  computeResults(): Results {
    const players = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      bot: p.bot,
      role: p.role,
      score: p.score,
      bonus: p.bonus,
      vote: p.vote!,
      accusations: this.players.filter((v) => v.vote === p.id).length,
    }));
    const rate = (role?: Role) => {
      const moves = this.history.flatMap((h) =>
        Object.entries(h.moves)
          .filter(([id]) => !role || this.player(id).role === role)
          .map(([, m]) => m),
      );
      return moves.length
        ? moves.filter((m) => m === "C").length / moves.length
        : 0;
    };
    const max = Math.max(...players.map((p) => p.accusations));
    const loyal = players.filter((p) => p.role === "LOYAL");
    return {
      players,
      loyalRanking: loyal.slice().sort((a, b) => b.score - a.score),
      saboteurRanking: players
        .filter((p) => p.role === "SABOTEUR")
        .sort((a, b) => b.score - a.score),
      cooperation: {
        overall: rate(),
        loyal: rate("LOYAL"),
        saboteur: rate("SABOTEUR"),
      },
      mostAccused: players
        .filter((p) => p.accusations === max)
        .map((p) => p.id),
      caught: players.filter(
        (p) =>
          p.role === "SABOTEUR" &&
          loyal.filter((v) => v.vote === p.id).length > loyal.length / 2,
      ).length,
    };
  }
  // SECURITY BOUNDARY: all live state is built from explicit allowlists.
  // Never serialize Game/Player directly, even for the host.
  view(selfId?: string): RoomView {
    const view: RoomView = {
      code: this.code,
      phase: this.phase,
      settings: { ...this.settings },
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        bot: p.bot,
        connected: p.connected,
      })),
      round: this.round,
      pairs: this.pairs.map((p) => [...p]),
      bye: this.bye,
      history: this.history.map((h) => ({
        ...h,
        pairs: h.pairs.map((p) => [...p]),
        moves: { ...h.moves },
      })),
      lockedCount:
        this.phase === "DECISION" ? Object.keys(this.choices).length : 0,
      voteCount:
        this.phase === "ACCUSATION"
          ? this.players.filter((p) => p.vote).length
          : 0,
      serverNow: this.now(),
      deadline: this.deadline,
      paused: this.paused,
      remainingMs: this.paused
        ? this.remainingMs
        : Math.max(0, (this.deadline ?? this.now()) - this.now()),
    };
    if (selfId) {
      const p = this.player(selfId);
      view.self = { id: p.id, score: p.score };
      if (this.phase !== "LOBBY") {
        view.self.role = p.role;
        view.self.choice = this.choices[p.id];
        view.self.vote = p.vote;
        view.self.lastResult = p.lastResult ? { ...p.lastResult } : undefined;
        if (p.role === "SABOTEUR" && this.settings.saboteursKnowEachOther)
          view.self.allies = this.players
            .filter((other) => other.role === "SABOTEUR" && other.id !== p.id)
            .map((other) => other.id);
      }
    }
    if (this.phase === "RESULTS") view.results = this.results;
    return view;
  }
  exportLog() {
    if (this.phase !== "RESULTS")
      throw new Error("Logs are sealed until results.");
    return {
      schemaVersion: 1,
      code: this.code,
      settings: this.settings,
      exportedAt: new Date(this.now()).toISOString(),
      players: this.results!.players,
      rounds: this.history,
      results: this.results,
      events: this.logs,
    };
  }
}
