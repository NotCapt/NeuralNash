export type Role = "LOYAL" | "SABOTEUR";
export type Move = "C" | "D";
export type Phase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "PAIRING"
  | "TALK"
  | "DECISION"
  | "REVEAL"
  | "ACCUSATION"
  | "RESULTS";
export interface Settings {
  rounds: number;
  talkSeconds: number;
  decisionSeconds: number;
  accusationSeconds: number;
  saboteursKnowEachOther: boolean;
  sound: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  rounds: 8,
  talkSeconds: 60,
  decisionSeconds: 20,
  accusationSeconds: 90,
  saboteursKnowEachOther: false,
  sound: true,
};
export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  bot: boolean;
}
export interface RoundHistory {
  round: number;
  pairs: [string, string][];
  bye: string | null;
  moves: Record<string, Move>;
}
export interface ResultPlayer extends PublicPlayer {
  role: Role;
  score: number;
  bonus: number;
  vote: string;
  accusations: number;
}
export interface Results {
  players: ResultPlayer[];
  loyalRanking: ResultPlayer[];
  saboteurRanking: ResultPlayer[];
  cooperation: { overall: number; loyal: number; saboteur: number };
  mostAccused: string[];
  caught: number;
}
export interface PrivateState {
  id: string;
  role?: Role;
  score: number;
  choice?: Move;
  vote?: string;
  allies?: string[];
  lastResult?: {
    round: number;
    points: number;
    myMove?: Move;
    partnerMove?: Move;
    bye: boolean;
  };
}
export interface RoomView {
  code: string;
  phase: Phase;
  settings: Settings;
  players: PublicPlayer[];
  round: number;
  pairs: [string, string][];
  bye: string | null;
  history: RoundHistory[];
  lockedCount: number;
  voteCount: number;
  serverNow: number;
  deadline: number | null;
  paused: boolean;
  remainingMs: number;
  self?: PrivateState;
  results?: Results;
}
export interface Session {
  code: string;
  token: string;
  kind: "host" | "player";
}
export type Reply<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };
