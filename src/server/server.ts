import { createServer } from "node:http";
import { createApplication } from "./application.js";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { attachFrontend } from "./frontend.js";
import { assertPrivateMediaBucket } from "./infrastructure/supabase.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { attachWebSocketServer } from "./websocket/websocket-server.js";

const application = createApplication();
await application.database.$connect();
await assertPrivateMediaBucket();

const app = createApp(application, false);
const httpServer = createServer(app);
const webSockets = attachWebSocketServer(httpServer, application);
await attachFrontend(app, httpServer);
app.use(notFound);
app.use(errorHandler);

await application.rounds.restoreTimers();

httpServer.listen(env.port, () => {
  console.log(`Rankable listening on http://localhost:${env.port}`);
});

async function shutdown(): Promise<void> {
  application.timers.stopAll();
  await webSockets.close();
  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
  await application.database.$disconnect();
}

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
