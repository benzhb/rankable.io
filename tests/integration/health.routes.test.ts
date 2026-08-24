import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { HealthController } from "../../src/server/controllers/health.controller.js";
import { errorHandler } from "../../src/server/middleware/error-handler.js";
import { createHealthRouter } from "../../src/server/routes/health.routes.js";

describe("health routes", () => {
  it("reports process liveness without touching the database", async () => {
    const query = vi.fn();
    const app = express();
    app.use("/health", createHealthRouter(new HealthController({ $queryRaw: query } as unknown as PrismaClient)));
    app.use(errorHandler);

    await request(app).get("/health/live").expect(200, { status: "ok" });
    expect(query).not.toHaveBeenCalled();
  });

  it("checks database readiness", async () => {
    const query = vi.fn(async () => [{ value: 1 }]);
    const app = express();
    app.use("/health", createHealthRouter(new HealthController({ $queryRaw: query } as unknown as PrismaClient)));
    app.use(errorHandler);

    await request(app).get("/health/ready").expect(200, { status: "ready" });
    expect(query).toHaveBeenCalledOnce();
  });
});
