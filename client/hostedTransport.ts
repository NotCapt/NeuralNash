import type { Session } from "../shared/types";

// HTTPS polling keeps room state on the server while working in Worker hosting.
export class HostedTransport {
  connected = false;
  private handlers = new Map<string, ((...args: any[]) => void)[]>();
  private session?: Session;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private queue: Promise<unknown> = Promise.resolve();
  on(event: string, fn: (...args: any[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
    return this;
  }
  private emit(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((fn) => fn(...args));
  }
  timeout(_ms: number) {
    return this;
  }
  connect() {
    this.stopped = false;
    this.connected = true;
    this.emit("connect");
    this.schedule();
  }
  disconnect() {
    this.stopped = true;
    this.connected = false;
    clearTimeout(this.timer);
  }
  private schedule() {
    clearTimeout(this.timer);
    if (!this.stopped)
      this.timer = setTimeout(async () => {
        try {
          if (this.session) await this.emitWithAck("sync", null);
          if (!this.connected) {
            this.connected = true;
            this.emit("connect");
          }
        } catch {
          if (this.connected) {
            this.connected = false;
            this.emit("disconnect", "network");
          }
        }
        this.schedule();
      }, 1000);
  }
  emitWithAck(event: string, data: unknown): Promise<any> {
    const job = this.queue
      .catch(() => {})
      .then(async () => {
        const response = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, data, session: this.session }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Server unavailable");
        const reply = await response.json();
        if (reply.session) this.session = reply.session;
        if (reply.state) this.emit("state", reply.state);
        if (event === "sync" && reply.expired) {
          this.session = undefined;
          this.emit("removed");
        }
        return reply;
      });
    this.queue = job;
    return job;
  }
}
