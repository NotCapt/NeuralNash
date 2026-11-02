import { afterEach, expect, it } from "vitest";
import { io as client, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/app.js";
import type { RoomView, Session } from "../shared/types.js";

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
const request = (
  socket: Socket,
  event: string,
  data: unknown = null,
): Promise<any> => socket.timeout(2000).emitWithAck(event, data);
async function setup() {
  const server = createApp();
  cleanup.push(() => server.close());
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
  async function connect() {
    const s = client(url, { transports: ["websocket"], forceNew: true });
    cleanup.push(() => {
      s.disconnect();
    });
    await new Promise<void>((r) => s.on("connect", r));
    return s;
  }
  return { server, connect };
}
it("enforces host authorization, recovers seats, and checks actual socket payloads", async () => {
  const { server, connect } = await setup();
  const host = await connect(),
    hostStates: RoomView[] = [];
  host.on("state", (state) => hostStates.push(state));
  const created = await request(host, "create");
  expect(created.ok).toBe(true);
  const hostSession = created.session as Session,
    player = await connect(),
    peer = await connect();
  const playerStates: RoomView[] = [];
  player.on("state", (state) => playerStates.push(state));
  const joined = await request(player, "join", {
    code: hostSession.code,
    name: "Ada",
  });
  await request(peer, "join", { code: hostSession.code, name: "Grace" });
  expect((await request(player, "control", "start")).ok).toBe(false);
  expect((await request(player, "export", "json")).ok).toBe(false);
  expect((await request(host, "export", "json")).ok).toBe(false);
  await request(host, "fill");
  await request(host, "control", "start");
  for (let i = 0; i < 3; i++) await request(host, "control", "skip");
  await request(player, "choice", "D");
  const before = playerStates.at(-1)!.self!;
  expect(before.choice).toBe("D");
  expect(hostStates.at(-1)?.lockedCount).toBe(1);
  expect(
    hostStates.every(
      (s) =>
        !s.self &&
        !s.results &&
        s.players.every((p) => !("role" in p) && !("score" in p)),
    ),
  ).toBe(true);
  expect(
    playerStates.every(
      (s) => !("choices" in s) && s.players.every((p) => !("role" in p)),
    ),
  ).toBe(true);
  expect(hostStates.at(-1)?.history).toEqual([]);
  player.disconnect();
  const replacement = await connect();
  let resumed: RoomView | undefined;
  replacement.on("state", (s) => {
    resumed = s;
  });
  expect((await request(replacement, "resume", joined.session)).ok).toBe(true);
  expect(resumed!.self).toEqual(before);
  const intruder = await connect();
  expect(
    (
      await request(intruder, "resume", {
        code: hostSession.code,
        token: "x".repeat(64),
      })
    ).ok,
  ).toBe(false);
  expect((await request(intruder, "choice", "D")).ok).toBe(false);
  await request(host, "control", "skip");
  expect(hostStates.at(-1)?.history[0].moves[before.id]).toBe("D");
  await request(host, "control", "end");
  expect((await request(replacement, "vote", before.id)).ok).toBe(false);
  await request(host, "control", "skip");
  const exported = await request(host, "export", "json");
  expect(exported.ok).toBe(true);
  expect(exported.content).not.toContain(joined.session.token);
  expect(exported.content).not.toContain(hostSession.token);
  const result = JSON.parse(exported.content);
  expect(result.players).toHaveLength(12);
  expect(server.rooms.get(hostSession.code)!.game.phase).toBe("RESULTS");
});
it("validates bounds, duplicate names and kicked tokens", async () => {
  const { connect } = await setup();
  const host = await connect();
  const { session } = await request(host, "create");
  const player = await connect();
  const joined = await request(player, "join", {
    code: session.code,
    name: "Agent",
  });
  const duplicate = await connect();
  expect(
    (await request(duplicate, "join", { code: session.code, name: " agent " }))
      .ok,
  ).toBe(false);
  expect((await request(host, "settings", { rounds: 100 })).ok).toBe(false);
  let view: RoomView | undefined;
  host.on("state", (s) => {
    view = s;
  });
  await request(host, "fill");
  const id = view!.players.find((p) => p.name === "Agent")!.id;
  await request(host, "kick", id);
  const reconnect = await connect();
  expect((await request(reconnect, "resume", joined.session)).ok).toBe(false);
});
