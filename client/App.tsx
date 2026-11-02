import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Crosshair,
  Fingerprint,
  Flag,
  LockKeyhole,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SkipForward,
  Users,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { RoomView } from "../shared/types";
import { useGame, type GameConnection } from "./useGame";
import {
  Brand,
  Briefing,
  Countdown,
  History,
  Modal,
  Payoff,
  Results,
  RoleCard,
  SettingsPanel,
  Tag,
} from "./components";

const phaseLabels = {
  LOBBY: "ASSEMBLING AGENTS",
  ROLE_REVEAL: "CLASSIFIED BRIEFING",
  PAIRING: "NEW ASSIGNMENTS",
  TALK: "TALK IT OUT",
  DECISION: "MAKE YOUR MOVE",
  REVEAL: "THE REVEAL",
  ACCUSATION: "FINAL ACCUSATIONS",
  RESULTS: "OPERATION COMPLETE",
};
export function App() {
  const game = useGame();
  const [briefing, setBriefing] = useState(false);
  const isPlayer = game.session?.kind === "player";
  return (
    <div className={`app-shell ${isPlayer ? "player-shell" : ""}`}>
      <header className="site-header">
        <Brand />
        <div className="header-right">
          <span className="header-classification">
            A GAME OF IMPERFECT INFORMATION
          </span>
          <button className="text-button" onClick={() => setBriefing(true)}>
            <CircleHelp size={17} />
            <span>Field manual</span>
          </button>
          <Tag active={game.connected}>
            {game.connected ? "SIGNAL LIVE" : "CONNECTING"}
          </Tag>
        </div>
      </header>
      {game.error && (
        <div className="error-banner" role="alert">
          <span>{game.error}</span>
          <button aria-label="Dismiss error" onClick={game.clearError}>
            <X size={16} />
          </button>
        </div>
      )}
      {game.room && game.session ? (
        <fieldset className="connection-fieldset" disabled={!game.connected}>
          {!game.connected && (
            <div className="reconnect-banner" role="status">
              Signal interrupted. Reconnecting to your seat…
            </div>
          )}
          {isPlayer ? <Player game={game} /> : <Host game={game} />}
        </fieldset>
      ) : (
        <Landing game={game} />
      )}
      <footer className="site-footer">
        <span>
          DOUBLE AGENT <i>/</i> TRUST IS A STRATEGY.
        </span>
        <span>NO ALIASES. NO ALIBIS. JUST GAME THEORY.</span>
      </footer>
      {briefing && (
        <Modal title="The field manual" close={() => setBriefing(false)}>
          <Briefing />
        </Modal>
      )}
    </div>
  );
}
function Landing({ game }: { game: GameConnection }) {
  const queryCode =
    new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "";
  const [code, setCode] = useState(queryCode),
    [name, setName] = useState("");
  const joining = location.pathname === "/join";
  function join(e: FormEvent) {
    e.preventDefault();
    void game.enter("join", {
      code: code.trim().toUpperCase(),
      name: name.trim(),
    });
  }
  const joinCard = (
    <section className="join-card panel">
      <div className="section-heading">
        <span className="eyebrow">ALREADY HAVE AN ASSIGNMENT?</span>
        <ArrowUpRight size={19} />
      </div>
      <h2>Join the operation.</h2>
      <form onSubmit={join}>
        <label>
          ROOM CODE
          <input
            className="code-input"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={4}
            value={code}
            placeholder="ABCD"
            required
            pattern="[A-Za-z]{4}"
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
            }
          />
        </label>
        <label>
          YOUR DISPLAY NAME
          <input
            maxLength={16}
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How should we call you?"
            required
          />
        </label>
        <button
          disabled={game.busy || !game.connected}
          className="button primary"
          type="submit"
        >
          Enter the room <ArrowRight size={18} />
        </button>
      </form>
      <p className="fine-print">
        <LockKeyhole size={13} />
        Your identity stays with this device.
      </p>
    </section>
  );
  if (joining)
    return (
      <main className="join-page">
        <span className="eyebrow">YOUR NEXT MOVE STARTS HERE</span>
        <h1>Welcome, agent.</h1>
        {joinCard}
        <p className="muted center">Keep this screen to yourself.</p>
      </main>
    );
  return (
    <main className="landing">
      <div className="landing-topline">
        <span className="eyebrow">
          <span className="red-square" />
          SOCIAL DEDUCTION / LIVE & IN PERSON
        </span>
        <span className="mono muted">FILE NO. 008 — THE TRUST EXPERIMENT</span>
      </div>
      <div className="landing-hero">
        <div className="hero-copy">
          <h1>
            Trust is a strategy.
            <br />
            <span>Betrayal is an art.</span>
          </h1>
          <p>
            A room full of allies. A few hidden enemies.
            <br />
            Eight rounds to find out which is which.
          </p>
          <button
            className="button primary hero-button"
            disabled={game.busy || !game.connected}
            onClick={() => void game.enter("create")}
          >
            Create an operation <ArrowRight size={20} />
          </button>
          <div className="hero-specs">
            <span>
              <Users size={16} />
              6–16 AGENTS
            </span>
            <span>
              <Radio size={16} />
              ONE ROOM
            </span>
            <span>
              <LockKeyhole size={15} />
              ZERO ACCOUNTS
            </span>
          </div>
        </div>
        <div className="dossier-art" aria-hidden="true">
          <div className="dossier-top">
            <span>INTELLIGENCE BUREAU</span>
            <span>DA / 08</span>
          </div>
          <div className="target-grid">
            <div className="target-circle outer" />
            <div className="target-circle inner" />
            <div className="cross-line horizontal" />
            <div className="cross-line vertical" />
            <Fingerprint className="hero-fingerprint" strokeWidth={0.65} />
            <div className="scan-label">IDENTITY UNCONFIRMED</div>
          </div>
          <div className="dossier-stamp">TRUST NO ONE</div>
          <div className="dossier-bottom">
            <span>
              SUBJECT: EVERYONE
              <br />
              LOYALTY: UNVERIFIED
            </span>
            <div className="barcode" />
          </div>
        </div>
      </div>
      <div className="landing-bottom">
        <section className="operation-brief">
          <span className="eyebrow">THE OPERATION, IN BRIEF</span>
          <h2>
            A handshake.
            <br />A hidden agenda.
          </h2>
          <div className="brief-steps">
            <div>
              <span>01</span>
              <div>
                <h3>Meet your partner.</h3>
                <p>
                  Make a deal. Make a promise. You’re paired with someone new
                  each round.
                </p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>Choose your move.</h3>
                <p>
                  Cooperate or defect. Your moves are public. Your motives
                  aren’t.
                </p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>Expose the double agents.</h3>
                <p>
                  Follow the evidence. Make your accusation. Find out who fooled
                  you.
                </p>
              </div>
            </div>
          </div>
        </section>
        {joinCard}
      </div>
    </main>
  );
}
function useJoinUrl(code: string) {
  const [origin, setOrigin] = useState(location.origin),
    [choices, setChoices] = useState<string[]>([]);
  useEffect(() => {
    void fetch("/api/network")
      .then((r) => r.json())
      .then((data: { addresses: string[]; joinOrigin: string | null }) => {
        const origins = data.addresses.map(
          (address) =>
            `${location.protocol}//${address}${location.port ? `:${location.port}` : ""}`,
        );
        if (data.joinOrigin) {
          setOrigin(data.joinOrigin.replace(/\/$/, ""));
          setChoices([data.joinOrigin]);
        } else {
          setChoices(origins);
          if (
            ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) &&
            origins[0]
          )
            setOrigin(origins[0]);
        }
      })
      .catch(() => {});
  }, []);
  return { url: `${origin}/join?room=${code}`, origin, setOrigin, choices };
}
function Host({ game }: { game: GameConnection }) {
  const room = game.room!,
    { url, origin, setOrigin, choices } = useJoinUrl(room.code);
  const [confirm, setConfirm] = useState<"end" | "restart" | null>(null),
    [copied, setCopied] = useState(false);
  const audio = useRef<AudioContext | null>(null),
    priorPhase = useRef(room.phase);
  useEffect(() => {
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      void audio.current?.close();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    if (
      room.phase !== priorPhase.current &&
      room.settings.sound &&
      audio.current?.state === "running"
    ) {
      const ctx = audio.current,
        oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = room.phase === "DECISION" ? 620 : 390;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);
    }
    priorPhase.current = room.phase;
  }, [room.phase, room.settings.sound]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this join link", url);
    }
  }
  async function download(format: "json" | "csv") {
    const result = await game.send<{ content: string; filename: string }>(
      "export",
      format,
    );
    if (!result) return;
    const objectUrl = URL.createObjectURL(
      new Blob([result.content], {
        type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = result.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return (
    <main className="host-main">
      <div className="operation-topline">
        <span className="eyebrow">
          HOST CONTROL <ChevronRight size={13} />
          <span>OPERATION {room.code}</span>
        </span>
        <span className="mono muted">
          {room.players.length.toString().padStart(2, "0")} AGENTS IN THE FIELD
        </span>
      </div>
      {room.phase === "LOBBY" ? (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow accent">
                THE CALM BEFORE THE BETRAYAL
              </span>
              <h1>Assemble your agents.</h1>
              <p>
                One room. Different loyalties. Invite everyone to the table.
              </p>
            </div>
            <Tag active>LOBBY OPEN</Tag>
          </div>
          <div className="lobby-layout">
            <div className="lobby-main">
              <section className="invite-panel">
                <div className="invite-content">
                  <span className="eyebrow">YOUR OPERATION CODE</span>
                  <div className="room-code">{room.code}</div>
                  <p>Scan to join. Keep your phone close.</p>
                  <button className="join-link" onClick={copy}>
                    <span>{url.replace(/^https?:\/\//, "")}</span>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  {choices.length > 1 && (
                    <label className="network-picker">
                      Network address
                      <select
                        aria-label="Join network address"
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                      >
                        {choices.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="qr-box">
                  <QRCodeSVG value={url} size={148} marginSize={1} level="M" />
                  <span>SCAN. JOIN. BLEND IN.</span>
                </div>
              </section>
              <section className="panel roster">
                <div className="section-heading">
                  <h2>
                    Agents on standby{" "}
                    <span className="count-pill">
                      {room.players.length} / 16
                    </span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => void game.send("fill")}
                    disabled={room.players.length >= 12}
                  >
                    <Bot size={16} />
                    Fill with bots
                  </button>
                </div>
                <div className="roster-grid">
                  {room.players.map((p, i) => (
                    <div className="agent-row" key={p.id}>
                      <span className="agent-avatar">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <b>{p.name}</b>
                        <span>
                          {p.bot
                            ? "SIMULATED AGENT"
                            : p.connected
                              ? "READY FOR ASSIGNMENT"
                              : "SIGNAL LOST"}
                        </span>
                      </div>
                      <i
                        className={`status-dot ${p.connected ? "online" : ""}`}
                      />
                      <button
                        className="kick-button"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => void game.send("kick", p.id)}
                      >
                        <X size={14} />
                      </button>
                      <span className="sr-only">Agent {i + 1}</span>
                    </div>
                  ))}
                  {room.players.length === 0 && (
                    <div className="roster-empty">
                      <ScanLine size={32} strokeWidth={1} />
                      <h3>Awaiting your first agent.</h3>
                      <p>Share the code or scan the QR to take a seat.</p>
                    </div>
                  )}
                </div>
                <div className="roster-footer">
                  <Users size={14} />
                  <span>
                    {room.players.length < 4
                      ? `${4 - room.players.length} more agents needed to start.`
                      : room.players.length < 6
                        ? "Ready, but 6 or more agents make a better operation."
                        : "All set. Someone in this room is about to have a secret."}
                  </span>
                </div>
              </section>
              <div className="launch-row">
                <div>
                  <span className="eyebrow">ONCE YOU BEGIN</span>
                  <p>Roles are assigned. Loyalties are tested.</p>
                </div>
                <button
                  className="button primary"
                  disabled={room.players.length < 4}
                  onClick={() => void game.send("control", "start")}
                >
                  Begin operation <ArrowRight size={18} />
                </button>
              </div>
            </div>
            <SettingsPanel
              settings={room.settings}
              onChange={(s) => void game.send("settings", s)}
            />
          </div>
        </>
      ) : room.phase === "RESULTS" ? (
        <Results room={room} download={download} />
      ) : (
        <HostRound room={room} offset={game.offset.current} />
      )}
      {room.phase !== "LOBBY" && (
        <div className="host-controls">
          <span className="eyebrow">
            <Crosshair size={14} /> HOST CONTROLS
          </span>
          {room.phase !== "RESULTS" && (
            <>
              <button
                className="button secondary"
                onClick={() => void game.send("control", "pause")}
              >
                {room.paused ? <Play size={16} /> : <Pause size={16} />}
                {room.paused ? "Resume" : "Pause"}
              </button>
              <button
                className="button secondary"
                disabled={room.paused}
                onClick={() => void game.send("control", "skip")}
              >
                <SkipForward size={16} />
                {room.phase === "ACCUSATION" ? "Close voting" : "Skip timer"}
              </button>
              {room.phase !== "ACCUSATION" && (
                <button
                  className="text-button danger"
                  onClick={() => setConfirm("end")}
                >
                  <Flag size={15} />
                  End early
                </button>
              )}
            </>
          )}
          <button
            className="text-button restart"
            onClick={() => setConfirm("restart")}
          >
            <RotateCcw size={15} />
            Restart
          </button>
        </div>
      )}
      {confirm && (
        <Modal
          title={
            confirm === "end"
              ? "Go to final accusations?"
              : "Start a fresh operation?"
          }
          close={() => setConfirm(null)}
        >
          <p>
            {confirm === "end"
              ? "Completed rounds count. Any current unrevealed round is discarded. Everyone will make their final accusation."
              : "This clears scores and the current game log, and returns all seats to the lobby. Export your results first if you want to keep them."}
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                void game.send("control", confirm);
                setConfirm(null);
              }}
            >
              {confirm === "end" ? "Open accusations" : "Restart operation"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
function HostRound({ room, offset }: { room: RoomView; offset: number }) {
  const name = (id: string) => room.players.find((p) => p.id === id)?.name;
  const revealed = room.phase === "REVEAL" ? room.history.at(-1) : undefined;
  return (
    <>
      <section className="round-heading">
        <div>
          <span className="eyebrow accent">
            {room.phase === "ROLE_REVEAL"
              ? "THE OPERATION BEGINS"
              : room.phase === "ACCUSATION"
                ? "THE FINAL CALL"
                : `ROUND ${String(room.round).padStart(2, "0")} / ${String(room.settings.rounds).padStart(2, "0")}`}
          </span>
          <h1>{phaseLabels[room.phase].toLowerCase()}.</h1>
          <p>
            {room.phase === "TALK"
              ? "Find your partner. Make your case. Choose who to trust."
              : room.phase === "DECISION"
                ? "Make your choice on your phone. Silence says nothing."
                : room.phase === "REVEAL"
                  ? "Promises are one thing. Decisions are another."
                  : room.phase === "ROLE_REVEAL"
                    ? "Check your phone. Hold to reveal your private assignment."
                    : room.phase === "ACCUSATION"
                      ? "Discuss the evidence. Each agent names one suspected Saboteur on their phone."
                      : "New partners. New possibilities."}
          </p>
        </div>
        <Countdown room={room} offset={offset} />
      </section>
      {room.phase === "ROLE_REVEAL" ? (
        <div className="classified-hero">
          <Fingerprint size={90} strokeWidth={0.7} />
          <h2>Your assignment is classified.</h2>
          <p>
            Roles and scores never appear on this screen before the final
            results.
          </p>
          <div className="classified-counts">
            <span>
              {room.players.length -
                Math.max(1, Math.floor(room.players.length / 4))}{" "}
              LOYAL AGENTS
            </span>
            <span>
              {Math.max(1, Math.floor(room.players.length / 4))} SABOTEURS
            </span>
          </div>
        </div>
      ) : room.phase === "ACCUSATION" ? (
        <section className="accusation-host panel">
          <Crosshair size={40} strokeWidth={1} />
          <h2>Who played you?</h2>
          <p>One accusation. No self-votes. Keep your ballot private.</p>
          <strong>
            {room.voteCount}
            <span> / {room.players.length}</span>
          </strong>
          <span className="eyebrow">SECRET BALLOTS RECEIVED</span>
        </section>
      ) : (
        <>
          <div className="pairing-topline">
            <span className="eyebrow">FIELD ASSIGNMENTS</span>
            {room.phase === "DECISION" ? (
              <span className="decision-counter">
                <LockKeyhole size={16} />
                <b>
                  {room.lockedCount} /{" "}
                  {room.players.length - (room.bye ? 1 : 0)}
                </b>{" "}
                locked in <small>· editable until time ends</small>
              </span>
            ) : (
              <span className="mono muted">
                {room.pairs.length} PAIRS{room.bye ? " + 1 BYE" : ""}
              </span>
            )}
          </div>
          <div className="pair-grid">
            {room.pairs.map(([a, b], i) => (
              <div
                className={`pair-card ${revealed ? "is-revealed" : ""}`}
                key={`${room.round}-${a}`}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="pair-number">
                  PAIR {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pair-agents">
                  <div>
                    <b>{name(a)}</b>
                    {revealed && <MoveBadge move={revealed.moves[a]} />}
                  </div>
                  <span className="pair-divider">{revealed ? "×" : "↔"}</span>
                  <div>
                    <b>{name(b)}</b>
                    {revealed && <MoveBadge move={revealed.moves[b]} />}
                  </div>
                </div>
                {!revealed && (
                  <div className="pair-status">
                    {room.phase === "TALK"
                      ? "OPEN CHANNEL / TALK FREELY"
                      : room.phase === "DECISION"
                        ? "DECISIONS CLASSIFIED"
                        : "PARTNER ASSIGNED"}
                  </div>
                )}
              </div>
            ))}
          </div>
          {room.bye && (
            <div className="bye-notice">
              OFF THE GRID THIS ROUND <b>{name(room.bye)}</b>
              <span>Bye · 0 points · watch and listen.</span>
            </div>
          )}
        </>
      )}
      {room.phase !== "ROLE_REVEAL" && <History room={room} />}
    </>
  );
}
function MoveBadge({ move }: { move?: string }) {
  return (
    <span className={`move-badge ${move}`}>
      {move === "C" ? <ShieldCheck size={16} /> : <Crosshair size={16} />}
      <b>{move}</b>
      {move === "C" ? "COOPERATE" : "DEFECT"}
    </span>
  );
}

function Player({ game }: { game: GameConnection }) {
  const room = game.room!,
    self = room.self!,
    me = room.players.find((p) => p.id === self.id)!;
  const partnerId = room.pairs
    .find((pair) => pair.includes(self.id))
    ?.find((id) => id !== self.id);
  const partner = room.players.find((p) => p.id === partnerId);
  const [vote, setVote] = useState(""),
    [sendingVote, setSendingVote] = useState(false);
  const [sendingMove, setSendingMove] = useState(false);
  useEffect(() => {
    setVote(self.vote ?? "");
  }, [self.vote, room.phase]);
  const bye = room.bye === self.id;
  async function castVote() {
    setSendingVote(true);
    await game.send("vote", vote);
    setSendingVote(false);
  }
  return (
    <main className="player-main">
      <div className="player-identity">
        <span className="eyebrow">
          AGENT <b>{me.name}</b>
        </span>
        <span className="mono">{room.code}</span>
      </div>
      {room.phase === "LOBBY" ? (
        <>
          <div className="player-welcome">
            <div className="welcome-symbol">
              <Fingerprint size={65} strokeWidth={1} />
            </div>
            <Tag active>YOU’RE IN</Tag>
            <h1>
              Stay sharp,
              <br />
              {me.name}.
            </h1>
            <p>
              Waiting for the host to begin.
              <br />
              Your assignment arrives soon.
            </p>
          </div>
          <section className="panel">
            <span className="eyebrow">
              AGENTS ON STANDBY / {room.players.length}
            </span>
            <div className="player-roster">
              {room.players.map((p) => (
                <span key={p.id}>
                  <i className={`status-dot ${p.connected ? "online" : ""}`} />
                  {p.name}
                  {p.id === self.id && <small>YOU</small>}
                </span>
              ))}
            </div>
          </section>
          <div className="note">
            <LockKeyhole size={18} />
            Keep this device close. Your role is for your eyes only.
          </div>
        </>
      ) : room.phase === "RESULTS" ? (
        <Results room={room} />
      ) : (
        <>
          <div className="player-phase">
            <span className="eyebrow accent">
              {room.phase === "ACCUSATION"
                ? "FINAL ACCUSATIONS"
                : `ROUND ${String(room.round || 1).padStart(2, "0")} / ${room.settings.rounds}`}
            </span>
            <Countdown room={room} offset={game.offset.current} small />
          </div>
          {room.phase === "ROLE_REVEAL" ? (
            <div className="player-welcome">
              <LockKeyhole size={44} strokeWidth={1} />
              <h1>
                You have
                <br />
                an assignment.
              </h1>
              <p>
                Hold the button below to see your role.
                <br />
                Make sure no one is looking.
              </p>
              <RoleCard room={room} />
            </div>
          ) : room.phase === "ACCUSATION" ? (
            <section className="player-voting">
              <h1>
                Name your
                <br />
                suspect.
              </h1>
              <p>
                Choose exactly one other agent. You can change your ballot until
                time runs out.
              </p>
              <div className="vote-options">
                {room.players
                  .filter((p) => p.id !== self.id)
                  .map((p) => (
                    <button
                      aria-pressed={vote === p.id}
                      className={vote === p.id ? "selected" : ""}
                      key={p.id}
                      onClick={() => setVote(p.id)}
                      disabled={room.paused}
                    >
                      <span className="agent-avatar">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                      {p.name}
                      <span className="radio-circle">
                        {vote === p.id && <Check size={14} />}
                      </span>
                    </button>
                  ))}
              </div>
              <button
                className="button primary full-width"
                onClick={() => void castVote()}
                disabled={
                  !vote || room.paused || sendingVote || self.vote === vote
                }
              >
                {self.vote === vote ? (
                  <>
                    <Check size={18} />
                    Ballot confirmed
                  </>
                ) : (
                  <>
                    Confirm accusation <ArrowRight size={18} />
                  </>
                )}
              </button>
              {self.vote && (
                <p className="vote-confirmation">
                  Your saved ballot:{" "}
                  {room.players.find((p) => p.id === self.vote)?.name}
                </p>
              )}
              <p className="fine-print">
                No ballot at the deadline? The server assigns a random other
                agent.
              </p>
            </section>
          ) : (
            <>
              <section className="partner-panel">
                <span className="eyebrow">
                  {bye ? "YOU’RE OFF THE GRID" : "YOUR PARTNER THIS ROUND"}
                </span>
                <h1>
                  {bye
                    ? "A moment to observe."
                    : (partner?.name ?? "Finding your partner…")}
                </h1>
                <p>
                  {bye
                    ? "You have a bye. No move and no points this round."
                    : room.phase === "TALK"
                      ? "Make your case. Listen closely."
                      : room.phase === "PAIRING"
                        ? "Find each other. The talk phase starts shortly."
                        : room.phase === "REVEAL"
                          ? "The choices are out in the open."
                          : "One choice. Two possible motives."}
                </p>
              </section>
              {!bye && ["TALK", "DECISION", "PAIRING"].includes(room.phase) && (
                <>
                  <div className="choice-buttons">
                    {(["C", "D"] as const).map((move) => (
                      <button
                        key={move}
                        aria-pressed={self.choice === move}
                        className={`choice-button ${move} ${self.choice === move ? "selected" : ""}`}
                        disabled={
                          room.phase !== "DECISION" ||
                          room.paused ||
                          sendingMove
                        }
                        onClick={async () => {
                          setSendingMove(true);
                          await game.send("choice", move);
                          setSendingMove(false);
                        }}
                      >
                        <span className="choice-icon">
                          {move === "C" ? (
                            <ShieldCheck size={30} />
                          ) : (
                            <Crosshair size={30} />
                          )}
                        </span>
                        <span>
                          <b>{move === "C" ? "COOPERATE" : "DEFECT"}</b>
                          <small>
                            {move === "C"
                              ? "Extend a little trust."
                              : "Look out for yourself."}
                          </small>
                        </span>
                        <span className="choice-letter">
                          {self.choice === move ? <Check /> : move}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="selection-note" role="status">
                    {room.paused
                      ? "Paused. Choices are frozen."
                      : room.phase !== "DECISION"
                        ? "Choices open when the talk phase ends."
                        : self.choice
                          ? `${self.choice === "C" ? "Cooperate" : "Defect"} saved. You can still change your mind.`
                          : "No move selected. No response defaults to Cooperate."}
                  </p>
                </>
              )}
              {room.phase === "REVEAL" && self.lastResult && (
                <section className="private-result panel">
                  <span className="eyebrow">YOUR PRIVATE ROUND RESULT</span>
                  {!self.lastResult.bye && (
                    <div className="your-moves">
                      <div>
                        <small>YOU</small>
                        <MoveBadge move={self.lastResult.myMove} />
                      </div>
                      <div>
                        <small>{partner?.name}</small>
                        <MoveBadge move={self.lastResult.partnerMove} />
                      </div>
                    </div>
                  )}
                  <div className="points-earned">
                    +{self.lastResult.points}
                    <span>POINTS THIS ROUND</span>
                  </div>
                  <p>
                    {self.lastResult.bye
                      ? "An observation round. Your total is unchanged."
                      : "Scored using your private assignment."}
                  </p>
                </section>
              )}
              {room.phase === "TALK" && (
                <details className="payoff-details">
                  <summary>Review the base payoffs</summary>
                  <Payoff />
                </details>
              )}
            </>
          )}
          <div className="private-total">
            <span>
              <LockKeyhole size={14} />
              YOUR PRIVATE TOTAL
            </span>
            <strong>
              {self.score}
              <small> PTS</small>
            </strong>
          </div>
          {room.phase !== "ROLE_REVEAL" && <RoleCard room={room} />}
          {room.history.length > 0 && (
            <details className="player-history">
              <summary>Review the public evidence</summary>
              <History room={room} />
            </details>
          )}
        </>
      )}
    </main>
  );
}
