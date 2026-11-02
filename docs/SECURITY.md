# Socket payload and information-hiding audit

The projector host is **not privileged to read secrets** before RESULTS. Host authority controls the phase, not role visibility. `Game.view()` is the only live state serializer; it constructs a fresh object from explicit field lists. `Game`, internal `Player`, choice maps, credentials and event logs are never spread into a live payload.

## Every outgoing application payload

| Event / acknowledgement                                     | Recipient                                      | Contents and privacy boundary                                                                                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`                                                     | Each authenticated socket individually         | Code, phase, public settings, public roster `{id,name,bot,connected}`, round, public pairings/bye, **completed** round moves, aggregate selected count/ballot count and clock fields. No individual choice status.    |
| `state.self`                                                | Matching player seat only                      | Own ID, running score; after start, own role, current choice, own saved vote and last private round result. No opponent score or role. When enabled, only a Saboteur receives the explicitly authorized ally ID list. |
| `state.results`                                             | Authenticated host/players, **RESULTS only**   | All final roles, scores, bonuses, ballots, statistics and two separate rankings. Sequential reveals are presentation only: the game is already over.                                                                  |
| `create` ACK                                                | Creating socket                                | Random four-letter code, **that host’s** 256-bit token and `kind: host`. No internal state.                                                                                                                           |
| `join` ACK                                                  | Joining socket                                 | Room code, **that seat’s** independent 256-bit token and `kind: player`.                                                                                                                                              |
| `resume` ACK                                                | Socket proving possession of an existing token | Same code/token/kind. Token cannot select an arbitrary player ID or promote a player into a host.                                                                                                                     |
| `settings`, `control`, `kick`, `fill`, `choice`, `vote` ACK | Requesting socket                              | `{ok: true}` only, or a validation/action error. No role-bearing input appears in an error.                                                                                                                           |
| `export` ACK                                                | Authenticated host, **RESULTS only**           | JSON or CSV post-game research record and a generated filename. Includes moves, roles, scores, votes and timestamps; no bearer tokens or socket IDs.                                                                  |
| Error ACK                                                   | Requesting socket                              | `{ok: false, error: string}`. Zod errors are replaced with a generic validation message.                                                                                                                              |
| `removed`                                                   | Kicked seat only                               | No payload. Its token is deleted and its socket disconnected.                                                                                                                                                         |

`/api/health` exposes only `{ok:true}`. `/api/network` contains local IPv4 addresses and optional configured join origin, not game state. Static routes contain the client code, public types and defaults; the server bundle is never served as a static directory.

## Authorization and timing

- Every mutation resolves the socket’s server-bound token, verifies that the socket is the seat’s current socket, and checks host/player authority. A player cannot call host controls, kick, change settings, fill bots or export logs.
- Client event names and body shapes are validated; roles, scores, sender IDs, rounds and timestamps are never accepted from clients. `choice` accepts only `C` or `D`; `vote` accepts an existing, non-self player ID.
- An elapsed server timer is resolved before a request can mutate game state. A late choice cannot enter the previous round. Paused moves/votes are rejected. The default is applied exactly once, during the transition into REVEAL.
- All `state` emissions are per-seat, including the host. There is no broadcast of a private state followed by client-side filtering. The selected counter reports only an aggregate; it does not report who selected.
- Hold-to-view is shoulder-surfing protection, not a claim that the player’s own browser cannot inspect their own assignment. Choice values are public only when stored in completed history. Timeout flags stay in the sealed audit log.
- Requests are limited to 30 per socket per second and Socket.IO packets to 16 KiB. Names are plain React text (not HTML), checked case-insensitively for uniqueness, limited to 16 Unicode code points, and reject control/format characters. CSV quotes fields and prefixes formula-leading input.

## Verification

`tests/game.test.ts` checks allowlisted field names and hidden values before reveal, enabled/disabled awareness, export sealing and final visibility. `tests/socket.test.ts` starts a real HTTP + Socket.IO server and inspects the host/player messages sent on the wire, rejects a non-host action/export and a guessed token, recovers a seat with the same role/score/choice after a disconnect, and checks kicked tokens and token-free exports. The gateway's outgoing calls are limited to `state`, `removed`, and the ACK wrapper listed above.

This application is scoped to a trusted local event, not a hardened public multi-tenant game service. In-memory state is not crash-persistent, localStorage bearer tokens must remain private, and unencrypted HTTP cannot protect against Wi-Fi traffic interception. TLS is required if that threat is relevant to deployment.

## Hosted Sites transport

The Sites deployment uses `/api/game` over HTTPS instead of Socket.IO. Its `create`, `join`, `resume`, `sync`, control, move, ballot and export responses obey the same per-seat `Game.view()` allowlist. Tokens travel in request bodies, never URLs; internal room records and token maps are never returned. Host-only actions are checked on every request. D1 version-checked updates retry conflicts, preventing lost updates when several players act at once. The hosted gateway rejects cross-origin mutation requests and oversized bodies.

Clients poll once per second. Time remains authoritative on the server: elapsed deadlines are replayed on the next request; no sleeping browser can extend a decision window. Rooms persist in D1 across Worker instances. Hosted saved-seat tabs share the same seat; the local Socket.IO deployment instead disconnects the prior socket. Online presence is approximate (15-second heartbeat threshold). The local server’s per-socket rate limit and 12-hour in-memory cleanup do not apply to the hosted gateway.

`tests/worker.test.ts` exercises the hosted handler against SQLite, including simultaneous moves, seat recovery, host authorization, secret-free host views, and token-free results exports.
