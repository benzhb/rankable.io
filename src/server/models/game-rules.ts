import { randomInt } from "node:crypto";
import type { CardEndpoint, Tier } from "../../shared/types/round.types.js";
import { TIERS } from "../../shared/types/round.types.js";

export function shuffle<T>(items: readonly T[], rng = randomInt): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = rng(index + 1);
    [shuffled[index], shuffled[selected]] = [
      shuffled[selected] as T,
      shuffled[index] as T,
    ];
  }
  return shuffled;
}

export function rotateQueue<T>(queue: readonly T[]): T[] {
  if (queue.length < 2) return [...queue];
  return [...queue.slice(1), queue[0] as T];
}

export function removeFromQueue<T>(queue: readonly T[], item: T): T[] {
  return queue.filter((candidate) => candidate !== item);
}

export function visibleCardWindow<T>(cards: readonly T[], size = 5): T[] {
  return cards.slice(0, size);
}

export function isTier(endpoint: CardEndpoint): endpoint is Tier {
  return TIERS.includes(endpoint as Tier);
}

export function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function labelFromFolder(folder: string): string {
  return folder
    .replace(/^\/+|\/+$/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
