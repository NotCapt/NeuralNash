import { createApp, lanAddresses } from "./app.js";
import { tickBots } from "./bots.js";

const port = Number(process.env.PORT || 3001);
const server = createApp({ botTick: tickBots });
server.http.listen(port, "0.0.0.0", () => {
  console.log(`DOUBLE AGENT server: http://localhost:${port}`);
  for (const address of lanAddresses())
    console.log(
      `LAN: http://${address}:${process.argv[1].endsWith(".js") ? port : 5173}`,
    );
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
