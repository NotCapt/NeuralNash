# Validation record — 2 November 2026

## Automated checks

- `npm test`: **33 tests passed**, across five files.
- `npm run build`: TypeScript checks, Vite production bundle and Node server compilation passed.
- npm dependency audit after installing the patched dependencies and formatter: **0 known vulnerabilities**.
- Production server started with `PORT=3002`; `/`, `/host`, `/join?room=TEST`, `/api/health` and `/api/network` all returned HTTP 200. The LAN endpoint preferred the Wi-Fi adapter over the virtual Ethernet adapter.
- Outgoing socket emission sites were inspected: only recipient-specific `state`, `removed`, and acknowledgements are emitted. See [the full payload audit](SECURITY.md).

## Headless balance sample

`npm run simulate -- --players 12 --games 1000` (8 rounds, seed 42):

| Metric                       | Result |
| ---------------------------- | -----: |
| Average Loyal final score    |  22.01 |
| Average Saboteur final score |  36.80 |
| Saboteur catch rate          | 28.47% |
| Mean cooperation rate        | 58.26% |

Scores include final bonuses. These are separate scoring scales and are not directly comparable rankings. Catch rate is the fraction of Saboteurs named by a strict majority of all Loyals. This is a bot-strategy sample, not a prediction of human play.

## Browser exercise

Verified at desktop (1440×1000) and phone (390×844) viewport sizes:

- Create a room; disabled start below four players; add bots; remove a bot; select the Wi-Fi join address; edit rounds and timers.
- Join a human seat in a second browser tab, with live host roster updates.
- Start a five-round game with eleven bots and one human seat.
- Hold the private-role button, observe the assignment and scoring rule appear, then release and confirm they disappear.
- Select Cooperate, change to Defect, refresh the player page and confirm that the same seat, selected move and score return.
- Pause from the host, confirm player choice buttons are disabled and timer is frozen, resume, then reveal a round with a private score.
- Advance the remaining rounds with host skips, confirm completed public move history, select and confirm a secret accusation.
- Close voting; verify final roles, two distinct leaderboards, cooperation statistics, accusations and five-round history.
- Download JSON and CSV through the results controls. The JSON contained 12 players, five completed rounds, 111 audit events and a final RESULTS transition. Host skips in this UI test intentionally exercise timeout defaults; full strategic bot games are covered by simulation/tests.
- No host browser error/warning console entries were captured. The phone decision view had equal document client and scroll widths, confirming no horizontal overflow in that view.
- After the UI refinements, verify a fresh room prefers Wi-Fi automatically and accepts a multi-digit round setting, then restore the default eight rounds.

Screenshots: [desktop landing](screenshots/desktop.jpg), [host lobby](screenshots/host-lobby.jpg), [phone decision](screenshots/phone-decision.jpg).

## Remaining event-specific check

The browser checks used two tabs and phone-sized rendering, not a physical phone on the event Wi-Fi. Before the event, scan the QR from a real phone to confirm the chosen adapter, firewall access and absence of Wi-Fi client isolation. Reconnection across an actual phone sleep/wake cycle and projected readability should be rehearsed on the event devices. Server restart recovery is intentionally unsupported because rooms are in memory.

## Sites adaptation

The additional Worker gateway test brings the suite to **34 passing tests**. TypeScript and the Sites bundle build pass. The same game engine runs behind either the local Socket.IO gateway or the D1-backed hosted HTTPS gateway. Hosted tests cover concurrent moves, reconstructed-request seat recovery and information hiding.

The public deployment passed a five-round, 12-player smoke test using its HTTPS API: non-host control rejection, saved-choice recovery, secret-free host payloads, final history and token-free JSON export. The browser also verified room creation, public QR generation and joining from a second tab. The reproducible check is `node scripts/smoke-hosted.mjs https://double-agent-neuralnash.faaizhussain006.chatgpt.site`; it creates its own test room.
