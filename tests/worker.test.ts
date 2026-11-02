import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { gameRequest } from "../worker/game";
function db() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE rooms(code TEXT PRIMARY KEY,version INTEGER,state TEXT,updated_at INTEGER)",
  );
  return {
    prepare(sql: string) {
      let args: any[] = [];
      return {
        bind(...values: any[]) {
          args = values;
          return this;
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...args) ?? null) as T | null;
        },
        async run() {
          return {
            meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) },
          };
        },
      };
    },
  };
}
describe("Sites authoritative gateway", () => {
  it("isolates secrets, survives reconstructed requests, and rejects host impersonation", async () => {
    const env = { DB: db() };
    const request = async (event: string, data?: unknown, session?: unknown) =>
      (await gameRequest({ event, data, session }, env)) as any;
    const host = await request("create");
    const code = host.session.code;
    const a = await request("join", { code, name: "Alice" }),
      b = await request("join", { code, name: "Bob" });
    expect((await request("control", "start", a.session)).ok).toBe(false);
    await request("fill", null, host.session);
    await request("control", "start", host.session);
    for (let i = 0; i < 3; i++) await request("control", "skip", host.session);
    const results = await Promise.all([
      request("choice", "D", a.session),
      request("choice", "C", b.session),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    const hostState = (await request("sync", null, host.session)).state;
    expect(hostState.lockedCount).toBe(2);
    expect(hostState.self).toBeUndefined();
    expect(hostState.results).toBeUndefined();
    expect(
      hostState.players.every((p: any) => !("role" in p) && !("score" in p)),
    ).toBe(true);
    const resumed = await request("resume", a.session);
    expect(resumed.state.self.choice).toBe("D");
    expect(resumed.state.self.id).toBe(a.state.self.id);
    expect((await request("export", "json", host.session)).ok).toBe(false);
    await request("control", "skip", host.session);
    await request("control", "end", host.session);
    await request("control", "skip", host.session);
    const exported = await request("export", "json", host.session);
    expect(exported.ok).toBe(true);
    expect(exported.content).not.toContain(a.session.token);
    expect((await request("export", "json", a.session)).ok).toBe(false);
  });
});
