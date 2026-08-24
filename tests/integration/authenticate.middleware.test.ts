import express from "express";
import request from "supertest";
import { describe, it } from "vitest";
import type { AccessSessionRepository } from "../../src/server/repositories/access-session.repository.js";
import { authenticate } from "../../src/server/middleware/authenticate.js";

describe("bearer authentication middleware", () => {
  it("rejects requests without opaque bearer tokens", async () => {
    const repository = {
      authenticate: async () => null,
    } as unknown as AccessSessionRepository;
    const app = express();
    app.get("/private", authenticate(repository), (_request, response) => response.sendStatus(204));
    await request(app).get("/private").expect(401);
  });

  it("adds verified access context to requests", async () => {
    const repository = {
      authenticate: async () => ({
        accessSessionId: "access",
        sessionId: "session",
        userId: "user",
      }),
    } as unknown as AccessSessionRepository;
    const app = express();
    app.get("/private", authenticate(repository), (request, response) => {
      response.json(request.auth);
    });
    await request(app)
      .get("/private")
      .set("Authorization", "Bearer opaque")
      .expect(200, { accessSessionId: "access", sessionId: "session", userId: "user" });
  });
});
