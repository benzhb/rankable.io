import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaCatalog, MediaCard, MediaCategory } from "../../shared/types/media.types.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { env, isProduction } from "../config/env.js";
import { labelFromFolder, titleFromFilename } from "../models/game-rules.js";
import { getSupabase } from "../infrastructure/supabase.js";

const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|webp)$/i;

function contentTypeForPath(path: string): string {
  const extension = path.split(".").at(-1)?.toLowerCase();
  return ({
    avif: "image/avif",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

function cardId(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 24);
}

function demoImage(label: string, background: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="680"><rect width="100%" height="100%" rx="30" fill="${background}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui" font-size="42" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function developmentCatalog(): MediaCatalog {
  const makeCategory = (key: string, label: string, color: string): MediaCategory => ({
    key,
    label,
    cards: Array.from({ length: 12 }, (_, index) => ({
      id: `${key}-${index + 1}`,
      title: `${label} ${index + 1}`,
      storagePath: `development/${key}/${index + 1}.svg`,
      imageUrl: demoImage(`${label} ${index + 1}`, color),
    })),
  });

  return {
    loadedAt: new Date().toISOString(),
    categories: [
      makeCategory("anime", "Anime", "#ef476f"),
      makeCategory("tv-shows", "TV Shows", "#5865f2"),
    ],
  };
}

export class MediaCatalogService {
  private readonly storagePaths = new Map<string, string>();
  private hydratedStoredCatalogs = false;

  constructor(
    private readonly database: PrismaClient,
    private readonly supabase: SupabaseClient | null = getSupabase(),
  ) {}

  private remember(catalog: MediaCatalog): void {
    for (const category of catalog.categories) {
      for (const card of category.cards) this.storagePaths.set(card.id, card.storagePath);
    }
  }

  async ensureForSession(sessionId: string): Promise<MediaCatalog> {
    const existing = await this.database.mediaCatalogSnapshot.findUnique({
      where: { sessionId },
    });
    if (existing) {
      const catalog = existing.data as unknown as MediaCatalog;
      this.remember(catalog);
      return catalog;
    }

    const catalog = await this.loadFromBucket();
    this.remember(catalog);
    try {
      await this.database.mediaCatalogSnapshot.create({
        data: { sessionId, data: catalog as never },
      });
      return catalog;
    } catch (error) {
      const raced = await this.database.mediaCatalogSnapshot.findUnique({
        where: { sessionId },
      });
      if (raced) {
        const racedCatalog = raced.data as unknown as MediaCatalog;
        this.remember(racedCatalog);
        return racedCatalog;
      }
      throw error;
    }
  }

  async cardImage(cardId: string): Promise<{ body: Buffer; contentType: string } | null> {
    let storagePath = this.storagePaths.get(cardId);
    if (!storagePath && !this.hydratedStoredCatalogs) {
      const snapshots = await this.database.mediaCatalogSnapshot.findMany({
        select: { data: true },
      });
      for (const snapshot of snapshots) {
        this.remember(snapshot.data as unknown as MediaCatalog);
      }
      this.hydratedStoredCatalogs = true;
      storagePath = this.storagePaths.get(cardId);
    }
    if (!storagePath) return null;

    const supabase = this.supabase;
    if (!supabase) return null;
    const { data, error } = await supabase.storage
      .from(env.supabaseStorageBucket)
      .download(storagePath);
    if (error) throw new Error(`Unable to load media card: ${error.message}`);

    return {
      body: Buffer.from(await data.arrayBuffer()),
      contentType:
        data.type && data.type !== "application/octet-stream"
          ? data.type
          : contentTypeForPath(storagePath),
    };
  }

  private async loadFromBucket(): Promise<MediaCatalog> {
    const supabase = this.supabase;
    if (!supabase) {
      if (isProduction) throw new Error("Supabase media catalog is unavailable");
      return developmentCatalog();
    }

    const root = env.supabaseMediaRoot;
    const { data: entries, error: rootError } = await supabase.storage
      .from(env.supabaseStorageBucket)
      .list(root, { limit: 1_000, sortBy: { column: "name", order: "asc" } });
    if (rootError) throw new Error(`Unable to list media categories: ${rootError.message}`);

    const folderNames = (entries ?? [])
      .filter((entry) => entry.id === null)
      .map((entry) => entry.name)
      .filter(Boolean);

    const categories: MediaCategory[] = [];
    for (const folder of folderNames) {
      const prefix = [root, folder].filter(Boolean).join("/");
      const { data: files, error } = await supabase.storage
        .from(env.supabaseStorageBucket)
        .list(prefix, { limit: 1_000, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`Unable to list ${folder}: ${error.message}`);

      const paths = (files ?? [])
        .filter((file) => file.id !== null && IMAGE_EXTENSION.test(file.name))
        .map((file) => `${prefix}/${file.name}`);
      if (paths.length === 0) continue;

      const cards: MediaCard[] = paths.map((path) => {
        const filename = path.split("/").at(-1) ?? path;
        const id = cardId(path);
        return {
          id,
          title: titleFromFilename(filename),
          imageUrl: `/media/cards/${encodeURIComponent(id)}`,
          storagePath: path,
        };
      });

      if (cards.length > 0) {
        categories.push({ key: folder, label: labelFromFolder(folder), cards });
      }
    }

    if (categories.length === 0) {
      throw new Error("The Supabase media bucket contains no category folders with images");
    }

    return { categories, loadedAt: new Date().toISOString() };
  }
}
