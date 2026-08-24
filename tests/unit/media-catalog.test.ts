import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { MediaCatalogService } from "../../src/server/services/media-catalog.service.js";

describe("activity media catalog", () => {
  it("loads and saves the catalog only once per Activity instance", async () => {
    let saved: unknown = null;
    const findUnique = vi.fn(async () => saved);
    const create = vi.fn(async ({ data }: { data: { data: unknown } }) => {
      saved = { data: data.data };
      return saved;
    });
    const database = {
      mediaCatalogSnapshot: { findUnique, create },
    } as unknown as PrismaClient;
    const service = new MediaCatalogService(database, null);

    const first = await service.ensureForSession("session-1");
    const second = await service.ensureForSession("session-1");

    expect(first.categories.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(create).toHaveBeenCalledOnce();
  });
});
