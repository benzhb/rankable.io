import { createHash } from "node:crypto";
import type { MediaCatalog, MediaCard, MediaCategory } from "../../shared/types/media.types.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { env, isProduction } from "../config/env.js";
import { labelFromFolder, titleFromFilename } from "../models/game-rules.js";
import { getSupabase } from "../infrastructure/supabase.js";

const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|webp)$/i;

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
  constructor(private readonly database: PrismaClient) {}

  async ensureForSession(sessionId: string): Promise<MediaCatalog> {
    const existing = await this.database.mediaCatalogSnapshot.findUnique({
      where: { sessionId },
    });
    if (existing) return existing.data as unknown as MediaCatalog;

    const catalog = await this.loadFromBucket();
    try {
      await this.database.mediaCatalogSnapshot.create({
        data: { sessionId, data: catalog as never },
      });
      return catalog;
    } catch (error) {
      const raced = await this.database.mediaCatalogSnapshot.findUnique({
        where: { sessionId },
      });
      if (raced) return raced.data as unknown as MediaCatalog;
      throw error;
    }
  }

  private async loadFromBucket(): Promise<MediaCatalog> {
    const supabase = getSupabase();
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

      const { data: signed, error: signError } = await supabase.storage
        .from(env.supabaseStorageBucket)
        .createSignedUrls(paths, env.mediaSignedUrlTtlSeconds);
      if (signError) throw new Error(`Unable to sign ${folder} media: ${signError.message}`);

      const cards: MediaCard[] = paths.flatMap((path, index) => {
        const signedUrl = signed?.[index]?.signedUrl;
        if (!signedUrl) return [];
        const filename = path.split("/").at(-1) ?? path;
        return [{
          id: cardId(path),
          title: titleFromFilename(filename),
          imageUrl: signedUrl,
          storagePath: path,
        }];
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
