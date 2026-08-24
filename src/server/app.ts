import express, { type Express } from "express";
import type { Application } from "./application.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createRoundRouter } from "./routes/round.routes.js";
import { createSessionRouter } from "./routes/session.routes.js";

export function createApp(application: Application, includeFallback = true): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.use("/health", createHealthRouter(application.controllers.health));
  app.use("/api/auth", createAuthRouter(application.controllers.auth));
  app.use(
    "/api/session",
    createSessionRouter(application.controllers.session, application.accessSessions),
  );
  app.use(
    "/api/rounds",
    createRoundRouter(application.controllers.round, application.accessSessions),
  );
  app.use("/api", notFound);

  if (includeFallback) {
    app.use(notFound);
    app.use(errorHandler);
  }
  return app;
}
