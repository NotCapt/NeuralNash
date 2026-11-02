import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  Crosshair,
  Eye,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import type { RoomView, Settings } from "../shared/types";

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Double Agent home">
      <div className="brand-mark">
        <Fingerprint size={27} strokeWidth={1.4} />
      </div>
      <span>
        DOUBLE<span className="brand-light">AGENT</span>
        <small>DEPARTMENT OF GAME THEORY</small>
      </span>
    </a>
  );
}
export function Tag({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span className={`tag ${active ? "active" : ""}`}>
      <i />
      {children}
    </span>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Briefing() {
  return (
    <div className="briefing">
      <p className="lead">
        Everyone has a partner.
        <br />
        Not everyone has your interests.
      </p>
      <p>
        Each round, talk with your partner, then secretly cooperate or defect.
        Moves become public. Your role and score stay private.
      </p>
      <Payoff />
      <div className="role-explain">
        <ShieldCheck />
        <div>
          <b>Loyal agents</b>
          <p>Earn your own payoff. Identify a Saboteur at the end for +3.</p>
        </div>
      </div>
      <div className="role-explain">
        <Crosshair />
        <div>
          <b>Saboteurs</b>
          <p>
            Earn 5 minus your partner’s payoff. Gain +2 for each Loyal who does
            not accuse you.
          </p>
        </div>
      </div>
      <p className="muted">
        One secret accusation each. Two separate rankings. Trust carefully.
      </p>
    </div>
  );
}
export function Payoff() {
  return (
    <div className="payoff-table">
      <div />
      <span>THEY C</span>
      <span>THEY D</span>
      <span>YOU C</span>
      <b>
        3 <small>/ 3</small>
      </b>
      <b>
        0 <small>/ 5</small>
      </b>
      <span>YOU D</span>
      <b>
        5 <small>/ 0</small>
      </b>
      <b>
        1 <small>/ 1</small>
      </b>
      <p>Base payoffs · you / partner</p>
    </div>
  );
}
export function Countdown({
  room,
  offset,
  small = false,
}: {
  room: RoomView;
  offset: number;
  small?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.ceil(
      (room.paused
        ? room.remainingMs
        : (room.deadline ?? now + offset) - now - offset) / 1000,
    ),
  );
  return (
    <div
      className={`countdown ${small ? "small" : ""} ${seconds <= 5 ? "urgent" : ""}`}
    >
      <span>
        {String(Math.floor(seconds / 60)).padStart(2, "0")}
        <em>:</em>
        {String(seconds % 60).padStart(2, "0")}
      </span>
      <small>{room.paused ? "OPERATION PAUSED" : "TIME REMAINING"}</small>
    </div>
  );
}
export function History({ room }: { room: RoomView }) {
  return (
    <section className="panel history-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE PAPER TRAIL</span>
          <h2>Public move history</h2>
        </div>
        <span className="mono muted">
          C / COOPERATE &nbsp; D / DEFECT &nbsp; — / BYE
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>AGENT</th>
              {Array.from({ length: room.settings.rounds }, (_, i) => (
                <th key={i}>{String(i + 1).padStart(2, "0")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {room.players.map((p) => {
              const role = room.results?.players.find(
                (r) => r.id === p.id,
              )?.role;
              return (
                <tr key={p.id} className={role ? role.toLowerCase() : ""}>
                  <th>
                    {p.name}
                    {role && <small>{role}</small>}
                  </th>
                  {Array.from({ length: room.settings.rounds }, (_, i) => {
                    const h = room.history.find((h) => h.round === i + 1),
                      move = h?.moves[p.id];
                    return (
                      <td key={i}>
                        <span className={`move-cell ${move ?? ""}`}>
                          {move ?? (h?.bye === p.id ? "—" : "·")}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!room.history.length && (
        <p className="empty-note">
          Every decision leaves a trace. The first round starts the record.
        </p>
      )}
    </section>
  );
}
export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  return (
    <section className="panel settings-panel">
      <span className="eyebrow">OPERATION PARAMETERS</span>
      <h2>Set the stakes.</h2>
      <p className="muted">A little pressure changes everything.</p>
      {(
        [
          { key: "rounds", title: "Rounds", min: 5, max: 12, suffix: "" },
          {
            key: "talkSeconds",
            title: "Talk phase",
            min: 0,
            max: 180,
            suffix: "s",
          },
          {
            key: "decisionSeconds",
            title: "Decision phase",
            min: 5,
            max: 120,
            suffix: "s",
          },
          {
            key: "accusationSeconds",
            title: "Final discussion",
            min: 15,
            max: 180,
            suffix: "s",
          },
        ] as const
      ).map((field) => (
        <label className="setting-row" key={field.key}>
          <span>
            {field.title}
            <small>
              {field.min}–{field.max}
              {field.suffix}
            </small>
          </span>
          <SettingNumber
            title={field.title}
            min={field.min}
            max={field.max}
            suffix={field.suffix}
            value={settings[field.key]}
            onCommit={(n) => onChange({ ...settings, [field.key]: n })}
          />
        </label>
      ))}
      <label className="setting-row toggle-row">
        <span>
          Saboteurs know each other<small>Allow a little conspiracy</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={settings.saboteursKnowEachOther}
          onChange={(e) =>
            onChange({ ...settings, saboteursKnowEachOther: e.target.checked })
          }
        />
      </label>
      <label className="setting-row toggle-row">
        <span>
          Sound cues<small>On this host screen</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={settings.sound}
          onChange={(e) => onChange({ ...settings, sound: e.target.checked })}
        />
      </label>
      <div className="note">
        <LockKeyhole size={16} />
        <span>Roles and scores stay private until the final reveal.</span>
      </div>
    </section>
  );
}
function SettingNumber({
  title,
  min,
  max,
  suffix,
  value,
  onCommit,
}: {
  title: string;
  min: number;
  max: number;
  suffix: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div className="number-input">
      <input
        aria-label={title}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={() => {
          const n = Number(draft);
          if (draft.trim() && Number.isInteger(n) && n >= min && n <= max) {
            if (n !== value) onCommit(n);
          } else setDraft(String(value));
        }}
      />
      <span>{suffix}</span>
    </div>
  );
}
export function RoleCard({ room }: { room: RoomView }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const hide = () => setVisible(false);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  if (!room.self?.role) return null;
  return (
    <div className="private-role">
      <button
        className="role-hold"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setVisible(true);
        }}
        onPointerUp={() => setVisible(false)}
        onPointerCancel={() => setVisible(false)}
        onLostPointerCapture={() => setVisible(false)}
        onBlur={() => setVisible(false)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setVisible(true);
          }
        }}
        onKeyUp={() => setVisible(false)}
      >
        <Eye size={18} />
        Hold to view my role
        <LockKeyhole size={13} />
      </button>
      {visible && (
        <div
          className={`role-card ${room.self.role.toLowerCase()}`}
          role="status"
        >
          <span className="eyebrow">FOR YOUR EYES ONLY</span>
          <h2 className="stamp">{room.self.role}</h2>
          <p>
            {room.self.role === "LOYAL"
              ? "You score your own base payoff."
              : "You score 5 − your partner’s base payoff."}
          </p>
          {room.self.allies && (
            <p>
              Other Saboteurs:{" "}
              {room.self.allies
                .map((id) => room.players.find((p) => p.id === id)?.name)
                .join(", ") || "None"}
            </p>
          )}
          <small>Release to conceal</small>
        </div>
      )}
    </div>
  );
}
export function Results({
  room,
  download,
}: {
  room: RoomView;
  download?: (format: "json" | "csv") => void;
}) {
  const r = room.results!;
  const name = (id: string) => room.players.find((p) => p.id === id)?.name;
  const delay = `${r.players.length * 0.4 + 0.4}s`;
  return (
    <div className="results">
      <div className="results-heading">
        <span className="eyebrow">CASE CLOSED / {room.code}</span>
        <h1>Every cover gets blown.</h1>
        <p>The masks are off. Here’s who you were really dealing with.</p>
      </div>
      <div className="role-lineup">
        {r.players.map((p, i) => (
          <div
            key={p.id}
            className={`reveal-file ${p.role.toLowerCase()}`}
            style={{ "--delay": `${i * 0.4}s` } as CSSProperties}
          >
            <span className="file-number">
              AGENT {String(i + 1).padStart(2, "0")}
            </span>
            <b>{p.name}</b>
            <span className="role-stamp">{p.role}</span>
          </div>
        ))}
      </div>
      <div
        className="result-details"
        style={{ "--delay": delay } as CSSProperties}
      >
        <div className="stats-grid">
          <div>
            <span>COOPERATION</span>
            <strong>{Math.round(r.cooperation.overall * 100)}%</strong>
            <small>
              Loyal {Math.round(r.cooperation.loyal * 100)}% / Saboteur{" "}
              {Math.round(r.cooperation.saboteur * 100)}%
            </small>
          </div>
          <div>
            <span>MOST ACCUSED</span>
            <strong className="stat-name">
              {r.mostAccused.map(name).join(", ")}
            </strong>
            <small>
              {Math.max(...r.players.map((p) => p.accusations))} accusations
              each
            </small>
          </div>
          <div>
            <span>SABOTEURS CAUGHT</span>
            <strong>
              {r.caught}
              <small> / {r.saboteurRanking.length}</small>
            </strong>
            <small>Named by a strict majority of Loyals</small>
          </div>
        </div>
        <div className="leaderboards">
          {[
            { title: "Loyal agents", list: r.loyalRanking, label: "LOYAL" },
            { title: "Saboteurs", list: r.saboteurRanking, label: "SABOTEUR" },
          ].map((group) => (
            <section className="panel" key={group.title}>
              <span className="eyebrow">{group.label} CLASSIFICATION</span>
              <h2>{group.title}</h2>
              <div className="ranking-header">
                <span>AGENT</span>
                <span>FINAL SCORE</span>
              </div>
              {group.list.map((p, i) => (
                <div className="ranking-row" key={p.id}>
                  <span className="rank">
                    {i > 0 && p.score === group.list[i - 1].score
                      ? "="
                      : String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    {p.name}
                    <small>+{p.bonus} accusation bonus</small>
                  </span>
                  <strong>{p.score}</strong>
                </div>
              ))}
            </section>
          ))}
        </div>
        <History room={room} />
        <section className="panel ballot-record">
          <h2>The accusations</h2>
          {r.players.map((p) => (
            <div key={p.id}>
              <span>{p.name}</span>
              <ArrowUpRight size={14} />
              <span>{name(p.vote)}</span>
              {p.role === "LOYAL" &&
                r.saboteurRanking.some((s) => s.id === p.vote) && (
                  <Check size={15} />
                )}
            </div>
          ))}
        </section>
        {download && (
          <div className="export-bar">
            <div>
              <h3>Keep the evidence.</h3>
              <p>Full game record: moves, roles, scores, votes & timestamps.</p>
            </div>
            <button
              className="button secondary"
              onClick={() => download("json")}
            >
              Export JSON <ArrowUpRight size={16} />
            </button>
            <button
              className="button secondary"
              onClick={() => download("csv")}
            >
              Export CSV <ArrowUpRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
