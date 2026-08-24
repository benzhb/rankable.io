import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { MediaController } from "../../src/server/controllers/media.controller.js";
import { errorHandler } from "../../src/server/middleware/error-handler.js";
import { createMediaRouter } from "../../src/server/routes/media.routes.js";
import type { MediaCatalogService } from "../../src/server/services/media-catalog.service.js";

function mediaApp(cardImage: MediaCatalogService["cardImage"]) {
  const app = express();
  const media = { cardImage } as MediaCatalogService;
  app.use("/media", createMediaRouter(new MediaController(media)));
  app.use(errorHandler);
  return app;
}

describe("media card routes", () => {
  it("serves bucket images through the Activity origin", async () => {
    const cardImage = vi.fn(async () => ({
      body: Buffer.from([1, 2, 3]),
      contentType: "image/png",
    }));

    const response = await request(mediaApp(cardImage))
      .get("/media/cards/card-1")
      .expect(200)
      .expect("Content-Type", "image/png");

    expect(response.body).toEqual(Buffer.from([1, 2, 3]));
    expect(response.headers["cache-control"]).toContain("max-age=3600");
    expect(cardImage).toHaveBeenCalledWith("card-1");
  });

  it("does not expose unknown storage paths", async () => {
    const cardImage = vi.fn(async () => null);

    await request(mediaApp(cardImage))
      .get("/media/cards/not-in-the-catalog")
      .expect(404, {
        error: { code: "MEDIA_NOT_FOUND", message: "Media card image not found" },
      });
  });
});
