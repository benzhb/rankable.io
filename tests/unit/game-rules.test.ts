import { describe, expect, it } from "vitest";
import {
  isTier,
  labelFromFolder,
  removeFromQueue,
  rotateQueue,
  shuffle,
  titleFromFilename,
  visibleCardWindow,
} from "../../src/server/models/game-rules.js";

describe("game rules", () => {
  it("randomizes the initial queue without losing players", () => {
    const selections = [1, 0, 1];
    const result = shuffle(["Alex", "Mina", "Devon", "Zoe"], () => selections.shift() ?? 0);
    expect(result).toHaveLength(4);
    expect(new Set(result)).toEqual(new Set(["Alex", "Mina", "Devon", "Zoe"]));
    expect(result).not.toEqual(["Alex", "Mina", "Devon", "Zoe"]);
  });

  it("moves the current player to the queue tail after a turn", () => {
    expect(rotateQueue(["Devon", "Zoe", "Alex", "Mina"]))
      .toEqual(["Zoe", "Alex", "Mina", "Devon"]);
  });

  it("removes disconnected players without rotating anybody else", () => {
    expect(removeFromQueue(["Alex", "Mina", "Devon"], "Mina"))
      .toEqual(["Alex", "Devon"]);
  });

  it("shows no more than five queued cards", () => {
    expect(visibleCardWindow([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4, 5]);
  });

  it("recognizes only final tier endpoints", () => {
    expect(isTier("S")).toBe(true);
    expect(isTier("F")).toBe(true);
    expect(isTier("BANK")).toBe(false);
  });

  it("creates labels from manually uploaded folder and file names", () => {
    expect(labelFromFolder("tv-shows")).toBe("Tv Shows");
    expect(titleFromFilename("cowboy_bebop.webp")).toBe("Cowboy Bebop");
  });
});
