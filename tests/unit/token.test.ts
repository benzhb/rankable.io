import { describe, expect, it } from "vitest";
import { createOpaqueToken, hashToken } from "../../src/server/services/token.service.js";

describe("opaque session tokens", () => {
  it("creates unpredictable tokens and stores deterministic hashes", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(32);
    expect(hashToken(first)).toHaveLength(64);
    expect(hashToken(first)).toBe(hashToken(first));
    expect(hashToken(first)).not.toBe(hashToken(second));
  });
});
