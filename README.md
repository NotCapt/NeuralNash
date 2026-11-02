# DOUBLE AGENT

A real-time, in-person social-deduction game for a projector and 6–16 phones. The Node.js server owns the complete game; React clients receive only the information their seats may see.

See the [validation record and simulation results](docs/VALIDATION.md) and [host lobby preview](docs/screenshots/host-lobby.jpg).

## Setup

Use **Node.js 22.12+ (or Node.js 24 LTS)** and npm.

```sh
npm install
npm run dev
```

Open **http://localhost:5173** on the host laptop. Click **Create an operation**, then share the room’s QR code. Vite serves the client on all network interfaces and proxies Socket.IO to the Node server on port 3001. No accounts, database, paid services, font CDN, or external assets are required at runtime.

For a production build with a single server:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. `PORT` changes this production port. During development the Vite proxy expects port 3001; leave `PORT` unset. `npm run dev` starts and stops both processes together. All state is in memory: stopping/restarting the server loses rooms. A normal phone refresh does not.

## Run a live event on your Wi-Fi

1. Put the host laptop and phones on the **same Wi-Fi**. Use a network without client/AP isolation; college guest networks often isolate devices. A laptop hotspot is an alternative.
2. Run `npm run dev` (port **5173**) or, preferably for the event, `npm run build` followed by `npm start` (port **3001**).
3. Allow Node.js through the OS firewall on the **private network**. Keep the laptop awake and plugged in. You do not need to expose this app to the internet.
4. Create the room. The server detects LAN IPv4 addresses; even when the host opens `localhost`, the QR code uses a LAN address. If multiple adapters exist (VPN, virtual adapter, Ethernet, Wi-Fi), select the Wi-Fi address from the lobby’s **Network address** selector. The URL printed beside the QR is the actual encoded URL. If automatic discovery has no usable address, set `JOIN_ORIGIN` to the full LAN origin before starting the server, for example `http://192.168.1.25:3001`.
5. Test the QR from one phone before admitting everyone. If the phone cannot open it, check the chosen adapter, firewall, port and Wi-Fi isolation. The printed address is also a clickable/copyable join link. Manual entry works at `/join` with the four-letter room code.
6. Keep `/host` on the projector. The host is an observer, not a player. If the host also plays, use a phone or separate browser profile. Use separate browsers/profiles for several test players on one computer; only one active socket is allowed per saved seat.
7. Start with 4–16 agents (the app recommends at least 6). Set 5–12 rounds, a 0–180-second talk phase, decision time, final discussion time, awareness and host sound. Settings lock when play starts.
8. Host controls pause/resume, skip the timer, end early into accusations, and restart. Pausing freezes decisions and votes too. Skipping closes the current phase immediately. A result reveal normally lasts 7 seconds.
9. After results, download **JSON and CSV** before restarting or stopping the server. Exports contain secret roles, all move edits, final moves, timeouts, byes, scores, ballots, settings and timestamped transitions. Treat these as the full post-game research record.

PowerShell example for a custom LAN origin:

```powershell
$env:JOIN_ORIGIN = 'http://192.168.1.25:3001'
npm start
```

## Rules to read aloud

“Each round you’ll meet a new partner, talk, and secretly cooperate or defect. If you both cooperate you each receive 3 base points; if one defects, the defector receives 5 and the cooperator 0; if both defect you each receive 1. Most of you are Loyal and earn your own base payoff. A hidden minority are Saboteurs and earn 5 minus their partner’s base payoff. Moves will be public, but roles and scores stay private. At the end, everyone secretly names one other player: a Loyal who names a Saboteur gains 3 points, and each Saboteur gains 2 points for every Loyal who didn’t name them. Loyals and Saboteurs have separate rankings. You may change a move or ballot until its timer ends. No move means cooperate. Trust carefully.”

## Testing and simulation

```sh
npm test
npm run typecheck
npm run build
npm run simulate -- --players 12 --games 1000
npm run simulate -- --players 9 --games 500 --seed 123
```

The simulation runs the same game/scoring engine as the live server, with a deterministic PRNG (default seed 42). It reports mean final scores separately by role, the proportion of Saboteurs caught, and cooperation rate. Bots use the partner’s most recent **public** move for Loyal Tit-for-Tat, a 0.6 defection probability for Saboteurs, and the highest public defection rate for accusations (uniform random tie-breaking). They never use another seat’s private role to select a ballot. **Fill with bots** tops up a lobby to 12; repeated clicks do not add seats beyond 12. It does not remove humans or reduce a larger lobby. Bots act partway through each timer; host skip can still cause defaults if used before they act.

Tests cover all 16 combinations of moves and roles, Saboteur counts, minimum-repeat pairing, fair byes, accusation bonuses, phase transitions, defaults, pause behavior, reset, bot strategies and complete games, CSV safety, actual Socket.IO payloads, host authorization, reconnect identity, kicked tokens and export restrictions. Socket tests need permission to bind/connect to loopback.

## Repository map

```text
client/
  App.tsx           Landing, host projector, lobby and phone views
  components.tsx    Private role card, timers, history, results and settings
  useGame.ts        Socket connection, localStorage seat recovery and clock sync
  styles.css        Responsive noir theme, restrained reveals, reduced motion
  main.tsx          React entry
server/
  game.ts           Authoritative state machine, scoring, logs and safe views
  rules.ts          Pure payoffs, accusation bonuses, roles and optimal matching
  app.ts            Socket gateway, validation, sessions and HTTP/LAN endpoints
  bots.ts           Strategies and timer-aware bot scheduling
  export.ts         Full event CSV with spreadsheet-formula escaping
  index.ts          Server entry and graceful shutdown
shared/types.ts     Public wire types and default settings
scripts/simulate.ts Seeded headless multi-game simulation
tests/             Rules, engine, bots, export and real socket integration tests
docs/SECURITY.md    Outgoing payload audit and trust boundaries
```

## Assumptions and exact edge behavior

- **Missing accusation:** the spec requires exactly one other player per ballot but does not define timeout behavior. At the deadline a missing ballot is assigned a uniformly random other player, logged as `timedOut: true`. The voting screen discloses this. Confirmed ballots may be revised until the timer ends. An abandoned/offline seat follows the same rule.
- **Phase timings:** role reveal is 12 seconds; pairing is 2 seconds; reveal is 7 seconds. Talk defaults to 60 seconds, decisions to 20, accusations to 90. Decision settings allow 5–120 seconds, accusations 15–180. A 0-second talk phase is still logged and advances on the next server tick (100 ms).
- **Early end:** only fully revealed rounds are scored and retained; an unrevealed current round is discarded. Early end starts a full accusation phase, even if paused. Restart returns the same seats/tokens to the lobby with fresh state and a fresh log.
- **Pairings:** select a bye uniformly from players with the fewest byes, then solve an exact minimum-cost perfect matching for the rest. First minimize the number of repeated pairs, then squared previous meeting counts. A no-repeat matching always wins if available for that eligible pool. Randomized ordering breaks matching ties. Disconnected players remain eligible and retain their seat.
- **Counts and statistics:** byes earn 0 for either role and are excluded from cooperation denominators. The number of Saboteurs is `max(1, floor(N/4))`. “Caught” means **strictly more than half** of all Loyal players name that Saboteur, regardless of connectivity. “Most accused” includes all ballots and lists all ties. Scores are never ranked across roles; tied scores share a place.
- **Privacy and reconnection:** roles, private scores and the player’s current move are sent only to that seat. The awareness toggle is the one explicit exception: Saboteurs receive other Saboteurs’ IDs so the private role card can name them. Roles and scores become public in RESULTS. Player and host tokens are random 256-bit bearer credentials stored in localStorage; refreshing restores the same seat. Opening the same saved seat elsewhere disconnects its previous socket. A browser storage wipe or server restart cannot recover a seat.
- **Event hosting:** a local, trusted event Wi-Fi is the intended deployment. HTTP LAN traffic is not encrypted; use an HTTPS reverse proxy and `JOIN_ORIGIN` if the network is not trusted. In-memory rooms expire after 12 hours without activity and without connected seats, and the server caps the number of rooms at 100.
- **Animations and sound:** result roles appear sequentially, then leaderboards and statistics appear. Reduced-motion settings bypass animation delays. Sound cues use the host browser’s Web Audio API after a user gesture; there is no remote audio dependency.
