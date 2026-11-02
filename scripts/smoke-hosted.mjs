import assert from "node:assert/strict";
const origin = process.argv[2];
if (!origin) throw new Error("Pass the deployed origin.");
async function call(event, data = null, session) {
  const r = await fetch(`${origin}/api/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data, session }),
  });
  assert.equal(r.status, 200);
  return r.json();
}
const host = await call("create");
assert(host.ok);
const session = host.session;
const player = await call("join", { code: session.code, name: "Smoke Agent" });
assert(player.ok);
assert.equal((await call("control", "start", player.session)).ok, false);
await call("fill", null, session);
await call(
  "settings",
  {
    rounds: 5,
    talkSeconds: 60,
    decisionSeconds: 20,
    accusationSeconds: 15,
    saboteursKnowEachOther: false,
    sound: false,
  },
  session,
);
let response = await call("control", "start", session);
let chose = false;
for (let n = 0; n < 35 && response.state.phase !== "RESULTS"; n++) {
  assert.equal(response.state.self, undefined);
  assert(
    response.state.players.every((p) => !("role" in p) && !("score" in p)),
  );
  if (response.state.phase === "DECISION" && !chose) {
    assert((await call("choice", "D", player.session)).ok);
    const resume = await call("resume", player.session);
    assert.equal(resume.state.self.choice, "D");
    chose = true;
  }
  if (response.state.phase === "ACCUSATION")
    assert(
      (
        await call(
          "vote",
          response.state.players.find((p) => p.id !== player.state.self.id).id,
          player.session,
        )
      ).ok,
    );
  response = await call("control", "skip", session);
  assert(response.ok);
}
assert.equal(response.state.phase, "RESULTS");
assert.equal(response.state.history.length, 5);
const exported = await call("export", "json", session);
assert(exported.ok);
assert(!exported.content.includes(session.token));
console.log(
  JSON.stringify({
    ok: true,
    rounds: response.state.history.length,
    players: response.state.players.length,
    seatRecovered: chose,
    privatePayloads: true,
    exportVerified: true,
  }),
);
