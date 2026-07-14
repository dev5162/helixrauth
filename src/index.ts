import "dotenv/config";
import { loadConfig } from "./config.js";
import { createServer, shutdownServer } from "./server.js";

const config = loadConfig();
const app = createServer(config);

const server = app.listen(config.port, () => {
  console.log(`Helixrs Auth Gateway listening on ${config.publicBaseUrl}`);
});

process.on("SIGTERM", async () => {
  server.close();
  await shutdownServer();
  process.exit(0);
});

process.on("SIGINT", async () => {
  server.close();
  await shutdownServer();
  process.exit(0);
});
